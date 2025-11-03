"use client";

export default function FeesPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Marketplace Fees</h1>

      <section className="space-y-4 text-neutral-300">
        <p>
          CCA charges a platform fee of <span className="font-semibold text-white">3%</span> per successful sale.
          The remainder is paid directly to the seller’s Stripe Express account. Stripe processing fees are
          borne by the seller and are charged by Stripe separately.
        </p>

        <div className="border border-neutral-800 bg-neutral-950 p-4">
          <h2 className="text-lg font-semibold mb-2 text-white">How the fee is collected</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>CCA uses Stripe Connect Express with Direct Charges.</li>
            <li>An application fee equal to 3% of the order total is applied to the Payment Intent.</li>
            <li>Stripe transfers the platform fee to CCA and the net proceeds to the seller.</li>
          </ul>
        </div>

        <div className="border border-neutral-800 bg-neutral-950 p-4">
          <h2 className="text-lg font-semibold mb-2 text-white">Example</h2>
          <p>
            If an item sells for $100 (plus any shipping the seller charges):
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>CCA fee (3%): $3.00</li>
            <li>Stripe processing fees: charged by Stripe (varies by card, country, etc.)</li>
            <li>Seller receives: $100 - CCA fee - Stripe fees</li>
          </ul>
        </div>

        <p className="text-sm text-neutral-500">
          Note: In Test Mode, you can simulate charges using Stripe test cards. In Live Mode, real fees apply.
        </p>
      </section>
    </main>
  );
}


