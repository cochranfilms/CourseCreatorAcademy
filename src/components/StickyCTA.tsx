"use client";
import { useEffect, useState } from 'react';

export function StickyCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleJoin = async () => {
    const res = await fetch('/api/checkout/course', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div className={`fixed bottom-4 left-0 right-0 px-4 transition ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="max-w-3xl mx-auto bg-neutral-950/90 border border-neutral-800 rounded-2xl p-3 flex items-center justify-between backdrop-blur">
        <div className="text-sm text-neutral-300">Join CCA today — full access to all courses and community.</div>
        <button className="cta-button" onClick={handleJoin}>Join Now</button>
      </div>
    </div>
  );
}


