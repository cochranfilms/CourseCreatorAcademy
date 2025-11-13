"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Creator = {
  id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  kitSlug?: string;
};

export function CreatorKitsScroller() {
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<Creator[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/legacy/creators', { cache: 'no-store' });
        const json = await res.json();
        if (Array.isArray(json.creators)) {
          setCreators(
            json.creators.map((c: any) => ({
              id: c.id,
              displayName: c.displayName || c.handle || 'Creator',
              handle: c.handle,
              bannerUrl: c.bannerUrl || null,
              avatarUrl: c.avatarUrl || null,
              kitSlug: c.kitSlug || c.id,
            }))
          );
        } else {
          setCreators([]);
        }
      } catch (e) {
        console.error('Error loading creators:', e);
        setCreators([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    if (!isScrolling || creators.length === 0 || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollSpeed = 0.5; // pixels per frame (slower for smoother scroll)
    let animationFrameId: number;

    const animate = () => {
      if (!isScrolling || !container) return;
      
      const currentScroll = container.scrollLeft;
      const itemWidth = 320 + 24; // card width (320px) + gap (24px)
      const firstSetWidth = itemWidth * creators.length;
      
      // If we've scrolled past the first set, reset to 0 (seamless loop)
      if (currentScroll >= firstSetWidth) {
        container.scrollLeft = currentScroll - firstSetWidth;
      } else {
        container.scrollLeft = currentScroll + scrollSpeed;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isScrolling, creators]);

  // Pause on hover
  const handleMouseEnter = () => setIsScrolling(false);
  const handleMouseLeave = () => setIsScrolling(true);

  if (loading) return null;
  if (creators.length === 0) return null;

  return (
    <section className="my-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Creator Kits</h2>
          <p className="text-neutral-400">Discover exclusive content from top creators</p>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="Creator Kits carousel"
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 px-6"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {creators.map((creator) => (
          <Link
            key={creator.id}
            href={`/creator-kits/${creator.kitSlug}`}
            className="flex-shrink-0 w-80 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-ccaBlue/50 transition group"
          >
            <div className="relative h-64 bg-neutral-900">
              {creator.bannerUrl ? (
                <Image
                  src={creator.bannerUrl}
                  alt={creator.displayName}
                  fill
                  sizes="320px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                  <div className="text-6xl text-neutral-700">
                    {creator.displayName.charAt(0)}
                  </div>
                </div>
              )}
              {/* Gradient overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
              
              {/* Creator info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-4 mb-3">
                  {creator.avatarUrl ? (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 flex-shrink-0">
                      <Image src={creator.avatarUrl} alt={creator.displayName} fill sizes="64px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-neutral-800 border-4 border-neutral-900 flex items-center justify-center text-xl font-semibold text-neutral-400 flex-shrink-0">
                      {creator.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold text-white truncate">{creator.displayName}</div>
                    {creator.handle && (
                      <div className="text-sm text-neutral-300 truncate">@{creator.handle}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <span className="px-3 py-1 bg-ccaBlue/20 text-ccaBlue rounded-full font-medium">
                    Legacy+ Creator
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
        
        {/* Duplicate items for seamless loop */}
        {creators.map((creator) => (
          <Link
            key={`${creator.id}-duplicate`}
            href={`/creator-kits/${creator.kitSlug}`}
            className="flex-shrink-0 w-80 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-ccaBlue/50 transition group"
          >
            <div className="relative h-64 bg-neutral-900">
              {creator.bannerUrl ? (
                <Image
                  src={creator.bannerUrl}
                  alt={creator.displayName}
                  fill
                  sizes="320px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                  <div className="text-6xl text-neutral-700">
                    {creator.displayName.charAt(0)}
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-center gap-4 mb-3">
                  {creator.avatarUrl ? (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 flex-shrink-0">
                      <Image src={creator.avatarUrl} alt={creator.displayName} fill sizes="64px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-neutral-800 border-4 border-neutral-900 flex items-center justify-center text-xl font-semibold text-neutral-400 flex-shrink-0">
                      {creator.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold text-white truncate">{creator.displayName}</div>
                    {creator.handle && (
                      <div className="text-sm text-neutral-300 truncate">@{creator.handle}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <span className="px-3 py-1 bg-ccaBlue/20 text-ccaBlue rounded-full font-medium">
                    Legacy+ Creator
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}

