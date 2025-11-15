"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebaseClient';
import { DiscountCard } from '@/components/DiscountCard';

interface Discount {
  id: string;
  title: string;
  description: string;
  partnerName: string;
  partnerLogoUrl?: string;
  discountAmount?: string;
  category?: string;
}

export default function DiscountsPage() {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiscounts = async () => {
      if (!user || !auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/discounts', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch discounts');
        }

        setDiscounts(data.discounts || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load discounts');
      } finally {
        setLoading(false);
      }
    };

    fetchDiscounts();
  }, [user]);

  if (!user) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl md:text-4xl font-bold">Member Discounts</h1>
        <p className="text-neutral-400 mt-2">Please sign in to view exclusive partner deals.</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Member Discounts</h1>
      <p className="text-neutral-400 mt-2">Exclusive partner deals for CCA members.</p>

      {loading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue"></div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && discounts.length === 0 && (
        <div className="mt-8 text-center py-12">
          <p className="text-neutral-400">No discounts available at this time.</p>
        </div>
      )}

      {!loading && !error && discounts.length > 0 && (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {discounts.map((discount) => (
            <DiscountCard key={discount.id} discount={discount} />
          ))}
        </div>
      )}
    </main>
  );
}


