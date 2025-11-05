"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function StickyCTA() {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleJoin = async () => {
    try {
      if (!user) { window.location.href = '/login'; return; }
      const res = await fetch('/api/subscribe/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId: user.uid, customerEmail: user.email || undefined })
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch {}
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


