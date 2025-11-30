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
  const offsetRef = useRef(0); // Store offset in ref to persist across re-renders
  const animationFrameIdRef = useRef<number | null>(null);

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
    if (creators.length === 0 || !trackRef.current) return;

    const track = trackRef.current;
    const scrollSpeed = 0.5; // pixels per frame (slower for smoother scroll)

    const animate = () => {
      if (!track) return;
      
      // Only update offset if scrolling is enabled
      if (isScrolling) {
        // Large square card size + gap
        const itemWidth = 400 + 24; // card width + gap
        const firstSetWidth = itemWidth * creators.length;
        
        // If we've moved past the first set, loop back seamlessly
        offsetRef.current = (offsetRef.current + scrollSpeed) % firstSetWidth;
      }
      
      // Always update transform to current offset (even when paused)
      track.style.transform = `translateX(-${offsetRef.current}px)`;
      
      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
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
          className="overflow-hidden py-6 px-6"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div ref={trackRef} className="flex gap-6 will-change-transform">
            {/* Original items */}
            {creators.map((creator) => (
              <Link
                key={creator.id}
                href={`/creator-kits/${creator.kitSlug}`}
                className="flex-shrink-0 w-[400px] h-[400px] rounded-lg overflow-hidden hover:opacity-90 transition-opacity group"
              >
                <div className="relative w-full h-full bg-neutral-900">
                  {creator.avatarUrl ? (
                    <Image 
                      src={creator.avatarUrl} 
                      alt={creator.displayName} 
                      fill 
                      sizes="400px" 
                      className="object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                      <div className="text-8xl text-neutral-700">
                        {creator.displayName.charAt(0)}
                      </div>
                    </div>
                  )}
                  {/* Gradient overlay for better text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  
                  {/* Creator info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="text-xl font-bold text-white mb-1">{creator.displayName}</div>
                    {creator.handle && (
                      <div className="text-sm text-neutral-300">@{creator.handle}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            
            {/* Duplicate items for seamless loop */}
            {creators.map((creator) => (
              <Link
                key={`${creator.id}-duplicate`}
                href={`/creator-kits/${creator.kitSlug}`}
                className="flex-shrink-0 w-[400px] h-[400px] rounded-lg overflow-hidden hover:opacity-90 transition-opacity group"
              >
                <div className="relative w-full h-full bg-neutral-900">
                  {creator.avatarUrl ? (
                    <Image 
                      src={creator.avatarUrl} 
                      alt={creator.displayName} 
                      fill 
                      sizes="400px" 
                      className="object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                      <div className="text-8xl text-neutral-700">
                        {creator.displayName.charAt(0)}
                      </div>
                    </div>
                  )}
                  {/* Gradient overlay for better text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  
                  {/* Creator info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="text-xl font-bold text-white mb-1">{creator.displayName}</div>
                    {creator.handle && (
                      <div className="text-sm text-neutral-300">@{creator.handle}</div>
                    )}
                  </div>
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

