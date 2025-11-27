"use client";
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SectionHeader } from '@/components/ui/SectionHeader';

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
  const trackRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll animation (transform-based for reliability across browsers)
  useEffect(() => {
    if (!isScrolling || creators.length === 0 || !trackRef.current) return;

    const track = trackRef.current;
    const scrollSpeed = 0.5; // pixels per frame (slower for smoother scroll)
    let animationFrameId: number;
    let offset = 0;

    const animate = () => {
      if (!isScrolling || !track) return;
      
      // Larger avatar size + gap
      const itemWidth = 200 + 32; // avatar width + gap
      const firstSetWidth = itemWidth * creators.length;
      
      // If we've moved past the first set, loop back seamlessly
      offset = (offset + scrollSpeed) % firstSetWidth;
      track.style.transform = `translateX(-${offset}px)`;
      
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
        <SectionHeader title="Creator Kits" subtitle="Discover exclusive content from top creators" align="center" />
      </div>

      {/* Black box wrapper */}
      <div className="bg-black border border-neutral-900 rounded-lg overflow-hidden mx-6">
        <div
          ref={scrollContainerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label="Creator Kits carousel"
          className="overflow-hidden py-8 px-8"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div ref={trackRef} className="flex gap-8 will-change-transform items-center">
            {/* Original items */}
            {creators.map((creator) => (
              <Link
                key={creator.id}
                href={`/creator-kits/${creator.kitSlug}`}
                className="flex-shrink-0 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity group"
              >
                {creator.avatarUrl ? (
                  <div className="relative w-[200px] h-[200px] rounded-full overflow-hidden border-4 border-neutral-800 bg-neutral-900 group-hover:border-neutral-700 transition-colors">
                    <Image 
                      src={creator.avatarUrl} 
                      alt={creator.displayName} 
                      fill 
                      sizes="200px" 
                      className="object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] rounded-full bg-neutral-800 border-4 border-neutral-700 flex items-center justify-center text-6xl font-semibold text-neutral-400 group-hover:border-neutral-600 transition-colors">
                    {creator.displayName.charAt(0)}
                  </div>
                )}
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{creator.displayName}</div>
                  {creator.handle && (
                    <div className="text-sm text-neutral-400">@{creator.handle}</div>
                  )}
                </div>
              </Link>
            ))}
            
            {/* Duplicate items for seamless loop */}
            {creators.map((creator) => (
              <Link
                key={`${creator.id}-duplicate`}
                href={`/creator-kits/${creator.kitSlug}`}
                className="flex-shrink-0 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity group"
              >
                {creator.avatarUrl ? (
                  <div className="relative w-[200px] h-[200px] rounded-full overflow-hidden border-4 border-neutral-800 bg-neutral-900 group-hover:border-neutral-700 transition-colors">
                    <Image 
                      src={creator.avatarUrl} 
                      alt={creator.displayName} 
                      fill 
                      sizes="200px" 
                      className="object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  </div>
                ) : (
                  <div className="w-[200px] h-[200px] rounded-full bg-neutral-800 border-4 border-neutral-700 flex items-center justify-center text-6xl font-semibold text-neutral-400 group-hover:border-neutral-600 transition-colors">
                    {creator.displayName.charAt(0)}
                  </div>
                )}
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{creator.displayName}</div>
                  {creator.handle && (
                    <div className="text-sm text-neutral-400">@{creator.handle}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}

