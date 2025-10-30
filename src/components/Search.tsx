"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import Link from 'next/link';
import Image from 'next/image';

type SearchResult = {
  id: string;
  type: 'course' | 'episode' | 'asset' | 'member' | 'listing';
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  badge?: string;
  badgeColor?: 'red' | 'blue' | 'green';
  duration?: string;
  href: string;
};

type SearchProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Search({ isOpen, onClose }: SearchProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<{
    courses: SearchResult[];
    episodes: SearchResult[];
    assets: SearchResult[];
    members: SearchResult[];
    listings: SearchResult[];
  }>({
    courses: [],
    episodes: [],
    assets: [],
    members: [],
    listings: []
  });
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load suggested items
  useEffect(() => {
    if (!isOpen || !firebaseReady || !db || !user) return;

    const loadSuggested = async () => {
      try {
        const suggestedItems: SearchResult[] = [];

        // Get featured courses
        const coursesQuery = query(
          collection(db, 'courses'),
          orderBy('featured', 'desc'),
          limit(2)
        );
        const coursesSnap = await getDocs(coursesQuery);
        coursesSnap.docs.forEach(doc => {
          const data = doc.data();
          suggestedItems.push({
            id: doc.id,
            type: 'course',
            title: data.title || 'Untitled Course',
            subtitle: data.title || '',
            thumbnail: data.coverImage,
            badge: 'Course',
            badgeColor: 'red',
            href: `/courses/${doc.id}`
          });
        });

        setSuggested(suggestedItems.slice(0, 2));
      } catch (error) {
        console.error('Error loading suggested:', error);
      }
    };

    loadSuggested();
  }, [isOpen, user]);

  // Perform search
  useEffect(() => {
    if (!isOpen || !firebaseReady || !db) return;

    const search = async () => {
      if (!searchQuery.trim()) {
        setResults({
          courses: [],
          episodes: [],
          assets: [],
          members: [],
          listings: []
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      const queryLower = searchQuery.toLowerCase();
      const newResults = {
        courses: [] as SearchResult[],
        episodes: [] as SearchResult[],
        assets: [] as SearchResult[],
        members: [] as SearchResult[],
        listings: [] as SearchResult[]
      };

      try {
        // Search courses
        const coursesQuery = query(collection(db, 'courses'));
        const coursesSnap = await getDocs(coursesQuery);
        coursesSnap.docs.forEach(doc => {
          const data = doc.data();
          const title = data.title || '';
          const summary = data.summary || '';
          if (title.toLowerCase().includes(queryLower) || summary.toLowerCase().includes(queryLower)) {
            newResults.courses.push({
              id: doc.id,
              type: 'course',
              title: title,
              subtitle: title,
              thumbnail: data.coverImage,
              badge: 'Course',
              badgeColor: 'red',
              href: `/courses/${doc.id}`
            });
          }
        });

        // Search episodes (lessons)
        const coursesForEpisodes = await getDocs(query(collection(db, 'courses')));
        for (const courseDoc of coursesForEpisodes.docs) {
          const modulesQuery = query(collection(db, 'courses', courseDoc.id, 'modules'));
          const modulesSnap = await getDocs(modulesQuery);
          
          for (const moduleDoc of modulesSnap.docs) {
            const lessonsQuery = query(collection(db, 'courses', courseDoc.id, 'modules', moduleDoc.id, 'lessons'));
            const lessonsSnap = await getDocs(lessonsQuery);
            
            lessonsSnap.docs.forEach(lessonDoc => {
              const lessonData = lessonDoc.data();
              const title = lessonData.title || '';
              if (title.toLowerCase().includes(queryLower)) {
                const durationSec = lessonData.durationSec || 0;
                const minutes = Math.floor(durationSec / 60);
                const seconds = durationSec % 60;
                const duration = minutes > 0 ? `${minutes} min` : `${seconds} sec`;
                
                newResults.episodes.push({
                  id: lessonDoc.id,
                  type: 'episode',
                  title: title,
                  thumbnail: lessonData.thumbnail,
                  badge: 'Episode',
                  badgeColor: 'blue',
                  duration: duration,
                  href: `/courses/${courseDoc.id}?lesson=${lessonDoc.id}`
                });
              }
            });
          }
        }

        // Search assets (from listings or a separate assets collection)
        const listingsQuery = query(collection(db, 'listings'));
        const listingsSnap = await getDocs(listingsQuery);
        listingsSnap.docs.forEach(doc => {
          const data = doc.data();
          const title = data.title || '';
          const description = data.description || '';
          if (title.toLowerCase().includes(queryLower) || description.toLowerCase().includes(queryLower)) {
            // Determine asset type from listing
            const assetType = data.category || 'Asset';
            const badgeColor = assetType.toLowerCase().includes('overlay') || assetType.toLowerCase().includes('template') ? 'green' : 'green';
            
            newResults.assets.push({
              id: doc.id,
              type: 'asset',
              title: title,
              subtitle: assetType,
              description: description,
              thumbnail: data.media?.[0] || data.thumbnail,
              badge: assetType,
              badgeColor: badgeColor,
              href: `/marketplace/${doc.id}`
            });
          }
        });

        // Search members (users)
        const usersQuery = query(collection(db, 'users'));
        const usersSnap = await getDocs(usersQuery);
        usersSnap.docs.forEach(doc => {
          const data = doc.data();
          const displayName = data.displayName || '';
          const handle = data.handle || '';
          const email = data.email || '';
          
          if (displayName.toLowerCase().includes(queryLower) || 
              handle.toLowerCase().includes(queryLower) ||
              email.toLowerCase().includes(queryLower)) {
            newResults.members.push({
              id: doc.id,
              type: 'member',
              title: displayName,
              subtitle: handle ? `@${handle}` : '',
              thumbnail: data.photoURL,
              badge: 'Member',
              badgeColor: 'blue',
              href: `/profile/${doc.id}`
            });
          }
        });

        // Search listings (marketplace items)
        listingsSnap.docs.forEach(doc => {
          const data = doc.data();
          const title = data.title || '';
          if (title.toLowerCase().includes(queryLower)) {
            newResults.listings.push({
              id: doc.id,
              type: 'listing',
              title: title,
              subtitle: `$${data.price || 0}`,
              thumbnail: data.media?.[0] || data.thumbnail,
              badge: 'Listing',
              badgeColor: 'red',
              href: `/marketplace/${doc.id}`
            });
          }
        });

        setResults(newResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, user]);

  const handleResultClick = (href: string) => {
    router.push(href as any);
    onClose();
    setSearchQuery('');
  };

  if (!isOpen) return null;

  const hasResults = Object.values(results).some(arr => arr.length > 0);
  const hasAnyContent = suggested.length > 0 || hasResults;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Search Container */}
      <div className="relative w-full max-w-4xl bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-800">
        {/* Search Input */}
        <div className="p-4 border-b border-neutral-800">
          <div className="relative flex items-center gap-3">
            <svg className="w-5 h-5 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses, episodes, assets, members..."
              className="flex-1 bg-transparent text-white placeholder-neutral-500 focus:outline-none text-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-neutral-400 hover:text-white transition"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-neutral-400">Searching...</div>
          ) : !searchQuery && suggested.length > 0 ? (
            <div className="p-6">
              <div className="text-sm font-semibold text-neutral-400 mb-4">Suggested for you</div>
              <div className="space-y-2">
                {suggested.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleResultClick(item.href)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-neutral-800 rounded-lg transition text-left"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">IMG</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-sm text-neutral-400 truncate">{item.subtitle}</div>
                      )}
                    </div>
                    {item.badge && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0 ${
                        item.badgeColor === 'red' ? 'bg-red-600' :
                        item.badgeColor === 'blue' ? 'bg-blue-600' :
                        'bg-green-600'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : searchQuery && !hasResults ? (
            <div className="p-8 text-center text-neutral-400">No results found</div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Courses */}
              {results.courses.length > 0 && (
                <>
                  <div>
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">COURSES</div>
                    <div className="space-y-2">
                      {results.courses.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item.href)}
                          className="w-full flex items-center gap-4 p-3 hover:bg-neutral-800 rounded-lg transition text-left"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">IMG</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{item.title}</div>
                            {item.subtitle && (
                              <div className="text-sm text-neutral-400 truncate">{item.subtitle}</div>
                            )}
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-red-600 flex-shrink-0">
                            Course
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {(results.episodes.length > 0 || results.assets.length > 0 || results.members.length > 0 || results.listings.length > 0) && (
                    <div className="h-px bg-neutral-800"></div>
                  )}
                </>
              )}

              {/* Episodes */}
              {results.episodes.length > 0 && (
                <>
                  <div>
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">EPISODES</div>
                    <div className="space-y-2">
                      {results.episodes.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item.href)}
                          className="w-full flex items-center gap-4 p-3 hover:bg-neutral-800 rounded-lg transition text-left"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">IMG</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{item.title}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-blue-600">
                              Episode
                            </span>
                            {item.duration && (
                              <span className="text-xs text-neutral-400">{item.duration}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {(results.assets.length > 0 || results.members.length > 0 || results.listings.length > 0) && (
                    <div className="h-px bg-neutral-800"></div>
                  )}
                </>
              )}

              {/* Assets */}
              {results.assets.length > 0 && (
                <>
                  <div>
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">ASSETS</div>
                    <div className="space-y-2">
                      {results.assets.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item.href)}
                          className="w-full flex items-center gap-4 p-3 hover:bg-neutral-800 rounded-lg transition text-left"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">IMG</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{item.title}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                              item.badgeColor === 'green' ? 'bg-green-600' : 'bg-neutral-600'
                            }`}>
                              {item.badge || 'Asset'}
                            </span>
                            {item.description && (
                              <span className="text-xs text-neutral-400">{item.description}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {(results.members.length > 0 || results.listings.length > 0) && (
                    <div className="h-px bg-neutral-800"></div>
                  )}
                </>
              )}

              {/* Members */}
              {results.members.length > 0 && (
                <>
                  <div>
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">MEMBERS</div>
                    <div className="space-y-2">
                      {results.members.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item.href)}
                          className="w-full flex items-center gap-4 p-3 hover:bg-neutral-800 rounded-lg transition text-left"
                        >
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                                {item.title.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white truncate">{item.title}</div>
                            {item.subtitle && (
                              <div className="text-sm text-neutral-400 truncate">{item.subtitle}</div>
                            )}
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-blue-600 flex-shrink-0">
                            Member
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {results.listings.length > 0 && (
                    <div className="h-px bg-neutral-800"></div>
                  )}
                </>
              )}

              {/* Listings */}
              {results.listings.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">LISTINGS</div>
                  <div className="space-y-2">
                    {results.listings.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleResultClick(item.href)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-neutral-800 rounded-lg transition text-left"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">IMG</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-sm text-neutral-400 truncate">{item.subtitle}</div>
                          )}
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-red-600 flex-shrink-0">
                          Listing
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

