export default function HomePage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Good evening, Creator.</h1>
      <p className="text-neutral-400 mt-2">Welcome back to Course Creator Academy.</p>

      <section className="mt-8 grid md:grid-cols-3 gap-6">
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="text-xs text-neutral-400">Recently Added</div>
            <div className="mt-2 text-lg font-semibold">Lesson {i}: Building Creative Momentum</div>
            <div className="mt-2 text-sm text-neutral-400">Watch now →</div>
          </div>
        ))}
      </section>
    </main>
  );
}


