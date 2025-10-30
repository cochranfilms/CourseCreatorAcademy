const packs = new Array(9).fill(0).map((_, i) => ({
  id: i + 1,
  title: ['Sleektone Minimal LUTs', 'Cinematic Flares Vol.1', 'Flash & Pop SFX'][i % 3],
  type: ['LUTs & Presets', 'Overlays & Transitions', 'SFX & Plugins'][i % 3]
}));

export default function AssetsPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">OVERLAY+</h1>
      <p className="text-neutral-400">Thousands of premium assets & templates.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {['All Packs','LUTs & Presets','Overlays & Transitions','SFX & Plugins','Templates'].map((t, i) => (
          <button key={t} className={`px-3 py-1.5 rounded-full text-sm ${i===0?'bg-ccaBlue':'bg-neutral-900 border border-neutral-800'}`}>{t}</button>
        ))}
      </div>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {packs.map((p) => (
          <div key={p.id} className="rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
            <div className="h-44 bg-neutral-800" />
            <div className="p-4">
              <div className="font-semibold">{p.title}</div>
              <div className="text-sm text-neutral-400">{p.type}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}


