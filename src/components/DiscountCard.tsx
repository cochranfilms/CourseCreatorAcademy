"use client";

import { useState } from 'react';
import { DiscountRedemptionModal } from './DiscountRedemptionModal';

interface Discount {
  id: string;
  title: string;
  description: string;
  partnerName: string;
  partnerLogoUrl?: string;
  discountAmount?: string;
  category?: string;
}

interface DiscountCardProps {
  discount: Discount;
}

export function DiscountCard({ discount }: DiscountCardProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 hover:border-ccaBlue/50 transition-colors flex flex-col h-full">
        {discount.partnerLogoUrl && (
          <div className="mb-4 flex items-center justify-center h-16">
            <img
              src={discount.partnerLogoUrl}
              alt={discount.partnerName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        <div className="text-lg font-semibold mb-1">{discount.title}</div>
        {discount.discountAmount && (
          <div className="mb-2">
            <span className="inline-block bg-white text-ccaBlue font-medium text-sm px-2 py-1 rounded">
              {discount.discountAmount}
            </span>
          </div>
        )}
        <div className="text-neutral-400 text-sm mb-4 line-clamp-2 flex-grow">{discount.description}</div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full px-4 py-2 rounded-lg bg-ccaBlue hover:opacity-90 transition text-white font-medium mt-auto"
        >
          Redeem
        </button>
      </div>
      {showModal && (
        <DiscountRedemptionModal
          discountId={discount.id}
          discountTitle={discount.title}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

