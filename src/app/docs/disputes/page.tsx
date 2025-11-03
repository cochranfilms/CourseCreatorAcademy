"use client";

export default function DisputesPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Disputes</h1>

      <section className="space-y-4 text-neutral-300">
        <p>
          Disputes (chargebacks) are handled by Stripe. When a buyer disputes a charge, Stripe notifies both
          the seller (via the Express Dashboard) and the platform via webhooks.
        </p>

        <div className="border border-neutral-800 bg-neutral-950 p-4">
          <h2 className="text-lg font-semibold mb-2 text-white">What sellers should do</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Respond in your Stripe Express Dashboard by the stated deadline.</li>
            <li>Provide evidence: item description, order ID, buyer communication, and tracking/delivery proof.</li>
            <li>If shipped, include carrier, tracking number, and delivery confirmation screens.</li>
          </ul>
        </div>

        <div className="border border-neutral-800 bg-neutral-950 p-4">
          <h2 className="text-lg font-semibold mb-2 text-white">Platform policy</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>CCA charges a 3% platform fee; dispute fees (if any) are assessed by Stripe.</li>
            <li>Repeated disputes or policy violations may affect selling privileges.</li>
            <li>Questions? Contact support with your Payment Intent ID or Checkout Session ID.</li>
          </ul>
        </div>

        <p className="text-sm text-neutral-500">
          Tip: Use tracked shipping and upload tracking within 72 hours to reduce disputes.
        </p>
      </section>
    </main>
  );
}


