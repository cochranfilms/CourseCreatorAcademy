export function Trustbar() {
  return (
    <div className="border-y border-neutral-900 bg-black/40">
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 text-center text-neutral-400 text-sm">
        {['Canon','DJI','Sony','Adobe','RED','Blackmagic'].map((c)=> (
          <div key={c} className="opacity-70 hover:opacity-100 transition">{c}</div>
        ))}
      </div>
    </div>
  );
}


