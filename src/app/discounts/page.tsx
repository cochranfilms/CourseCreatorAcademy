export default function DiscountsPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Member Discounts</h1>
      <p className="text-neutral-400 mt-2">Exclusive partner deals for CCA members.</p>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="text-lg font-semibold">Partner {i}</div>
            <div className="text-neutral-400 text-sm">Save up to 20% on gear and software.</div>
            <button className="mt-4 px-4 py-2 rounded-lg bg-ccaBlue">Redeem</button>
          </div>
        ))}
      </div>
    </main>
  );
}


