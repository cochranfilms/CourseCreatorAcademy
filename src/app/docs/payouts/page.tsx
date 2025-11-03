"use client";

export default function PayoutsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Payouts</h1>

      <section className="space-y-4 text-neutral-300">
        <p>
          Sellers are paid out via <span className="font-semibold text-white">Stripe Express</span>. Payouts are
          configured and managed in your Stripe Express Dashboard. CCA does not hold funds.
        </p>

        <div className="border border-neutral-800 bg-neutral-950 p-4">
          <h2 className="text-lg font-semibold mb-2 text-white">Schedule</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Common intervals: daily, weekly, monthly, or manual (varies by country/account).</li>
            <li>Stripe may apply a rolling delay (e.g., 2–7 days) depending on risk and region.</li>
            <li>Update your payout schedule and bank details in your Express Dashboard.</li>
          </ul>
        </div>

        <div className="border border-neutral-800 bg-neutral-950 p-4">
          <h2 className="text-lg font-semibold mb-2 text-white">Eligibility</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Complete onboarding and required verifications (KYC).</li>
            <li>Ensure <span className="font-mono">charges_enabled</span> and <span className="font-mono">payouts_enabled</span> are true.</li>
            <li>Resolve any <span className="font-mono">requirements.currently_due/past_due</span> shown in onboarding.</li>
          </ul>
        </div>

        <p className="text-sm text-neutral-500">
          Tax forms (e.g., 1099-K in the U.S.) are issued by Stripe Express, not CCA.
        </p>
      </section>
    </main>
  );
}


