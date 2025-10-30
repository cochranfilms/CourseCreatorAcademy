"use client";
import { useState } from 'react';

export function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
          <button onClick={()=> setOpen(open===idx?null:idx)} className="w-full text-left px-5 py-4 font-semibold flex justify-between items-center">
            <span>{it.q}</span>
            <span className="text-neutral-400">{open===idx ? '-' : '+'}</span>
          </button>
          {open===idx && (
            <div className="px-5 pb-5 text-neutral-300 text-sm">{it.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}


