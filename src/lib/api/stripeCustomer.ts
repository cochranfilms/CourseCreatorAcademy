import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';

export async function getOrCreateCustomer(userId: string, email?: string): Promise<string> {
  if (!adminDb) throw new Error('Server not configured');
  const userDoc = await adminDb.collection('users').doc(userId).get();
  const data = userDoc.data() || {};
  let customerId: string | undefined = data.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email || data.email || undefined,
      metadata: { userId }
    });
    customerId = customer.id;
    await adminDb.collection('users').doc(userId).update({ stripeCustomerId: customerId });
  }
  return customerId!;
}


