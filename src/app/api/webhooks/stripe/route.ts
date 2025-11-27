import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendEmailJS } from '@/lib/email';
import { computeApplicationFeeAmount } from '@/lib/fees';
import { createJobNotification, createOrderNotification } from '@/lib/notifications';

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
            
            const applicationDoc = await adminDb.collection('jobApplications').doc(String(applicationId)).get();
            if (applicationDoc.exists) {
              const appData = applicationDoc.data();
              
              await adminDb.collection('jobApplications').doc(String(applicationId)).update({
                depositPaid: true,
                depositPaidAt: FieldValue.serverTimestamp(),
                depositCheckoutSessionId: session.id,
                depositPaymentIntentId: String(paymentIntentId),
                updatedAt: FieldValue.serverTimestamp()
              });
              console.log('Job deposit checkout completed:', applicationId, 'PaymentIntent:', paymentIntentId);

              // Send email notification to contractor (idempotent)
              try {
                const emailSentRef = adminDb.collection('emails').doc(`deposit_paid_${String(applicationId)}`);
                const emailSent = await emailSentRef.get();
                
                console.log('[checkout.session.completed] Checking email send conditions:', {
                  emailAlreadySent: emailSent.exists,
                  applicantId: appData?.applicantId,
                  emailInAppData: appData?.email,
                });
                
                if (!emailSent.exists && appData?.applicantId) {
                  // Get contractor user data
                  const contractorDoc = await adminDb.collection('users').doc(String(appData.applicantId)).get();
                  const contractorData = contractorDoc.exists ? contractorDoc.data() : null;
                  
                  // Get contractor email - prefer from application, fallback to user document
                  const contractorEmail = appData?.email || contractorData?.email;
                  
                  if (!contractorEmail) {
                    console.error('[checkout.session.completed] No email found for contractor:', {
                      applicationId,
                      applicantId: appData?.applicantId,
                      emailInAppData: appData?.email,
                      emailInUserDoc: contractorData?.email,
                    });
                  } else {
                    // Get employer user data
                    const employerDoc = appData?.posterId 
                      ? await adminDb.collection('users').doc(String(appData.posterId)).get()
                      : null;
                    const employerData = employerDoc?.exists ? employerDoc.data() : null;

                    const templateId = 'template_3luyirf';
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
                    const depositAmount = appData?.depositAmount 
                      ? (typeof appData.depositAmount === 'number' ? appData.depositAmount / 100 : parseFloat(String(appData.depositAmount)) / 100)
                      : 0;

                    console.log('[checkout.session.completed] Sending deposit paid email:', {
                      templateId,
                      contractorEmail,
                      contractorName: appData?.name || contractorData?.displayName,
                      jobTitle: appData?.opportunityTitle,
                      depositAmount,
                    });

                    try {
                      await sendEmailJS(templateId, {
                        contractor_name: appData?.name || contractorData?.displayName || 'Contractor',
                        job_title: appData?.opportunityTitle || 'Job Opportunity',
                        company_name: appData?.opportunityCompany || 'Company',
                        employer_name: employerData?.displayName || employerData?.handle || 'Employer',
                        deposit_amount: depositAmount.toFixed(2),
                        dashboard_url: `${baseUrl}/dashboard`,
                        to_email: String(contractorEmail),
                        year: new Date().getFullYear().toString(),
                      });
                      
                      // Mark email as sent
                      await emailSentRef.set({ 
                        createdAt: FieldValue.serverTimestamp(),
                        applicationId: String(applicationId)
                      });
                      console.log('[checkout.session.completed] ✅ Deposit paid email sent successfully to contractor:', contractorEmail);
                      
                      // Create in-app notification for contractor
                      try {
                        await createJobNotification(String(appData.applicantId), 'job_deposit_paid', {
                          jobTitle: appData?.opportunityTitle || 'Job Opportunity',
                          companyName: appData?.opportunityCompany || '',
                          applicationId: String(applicationId),
                          amount: depositAmount * 100, // Convert to cents
                        });
                      } catch (notifErr) {
                        console.error('[checkout.session.completed] Error creating deposit paid notification:', notifErr);
                      }
                    } catch (emailSendErr: any) {
                      console.error('[checkout.session.completed] ❌ Failed to send deposit paid email via EmailJS:', {
                        error: emailSendErr?.message || emailSendErr,
                        stack: emailSendErr?.stack,
                        templateId,
                        contractorEmail,
                      });
                    }
                  }
                } else {
                  console.log('[checkout.session.completed] Email not sent - conditions not met:', {
                    emailAlreadySent: emailSent.exists,
                    missingApplicantId: !appData?.applicantId,
                  });
                }
              } catch (emailErr: any) {
                console.error('[checkout.session.completed] ❌ Error in deposit paid email handler:', {
                  error: emailErr?.message || emailErr,
                  stack: emailErr?.stack,
                  applicationId,
                });
              }
            }
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

      // Handle plan upgrade checkout completion (payment mode, not subscription mode)
      // This is a backup handler - payment_intent.succeeded should also handle this
      if (session.metadata?.action === 'upgrade_plan' && session.metadata?.subscriptionId && session.metadata?.newPlanType && adminDb) {
        try {
          const subscriptionId = session.metadata.subscriptionId;
          const newPlanType = session.metadata.newPlanType;
          const buyerId = session.metadata.buyerId || session.client_reference_id;

          console.log('[checkout.session.completed] Processing plan upgrade:', {
            subscriptionId,
            newPlanType,
            buyerId,
            paymentIntent: session.payment_intent,
          });

          // Update subscription in Stripe
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const currentItem = subscription.items.data[0];
          
          if (!currentItem) {
            console.error('[checkout.session.completed] No subscription items found for upgrade');
            break;
          }

          // Create or find product
          let product;
          const products = await stripe.products.list({ limit: 100 });
          product = products.data.find((p) => p.name === 'CCA Membership' || p.name?.includes('CCA'));
          
          if (!product) {
            product = await stripe.products.create({
              name: 'CCA Membership',
              description: 'Course Creator Academy membership plans',
            });
          }

          // Get plan price
          const planPrices: Record<string, number> = {
            cca_monthly_37: 3700,
            cca_no_fees_60: 6000,
            cca_membership_87: 8700,
          };
          const newPrice = planPrices[newPlanType];
          
          if (!newPrice) {
            console.error('[checkout.session.completed] Invalid plan type for upgrade:', newPlanType);
            break;
          }

          // Create new price
          const price = await stripe.prices.create({
            currency: 'usd',
            unit_amount: newPrice,
            recurring: { interval: 'month' },
            product: product.id,
            metadata: {
              planType: newPlanType,
            },
          });

          // Update the subscription to the new plan
          const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            items: [{
              id: currentItem.id,
              price: price.id,
            }],
            proration_behavior: 'always_invoice',
            metadata: {
              planType: newPlanType,
              buyerId: buyerId || '',
            },
          });

          console.log('[checkout.session.completed] Subscription updated in Stripe:', {
            subscriptionId,
            newPlanType,
            updatedSubscriptionId: updatedSubscription.id,
          });

          // Immediately update Firebase
          if (buyerId) {
            try {
              await adminDb
                .collection('users')
                .doc(String(buyerId))
                .set(
                  {
                    membershipActive: true,
                    membershipPlan: newPlanType,
                    membershipSubscriptionId: String(subscriptionId),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
              console.log('[checkout.session.completed] Firebase updated with new plan:', { buyerId, newPlanType });
            } catch (firebaseErr: any) {
              console.error('[checkout.session.completed] Failed to update Firebase after upgrade:', firebaseErr);
            }
          }
        } catch (err: any) {
          console.error('[checkout.session.completed] Failed to process plan upgrade:', err);
          // Don't break - let payment_intent.succeeded handle it as backup
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
          if ((planType === 'cca_membership_87' || planType === 'cca_monthly_37' || planType === 'cca_no_fees_60') && memberBuyerId) {
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
          } else if ((planType === 'cca_membership_87' || planType === 'cca_monthly_37' || planType === 'cca_no_fees_60')) {
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
            if (email && (planType === 'cca_membership_87' || planType === 'cca_monthly_37' || planType === 'cca_no_fees_60') && adminDb && adminAuth) {
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
                  plan_name: planType === 'cca_membership_87' ? 'CCA All‑Access Membership' : planType === 'cca_no_fees_60' ? 'CCA No-Fees Membership' : 'CCA Monthly Membership',
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
          const orderRef = await adminDb.collection('orders').add(order);
          
          // Create notifications for buyer and seller
          try {
            // Notification for seller (new order received)
            if (order.sellerId) {
              // Get buyer name
              const buyerDoc = order.buyerId 
                ? await adminDb.collection('users').doc(String(order.buyerId)).get()
                : null;
              const buyerData = buyerDoc?.exists ? buyerDoc.data() : null;
              const buyerName = buyerData?.displayName || buyerData?.handle || buyerData?.email?.split('@')[0] || 'A customer';

              await createOrderNotification(String(order.sellerId), 'order_placed', {
                orderId: orderRef.id,
                listingTitle: order.listingTitle || 'Product',
                amount: order.amount,
                buyerName,
              });
            }

            // Notification for buyer (order placed confirmation)
            if (order.buyerId) {
              await createOrderNotification(String(order.buyerId), 'order_delivered', {
                orderId: orderRef.id,
                listingTitle: order.listingTitle || 'Product',
                amount: order.amount,
              });
            }
          } catch (notifErr) {
            console.error('Error creating order notifications:', notifErr);
            // Don't fail the webhook if notifications fail
          }
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
          if (planType === 'cca_membership_87' || planType === 'cca_monthly_37' || planType === 'cca_no_fees_60') {
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
          if (planType === 'cca_membership_87' || planType === 'cca_monthly_37' || planType === 'cca_no_fees_60') {
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
        metadata: pi.metadata,
        // Also check if metadata exists but is empty
        hasMetadata: !!pi.metadata,
        metadataKeys: pi.metadata ? Object.keys(pi.metadata) : [],
      });

      // Handle plan upgrade payment
      // Check both payment intent metadata and try to retrieve from checkout session if needed
      let upgradeMetadata = pi.metadata;
      
      // If metadata is missing but we have a checkout session, try to get it from there
      if ((!upgradeMetadata || !upgradeMetadata.action) && pi.id) {
        try {
          // Try to find the checkout session that created this payment intent
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: pi.id,
            limit: 1,
          });
          if (sessions.data.length > 0) {
            const session = sessions.data[0];
            if (session.metadata?.action === 'upgrade_plan') {
              upgradeMetadata = session.metadata;
              console.log('[payment_intent.succeeded] Retrieved metadata from checkout session:', upgradeMetadata);
            }
          }
        } catch (sessionErr: any) {
          console.error('[payment_intent.succeeded] Failed to retrieve checkout session:', sessionErr);
        }
      }

      if (upgradeMetadata && upgradeMetadata.action === 'upgrade_plan' && upgradeMetadata.subscriptionId && upgradeMetadata.newPlanType) {
        try {
          const subscriptionId = upgradeMetadata.subscriptionId;
          const newPlanType = upgradeMetadata.newPlanType;
          const buyerId = upgradeMetadata.buyerId;

          console.log('[payment_intent.succeeded] Processing plan upgrade:', {
            subscriptionId,
            newPlanType,
            buyerId,
            paymentIntentId: pi.id,
            amount: pi.amount,
          });

          // Get the subscription
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const currentItem = subscription.items.data[0];
          
          if (!currentItem) {
            console.error('[payment_intent.succeeded] No subscription items found for upgrade');
            break;
          }

          // Check if subscription is already on the new plan (idempotency)
          const currentPlanType = subscription.metadata?.planType;
          if (currentPlanType === newPlanType) {
            console.log('[payment_intent.succeeded] Subscription already on target plan, skipping update:', {
              subscriptionId,
              newPlanType,
            });
            // Still update Firebase to ensure sync
            if (adminDb && buyerId) {
              try {
                await adminDb
                  .collection('users')
                  .doc(String(buyerId))
                  .set(
                    {
                      membershipActive: true,
                      membershipPlan: newPlanType,
                      membershipSubscriptionId: String(subscriptionId),
                      updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                  );
                console.log('[payment_intent.succeeded] Firebase synced (already on target plan):', { buyerId, newPlanType });
              } catch (firebaseErr: any) {
                console.error('[payment_intent.succeeded] Failed to sync Firebase:', firebaseErr);
              }
            }
            break;
          }

          // Create or find product
          let product;
          const products = await stripe.products.list({ limit: 100 });
          product = products.data.find((p) => p.name === 'CCA Membership' || p.name?.includes('CCA'));
          
          if (!product) {
            product = await stripe.products.create({
              name: 'CCA Membership',
              description: 'Course Creator Academy membership plans',
            });
          }

          // Get plan price
          const planPrices: Record<string, number> = {
            cca_monthly_37: 3700,
            cca_no_fees_60: 6000,
            cca_membership_87: 8700,
          };
          const newPrice = planPrices[newPlanType];
          
          if (!newPrice) {
            console.error('Invalid plan type for upgrade:', newPlanType);
            break;
          }

          // Create new price
          const price = await stripe.prices.create({
            currency: 'usd',
            unit_amount: newPrice,
            recurring: { interval: 'month' },
            product: product.id,
            metadata: {
              planType: newPlanType,
            },
          });

          // Now update the subscription to the new plan
          // This will create a proration invoice automatically
          const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            items: [{
              id: currentItem.id,
              price: price.id,
            }],
            proration_behavior: 'always_invoice', // Creates proration invoice
            metadata: {
              planType: newPlanType,
              buyerId: buyerId || '',
            },
          });

          // Immediately update Firebase to reflect the new plan
          // Don't wait for customer.subscription.updated webhook
          if (adminDb && buyerId) {
            try {
              await adminDb
                .collection('users')
                .doc(String(buyerId))
                .set(
                  {
                    membershipActive: true,
                    membershipPlan: newPlanType,
                    membershipSubscriptionId: String(subscriptionId),
                    updatedAt: FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
              console.log('Firebase updated with new plan:', { buyerId, newPlanType });
            } catch (firebaseErr: any) {
              console.error('Failed to update Firebase after upgrade:', firebaseErr);
              // Don't fail the whole operation if Firebase update fails
              // The customer.subscription.updated webhook will sync it eventually
            }
          }

          // The proration invoice will be created automatically
          // Stripe will attempt to charge it using the customer's default payment method
          // Since we already collected payment via checkout, the invoice should be paid
          // If not, it will be charged on the next billing cycle
          console.log('[payment_intent.succeeded] Subscription upgraded successfully:', {
            subscriptionId,
            newPlanType,
            updatedSubscriptionId: updatedSubscription.id,
            buyerId,
          });
        } catch (err: any) {
          console.error('[payment_intent.succeeded] Failed to upgrade subscription after payment:', {
            error: err.message,
            stack: err.stack,
            subscriptionId: pi.metadata?.subscriptionId,
            newPlanType: pi.metadata?.newPlanType,
            buyerId: pi.metadata?.buyerId,
          });
        }
      }

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

              // Send email notification to contractor (idempotent by checking if email was sent)
              try {
                const emailSentRef = adminDb.collection('emails').doc(`deposit_paid_${String(applicationId)}`);
                const emailSent = await emailSentRef.get();
                
                console.log('Checking email send conditions:', {
                  emailAlreadySent: emailSent.exists,
                  applicantId: appData?.applicantId,
                  emailInAppData: appData?.email,
                });
                
                if (!emailSent.exists && appData?.applicantId) {
                  // Get contractor user data
                  const contractorDoc = await adminDb.collection('users').doc(String(appData.applicantId)).get();
                  const contractorData = contractorDoc.exists ? contractorDoc.data() : null;
                  
                  // Get contractor email - prefer from application, fallback to user document
                  const contractorEmail = appData?.email || contractorData?.email;
                  
                  if (!contractorEmail) {
                    console.error('No email found for contractor:', {
                      applicationId,
                      applicantId: appData?.applicantId,
                      emailInAppData: appData?.email,
                      emailInUserDoc: contractorData?.email,
                    });
                  } else {
                    // Get employer user data
                    const employerDoc = appData?.posterId 
                      ? await adminDb.collection('users').doc(String(appData.posterId)).get()
                      : null;
                    const employerData = employerDoc?.exists ? employerDoc.data() : null;

                    const templateId = 'template_3luyirf'; // EmailJS template for deposit payment notification
                    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
                    const depositAmount = appData?.depositAmount 
                      ? (typeof appData.depositAmount === 'number' ? appData.depositAmount / 100 : parseFloat(String(appData.depositAmount)) / 100)
                      : 0;

                    console.log('Sending deposit paid email:', {
                      templateId,
                      contractorEmail,
                      contractorName: appData?.name || contractorData?.displayName,
                      jobTitle: appData?.opportunityTitle,
                      depositAmount,
                    });

                    try {
                      await sendEmailJS(templateId, {
                        contractor_name: appData?.name || contractorData?.displayName || 'Contractor',
                        job_title: appData?.opportunityTitle || 'Job Opportunity',
                        company_name: appData?.opportunityCompany || 'Company',
                        employer_name: employerData?.displayName || employerData?.handle || 'Employer',
                        deposit_amount: depositAmount.toFixed(2),
                        dashboard_url: `${baseUrl}/dashboard`,
                        to_email: String(contractorEmail),
                        year: new Date().getFullYear().toString(),
                      });
                      
                      // Mark email as sent
                      await emailSentRef.set({ 
                        createdAt: FieldValue.serverTimestamp(),
                        applicationId: String(applicationId)
                      });
                      console.log('✅ Deposit paid email sent successfully to contractor:', contractorEmail);
                    } catch (emailSendErr: any) {
                      console.error('❌ Failed to send deposit paid email via EmailJS:', {
                        error: emailSendErr?.message || emailSendErr,
                        stack: emailSendErr?.stack,
                        templateId,
                        contractorEmail,
                      });
                    }
                  }
                } else {
                  console.log('Email not sent - conditions not met:', {
                    emailAlreadySent: emailSent.exists,
                    missingApplicantId: !appData?.applicantId,
                  });
                }
              } catch (emailErr: any) {
                // Don't fail the webhook if email fails
                console.error('❌ Error in deposit paid email handler:', {
                  error: emailErr?.message || emailErr,
                  stack: emailErr?.stack,
                  applicationId,
                });
              }
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
            // No platform fee taken on final payment (fee only on deposit)
            const remainingPlatformFee = 0;
            
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

            // Create notification for contractor (final payment received)
            try {
              await createJobNotification(String(appData?.applicantId), 'job_final_payment_paid', {
                jobTitle: appData?.opportunityTitle || 'Job Opportunity',
                companyName: appData?.opportunityCompany || '',
                applicationId: String(applicationId),
                amount: remainingAmount, // Amount in cents
              });
            } catch (notifErr) {
              console.error('Error creating final payment notification:', notifErr);
            }

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


