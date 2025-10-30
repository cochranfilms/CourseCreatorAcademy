export function Trustbar() {
  return (
    <div className="border-y border-neutral-900 bg-black/40 w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 text-center text-neutral-200 sm:text-neutral-400 text-sm w-full">
        {['Canon','DJI','Sony','Adobe','RED','Blackmagic'].map((c)=> (
          <div key={c} className="opacity-70 hover:opacity-100 transition font-medium">{c}</div>
        ))}
      </div>
    </div>
  );
}


