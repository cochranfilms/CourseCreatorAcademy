"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

type Props = {
  kitSlug: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl?: string;
  bannerUrl?: string;
};

export function ProfilePreview({ kitSlug, displayName, handle, bio, avatarUrl, bannerUrl }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">Preview</h3>
        <Link
          href={`/creator-kits/${encodeURIComponent(kitSlug)}`}
          target="_blank"
          className="text-sm text-ccaBlue hover:underline"
        >
          View Full Page →
        </Link>
      </div>

      {/* Mini Preview */}
      <div className="space-y-4">
        {/* Banner */}
        <div className="relative h-32 rounded-lg overflow-hidden bg-neutral-800">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600 text-sm">
              Banner Preview
            </div>
          )}
          {avatarUrl && (
            <div className="absolute bottom-0 left-4 transform translate-y-1/2">
              <div className="w-16 h-16 rounded-full border-4 border-neutral-950 overflow-hidden bg-neutral-800">
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="pt-6">
          <h4 className="text-white font-semibold text-lg">{displayName || 'Your Name'}</h4>
          {handle && (
            <div className="text-neutral-400 text-sm">@{handle}</div>
          )}
          {bio && (
            <p className="text-neutral-300 text-sm mt-2 line-clamp-3">{bio}</p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800">
        <p className="text-xs text-neutral-500">
          Changes are saved automatically and appear on your public profile.
        </p>
      </div>
    </div>
  );
}

