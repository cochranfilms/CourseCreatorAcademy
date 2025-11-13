import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendEmailJS } from '@/lib/email';
import { computeApplicationFeeAmount } from '@/lib/fees';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!sig || (!platformSecret && !connectSecret)) return NextResponse.json({ ok: true });

  const body = await req.text();
  let event: any | null = null;
  let verifiedWith: 'platform' | 'connect' | null = null;

  // Try platform secret first
  if (platformSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, platformSecret);
      verifiedWith = 'platform';
    } catch (e) {
      event = null;
    }
  }

  // Fallback to connect secret if needed
  if (!event && connectSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, connectSecret);
      verifiedWith = 'connect';
    } catch (e) {
      event = null;
    }
  }

  if (!event) {
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  // Idempotency: short-circuit if event already processed
  try {
    if (adminDb && event.id) {
      const processedRef = adminDb.collection('webhookEventsProcessed').doc(String(event.id));
      const snap = await processedRef.get();
      if (snap.exists) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Mark as processed early; handlers should be idempotent
      await processedRef.set({
        source: 'stripe',
        type: String(event.type || ''),
        created: new Date(),
      }, { merge: true });
    }
  } catch (e) {
    // continue; best-effort
  }

  const isConnectEvent = verifiedWith === 'connect' || Boolean(event.account);

  // Helper: resolve a charge ID from an invoice (supports newer API shapes)
  const resolveChargeId = async (invoice: any): Promise<string | null> => {
    try {
      if (invoice?.charge && typeof invoice.charge === 'string') {
        // Some API versions return a charge ID here (ch_...) or a payment id (py_...)
        if (String(invoice.charge).startsWith('ch_')) return String(invoice.charge);
      }
      const piId = invoice?.payment_intent;
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(String(piId));
        const latestCharge = (pi as any)?.latest_charge;
        if (latestCharge && typeof latestCharge === 'string') return latestCharge;
      }
    } catch {}
    return null;
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const isSubscription = (session.mode === 'subscription') || Boolean(session.subscription);
      console.log('checkout.session.completed', {
        isConnectEvent,
        account: event.account,
        sessionId: session.id,
        amount_total: session.amount_total,
        currency: session.currency,
        mode: session.mode,
        subscription: session.subscription,
        metadata: session.metadata
      });

      // Handle job deposit checkout completion
      if (session.metadata?.type === 'job_deposit' && adminDb && session.payment_intent) {
        try {
          const applicationId = session.metadata?.applicationId;
          if (applicationId) {
            const paymentIntentId = typeof session.payment_intent === 'string' 
              ? session.payment_intent 
              : session.payment_intent.id || session.payment_intent;
            
            await adminDb.collection('jobApplications').doc(String(applicationId)).update({
              depositPaid: true,
              depositPaidAt: FieldValue.serverTimestamp(),
              depositCheckoutSessionId: session.id,
              depositPaymentIntentId: String(paymentIntentId),
              updatedAt: FieldValue.serverTimestamp()
            });
            console.log('Job deposit checkout completed:', applicationId, 'PaymentIntent:', paymentIntentId);
          }
        } catch (err) {
          console.error('Error processing job deposit checkout:', err);
        }
      }

      // Handle job final payment checkout completion
      if (session.metadata?.type === 'job_final_payment' && adminDb && session.payment_intent) {
        try {
          const applicationId = session.metadata?.applicationId;
          if (applicationId) {
            const paymentIntentId = typeof session.payment_intent === 'string' 
              ? session.payment_intent 
              : session.payment_intent.id || session.payment_intent;
            
            await adminDb.collection('jobApplications').doc(String(applicationId)).update({
              finalPaymentCheckoutSessionId: session.id,
              finalPaymentIntentId: String(paymentIntentId),
              updatedAt: FieldValue.serverTimestamp()
            });
            console.log('Job final payment checkout completed:', applicationId, 'PaymentIntent:', paymentIntentId);
            // Note: finalPaymentPaid and transfers will be handled by payment_intent.succeeded webhook
          }
        } catch (err) {
          console.error('Error processing job final payment checkout:', err);
        }
      }
      try {
        if (isSubscription && adminDb) {
          // Legacy+ subscription flow (created on platform account)
          const creatorId = session.metadata?.legacyCreatorId || null;
          const buyerId = session.metadata?.buyerId || null;
          const connectAccountId = session.metadata?.connectAccountId || null;
          if (creatorId && buyerId) {
            const subId = session.subscription || null;
            const subDoc = {
              userId: String(buyerId),
              creatorId: String(creatorId),
              subscriptionId: subId,
              checkoutSessionId: session.id,
              currency: session.currency || 'usd',
              amount: session.amount_total || 1000,
              status: 'active',
              sellerAccountId: connectAccountId,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            };
            await adminDb.collection('legacySubscriptions').add(subDoc);
          }

          // Membership plan: mark user as active member and save subscription mapping
          const planType = session.metadata?.planType || null;
          const memberBuyerId = buyerId || session.client_reference_id || null;
          if ((planType === 'cca_membership_87' || planType === 'cca_monthly_37') && memberBuyerId) {
            try {
              await adminDb
                .collection('users')
                .doc(String(memberBuyerId))
                .set(
                  {
                    membershipActive: true,
                    membershipPlan: planType,
                    membershipSubscriptionId: String(session.subscription || ''),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
            } catch (e) {
              console.error('Failed to persist membership status on checkout.session.completed', e);
            }
          } else if ((planType === 'cca_membership_87' || planType === 'cca_monthly_37')) {
            // Guest checkout (no buyerId). Try to link by email, else record a pending membership.
            try {
              const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
              if (email && adminDb) {
                // Try to find an existing user with this email
                const uq = await adminDb.collection('users').where('email', '==', String(email)).limit(1).get();
                if (!uq.empty) {
                  const userId = uq.docs[0].id;
                  await adminDb
                    .collection('users')
                    .doc(String(userId))
                    .set(
                      {
                        membershipActive: true,
                        membershipPlan: planType,
                        membershipSubscriptionId: String(session.subscription || ''),
                        updatedAt: FieldValue.serverTimestamp(),
                      },
                      { merge: true }
                    );
                } else {
                  // Save pending claim for auto-link on first sign-in
                  await adminDb
                    .collection('pendingMemberships')
                    .doc(String(session.id))
                    .set({
                      email: String(email),
                      planType,
                      subscriptionId: String(session.subscription || ''),
                      sessionId: String(session.id),
                      claimed: false,
                      createdAt: FieldValue.serverTimestamp(),
                    });
                }
              }
            } catch (e) {
              console.error('Failed to record guest membership claim info', e);
            }
          }

          // Send welcome email (idempotent by session)
          try {
            const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
            if (email && (planType === 'cca_membership_87' || planType === 'cca_monthly_37') && adminDb && adminAuth) {
              const docRef = adminDb.collection('emails').doc(`welcome_${String(session.id)}`);
              const sent = await docRef.get();
              if (!sent.exists) {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
                const resetUrl = await adminAuth.generatePasswordResetLink(String(email), { url: `${baseUrl}/login` });
                const templateId = process.env.EMAILJS_TEMPLATE_ID || 'template_a8qgjpy';
                await sendEmailJS(String(templateId), {
                  // Template variables
                  user_name: session.customer_details?.name || '',
                  customer_email: String(email),
                  reset_url: resetUrl,
                  plan_name: planType === 'cca_membership_87' ? 'CCA All‑Access Membership' : 'CCA Monthly Membership',
                  year: new Date().getFullYear().toString(),
                  // Common aliases some templates expect
                  to_email: String(email),
                  name: 'Course Creator Academy'
                });
                await docRef.set({ createdAt: FieldValue.serverTimestamp() });
              }
            }
          } catch (e) {
            console.error('Failed to send welcome email:', e);
          }
        } else {
          // Marketplace order (existing)
          // Since checkout is created on platform account, get seller account ID from metadata or payment intent transfer
          let sellerAccountId = event.account || session.metadata?.sellerAccountId || null;
          if (!sellerAccountId && session.payment_intent) {
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
              sellerAccountId = paymentIntent.transfer_data?.destination || null;
            } catch (e) {
              console.error('Failed to fetch payment intent for seller account ID:', e);
            }
          }
          
          const now = Date.now();
          const deadlineMs = 72 * 60 * 60 * 1000; // 72h
          const order = {
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent || null,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            application_fee_amount: Number(session.metadata?.applicationFeeAmount || 0),
            listingId: session.metadata?.listingId || null,
            listingTitle: session.metadata?.listingTitle || null,
            buyerId: session.metadata?.buyerId || null,
            sellerId: session.metadata?.sellerId || null,
            customerId: session.customer || null,
            customerEmail: (session.customer_details && session.customer_details.email) || session.customer_email || null,
            sellerAccountId: sellerAccountId,
            shippingDetails: session.shipping_details || null,
            status: 'awaiting_tracking',
            createdAt: FieldValue.serverTimestamp(),
            trackingDeadlineAtMs: now + deadlineMs,
          };
          await adminDb.collection('orders').add(order);
        }
      } catch (err) {
        console.error('Webhook handling error (checkout.session.completed):', err);
      }
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription || null;
      const invoiceId = invoice.id;
      const currency = invoice.currency || 'usd';
      // Only handle Legacy+ subs created on platform
      try {
        if (adminDb && subscriptionId) {
          // Idempotency: skip if payout already recorded for this invoice
          const existing = await adminDb.collection('legacyPayouts').doc(String(invoiceId)).get();
          if (existing.exists) break;

          // Lookup subscription mapping
          const q = await adminDb
            .collection('legacySubscriptions')
            .where('subscriptionId', '==', String(subscriptionId))
            .limit(1)
            .get();
          if (!q.empty) {
            const sub = q.docs[0].data() as any;
            const destination = sub.sellerAccountId || null;
            if (destination) {
              const chargeId = await resolveChargeId(invoice);
              // Transfer fixed $7 to the legacy creator (platform retains $3 of the $10 plan)
              await stripe.transfers.create({
                amount: 700,
                currency,
                destination: String(destination),
                ...(chargeId ? { source_transaction: chargeId } : {}),
                metadata: {
                  reason: 'Legacy+ monthly payout',
                  subscriptionId: String(subscriptionId),
                  invoiceId: String(invoiceId),
                  creatorId: String(sub.creatorId || ''),
                },
              });
              // Mark payout recorded
              await adminDb
                .collection('legacyPayouts')
                .doc(String(invoiceId))
                .set({
                  subscriptionId: String(subscriptionId),
                  creatorId: String(sub.creatorId || ''),
                  destination: String(destination),
                  amount: 700,
                  currency,
                  createdAt: FieldValue.serverTimestamp(),
                });
            }
          }

          // If not a single-creator legacy sub, check $87 membership plan and pay all legacy creators
          if (adminDb) {
            // Retrieve the subscription to check metadata
            let planType: string | null = null;
            try {
              const subscription = await stripe.subscriptions.retrieve(String(subscriptionId));
              planType = (subscription.metadata && (subscription.metadata as any).planType) || null;
            } catch (e) {}

            if (planType === 'cca_membership_87') {
              const creatorsSnap = await adminDb.collection('legacy_creators').get();
              const recipients: Array<{ id: string; destination: string }> = [];
              creatorsSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
                const data = doc.data() as any;
                const dest = data?.connectAccountId;
                if (dest) recipients.push({ id: doc.id, destination: String(dest) });
              });

              // Create transfers of $3 to each legacy creator
              const chargeId = await resolveChargeId(invoice);
              await Promise.all(
                recipients.map((r) =>
                  stripe.transfers.create({
                    amount: 300,
                    currency,
                    destination: r.destination,
                    ...(chargeId ? { source_transaction: chargeId } : {}),
                    metadata: {
                      reason: 'CCA Membership monthly payout',
                      subscriptionId: String(subscriptionId),
                      invoiceId: String(invoiceId),
                      legacyCreatorId: r.id,
                    },
                  })
                )
              );

              // Record idempotency with recipients
              await adminDb
                .collection('legacyPayouts')
                .doc(String(invoiceId))
                .set({
                  subscriptionId: String(subscriptionId),
                  planType,
                  recipients,
                  perCreatorAmount: 300,
                  totalAmount: 300 * recipients.length,
                  currency,
                  createdAt: FieldValue.serverTimestamp(),
                });
            }
          }
        }
      } catch (err) {
        console.error('Failed to process legacy+ payout on invoice.payment_succeeded', err);
      }
      break;
    }
    // Stripe started emitting `invoice.paid` as the canonical event for paid invoices.
    // Handle it the same way as `invoice.payment_succeeded` so our payouts always run.
    case 'invoice.paid': {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription || null;
      const invoiceId = invoice.id;
      const currency = invoice.currency || 'usd';
      try {
        if (adminDb && subscriptionId) {
          const existing = await adminDb.collection('legacyPayouts').doc(String(invoiceId)).get();
          if (existing.exists) break;

          const q = await adminDb
            .collection('legacySubscriptions')
            .where('subscriptionId', '==', String(subscriptionId))
            .limit(1)
            .get();
          if (!q.empty) {
            const sub = q.docs[0].data() as any;
            const destination = sub.sellerAccountId || null;
            if (destination) {
              const chargeId = await resolveChargeId(invoice);
              await stripe.transfers.create({
                amount: 300,
                currency,
                destination: String(destination),
                ...(chargeId ? { source_transaction: chargeId } : {}),
                metadata: {
                  reason: 'Legacy+ monthly payout',
                  subscriptionId: String(subscriptionId),
                  invoiceId: String(invoiceId),
                  creatorId: String(sub.creatorId || ''),
                },
              });
              await adminDb
                .collection('legacyPayouts')
                .doc(String(invoiceId))
                .set({
                  subscriptionId: String(subscriptionId),
                  creatorId: String(sub.creatorId || ''),
                  destination: String(destination),
                  amount: 300,
                  currency,
                  createdAt: FieldValue.serverTimestamp(),
                });
              break;
            }
          }

          // Membership plan fan-out ($87 plan)
          let planType: string | null = null;
          try {
            const subscription = await stripe.subscriptions.retrieve(String(subscriptionId));
            planType = (subscription.metadata && (subscription.metadata as any).planType) || null;
          } catch (e) {}

          if (planType === 'cca_membership_87') {
            const creatorsSnap = await adminDb.collection('legacy_creators').get();
            const recipients: Array<{ id: string; destination: string }> = [];
            creatorsSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
              const data = doc.data() as any;
              const dest = data?.connectAccountId;
              if (dest) recipients.push({ id: doc.id, destination: String(dest) });
            });
            const chargeId = await resolveChargeId(invoice);
            await Promise.all(
              recipients.map((r) =>
                stripe.transfers.create({
                  amount: 300,
                  currency,
                  destination: r.destination,
                  ...(chargeId ? { source_transaction: chargeId } : {}),
                  metadata: {
                    reason: 'CCA Membership monthly payout',
                    subscriptionId: String(subscriptionId),
                    invoiceId: String(invoiceId),
                    legacyCreatorId: r.id,
                  },
                })
              )
            );
            await adminDb
              .collection('legacyPayouts')
              .doc(String(invoiceId))
              .set({
                subscriptionId: String(subscriptionId),
                planType,
                recipients,
                perCreatorAmount: 300,
                totalAmount: 300 * recipients.length,
                currency,
                createdAt: FieldValue.serverTimestamp(),
              });
          }
        }
      } catch (err) {
        console.error('Failed to process legacy+ payout on invoice.paid', err);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log('customer.subscription.updated', { account: event.account, id: sub.id, status: sub.status });
      try {
        if (adminDb) {
          const q = await adminDb.collection('legacySubscriptions').where('subscriptionId', '==', sub.id).limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.set({ status: sub.status || 'active', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }

          // Keep membership flag in sync for CCA Membership plan
          const planType = (sub.metadata && (sub.metadata as any).planType) || null;
          const buyerId = (sub.metadata && (sub.metadata as any).buyerId) || null;
          const active = ['active', 'trialing'].includes(String(sub.status || ''));
          if (planType === 'cca_membership_87' || planType === 'cca_monthly_37') {
            let userIdToUpdate: string | null = buyerId ? String(buyerId) : null;
            if (!userIdToUpdate) {
              try {
                const uq = await adminDb
                  .collection('users')
                  .where('membershipSubscriptionId', '==', String(sub.id))
                  .limit(1)
                  .get();
                if (!uq.empty) userIdToUpdate = uq.docs[0].id;
              } catch {}
            }
            if (userIdToUpdate) {
              await adminDb
                .collection('users')
                .doc(userIdToUpdate)
                .set(
                  {
                    membershipActive: active,
                    membershipPlan: planType,
                    membershipSubscriptionId: String(sub.id),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
            }
          }
        }
      } catch (err) {
        console.error('Failed to update legacySubscription on sub.update', err);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('customer.subscription.deleted', { account: event.account, id: sub.id, status: sub.status });
      try {
        if (adminDb) {
          const q = await adminDb.collection('legacySubscriptions').where('subscriptionId', '==', sub.id).limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.set({ status: 'canceled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }

          // Deactivate membership for CCA Membership plan
          const planType = (sub.metadata && (sub.metadata as any).planType) || null;
          const buyerId = (sub.metadata && (sub.metadata as any).buyerId) || null;
          if (planType === 'cca_membership_87' || planType === 'cca_monthly_37') {
            let userIdToUpdate: string | null = buyerId ? String(buyerId) : null;
            if (!userIdToUpdate) {
              try {
                const uq = await adminDb
                  .collection('users')
                  .where('membershipSubscriptionId', '==', String(sub.id))
                  .limit(1)
                  .get();
                if (!uq.empty) userIdToUpdate = uq.docs[0].id;
              } catch {}
            }
            if (userIdToUpdate) {
              await adminDb
                .collection('users')
                .doc(userIdToUpdate)
                .set(
                  {
                    membershipActive: false,
                    membershipPlan: planType,
                    membershipSubscriptionId: String(sub.id),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
            }
          }
        }
      } catch (err) {
        console.error('Failed to update legacySubscription on sub.delete', err);
      }
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as any;
      console.log('payment_intent.succeeded', {
        isConnectEvent,
        account: event.account,
        payment_intent: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        application_fee_amount: pi.application_fee_amount,
        metadata: pi.metadata
      });

      // Handle job deposit payments
      if (pi.metadata?.type === 'job_deposit' && adminDb) {
        try {
          const applicationId = pi.metadata?.applicationId;
          if (applicationId) {
            const applicationDoc = await adminDb.collection('jobApplications').doc(String(applicationId)).get();
            if (applicationDoc.exists) {
              const appData = applicationDoc.data();
              // Mark deposit as paid and store payment intent ID
              await adminDb.collection('jobApplications').doc(String(applicationId)).update({
                depositPaid: true,
                depositPaidAt: FieldValue.serverTimestamp(),
                depositPaymentIntentId: pi.id,
                updatedAt: FieldValue.serverTimestamp()
              });
              console.log('Job deposit payment processed:', applicationId, 'PaymentIntent:', pi.id);
            }
          }
        } catch (err) {
          console.error('Error processing job deposit payment:', err);
        }
      }

      // Handle job final payments
      if (pi.metadata?.type === 'job_final_payment' && adminDb) {
        try {
          const applicationId = pi.metadata?.applicationId;
          if (applicationId) {
            const applicationDoc = await adminDb.collection('jobApplications').doc(String(applicationId)).get();
            if (!applicationDoc.exists) {
              console.error('Application not found for final payment:', applicationId);
              break;
            }

            const appData = applicationDoc.data();
            const applicantConnectAccountId = appData?.applicantConnectAccountId || pi.metadata?.applicantConnectAccountId;
            const depositAmount = appData?.depositAmount || parseInt(pi.metadata?.depositAmount || '0');
            const depositPlatformFee = appData?.platformFee || 0;
            // Use remainingAmount from metadata if available, otherwise from appData, otherwise from payment intent
            const remainingAmount = parseInt(pi.metadata?.remainingAmount || '0') || appData?.remainingAmount || pi.amount || 0;
            const remainingPlatformFee = parseInt(pi.metadata?.platformFee || '0') || computeApplicationFeeAmount(remainingAmount);
            
            // Calculate amounts to transfer
            // Deposit transfer: depositAmount - depositPlatformFee (already held in platform account)
            const depositTransferAmount = depositAmount - depositPlatformFee;
            // Remaining transfer: remainingAmount - remainingPlatformFee
            const remainingTransferAmount = remainingAmount - remainingPlatformFee;
            const totalTransferAmount = depositTransferAmount + remainingTransferAmount;

            if (!applicantConnectAccountId) {
              console.error('Applicant Connect account ID not found for final payment:', applicationId);
              break;
            }

            // Get the charge IDs for both the deposit and the final payment
            // Use each respective charge as source_transaction for its transfer
            const finalPi = await stripe.paymentIntents.retrieve(pi.id, { expand: ['latest_charge'] });
            const finalLatestCharge = (finalPi as any).latest_charge;
            const finalChargeId = typeof finalLatestCharge === 'string' ? finalLatestCharge : finalLatestCharge?.id;

            let depositChargeId: string | null = null;
            const depositPiId = appData?.depositPaymentIntentId;
            if (depositPiId) {
              try {
                const depositPi = await stripe.paymentIntents.retrieve(String(depositPiId), { expand: ['latest_charge'] });
                const depositLatestCharge = (depositPi as any).latest_charge;
                depositChargeId = typeof depositLatestCharge === 'string' ? depositLatestCharge : depositLatestCharge?.id || null;
              } catch (err) {
                console.warn('Could not retrieve deposit PaymentIntent or charge for application', applicationId, err);
              }
            }

            // Transfer deposit (held in escrow) to applicant
            if (depositTransferAmount > 0) {
              await stripe.transfers.create({
                amount: depositTransferAmount,
                currency: 'usd',
                destination: String(applicantConnectAccountId),
                // Prefer linking to the original deposit charge; if not available, omit source_transaction
                ...(depositChargeId ? { source_transaction: String(depositChargeId) } : {}),
                metadata: {
                  type: 'job_payment_deposit',
                  applicationId: String(applicationId),
                  opportunityId: String(appData?.opportunityId || ''),
                  posterId: String(appData?.posterId || ''),
                  applicantId: String(appData?.applicantId || '')
                }
              });
            }

            // Transfer remaining amount to applicant
            if (remainingTransferAmount > 0) {
              await stripe.transfers.create({
                amount: remainingTransferAmount,
                currency: 'usd',
                destination: String(applicantConnectAccountId),
                ...(finalChargeId ? { source_transaction: String(finalChargeId) } : {}),
                metadata: {
                  type: 'job_payment_remaining',
                  applicationId: String(applicationId),
                  opportunityId: String(appData?.opportunityId || ''),
                  posterId: String(appData?.posterId || ''),
                  applicantId: String(appData?.applicantId || '')
                }
              });
            }

            // Update application status
            await adminDb.collection('jobApplications').doc(String(applicationId)).update({
              status: 'paid',
              finalPaymentPaid: true,
              finalPaymentPaidAt: FieldValue.serverTimestamp(),
              totalTransferAmount,
              updatedAt: FieldValue.serverTimestamp()
            });

            console.log('Job final payment processed and transferred:', {
              applicationId,
              totalTransferAmount,
              depositTransferAmount,
              remainingTransferAmount
            });
          }
        } catch (err) {
          console.error('Error processing job final payment:', err);
        }
      }

      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      console.warn('payment_intent.payment_failed', { isConnectEvent, account: event.account, payment_intent: pi.id });
      break;
    }
    case 'charge.dispute.created': {
      console.warn('charge.dispute.created', { isConnectEvent, account: event.account });
      break;
    }
    case 'charge.refunded': {
      console.log('charge.refunded', { isConnectEvent, account: event.account });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

export const dynamic = 'force-dynamic';


