"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { ProfileImageUpload } from '@/components/ProfileImageUpload';
import Link from 'next/link';

type Listing = { 
  id: string; 
  title: string; 
  price: number; 
  condition: string; 
  createdAt?: any;
  images?: string[];
  shipping?: number;
  description?: string;
};
type Opportunity = { id: string; title: string; company: string; location: string; type: string; posted?: any; };

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setLoading(false);
      return;
    }

    // Fetch user's marketplace listings
    const listingsQuery = query(
      collection(db, 'listings'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // Fetch user's posted opportunities
    const opportunitiesQuery = query(
      collection(db, 'opportunities'),
      where('posterId', '==', user.uid),
      orderBy('posted', 'desc')
    );

    const unsubscribeListings = onSnapshot(
      listingsQuery,
      (snap) => {
        setListings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[]);
      },
      (error) => {
        console.error('Error fetching listings:', error);
        // Fallback: fetch without orderBy and sort client-side
        const fallbackQuery = query(
          collection(db, 'listings'),
          where('creatorId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const listingsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[];
          const sorted = listingsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return bTime - aTime;
          });
          setListings(sorted);
        });
      }
    );

    const unsubscribeOpportunities = onSnapshot(
      opportunitiesQuery,
      (snap) => {
        const opps = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Opportunity[];
        setOpportunities(opps);
      },
      (error) => {
        console.error('Error fetching opportunities:', error);
        // Fallback: fetch without orderBy and sort client-side
        const fallbackQuery = query(
          collection(db, 'opportunities'),
          where('posterId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const opps = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Opportunity[];
          const sortedOpps = opps.sort((a, b) => {
            const aTime = a.posted?.toDate?.() || a.posted || 0;
            const bTime = b.posted?.toDate?.() || b.posted || 0;
            return bTime - aTime;
          });
          setOpportunities(sortedOpps);
        });
      }
    );

    setLoading(false);

    return () => {
      unsubscribeListings();
      unsubscribeOpportunities();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ProtectedRoute>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">My Dashboard</h1>
          <p className="text-neutral-400">Welcome back, {user?.email}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
              <p className="text-neutral-400">Loading your dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Account Info Card */}
            <div className="lg:col-span-1">
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-4">Account</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700">
                        {user?.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt={user.email || 'User'} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to placeholder if image fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-semibold bg-ccaBlue text-white">
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <ProfileImageUpload />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-neutral-400">Email</label>
                    <p className="text-white">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-neutral-400">User ID</label>
                    <p className="text-white text-xs font-mono break-all">{user?.uid}</p>
                  </div>
                  <div className="pt-4 border-t border-neutral-800">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 mt-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link
                    href="/marketplace"
                    className="block px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition text-center"
                  >
                    Post to Marketplace
                  </Link>
                  <Link
                    href="/opportunities"
                    className="block px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition text-center"
                  >
                    Post Opportunity
                  </Link>
                  <Link
                    href="/learn"
                    className="block px-4 py-2 rounded-lg bg-ccaBlue text-white hover:opacity-90 transition text-center"
                  >
                    View Courses
                  </Link>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* My Marketplace Listings */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">My Marketplace Listings</h2>
                  <Link
                    href="/marketplace"
                    className="text-sm text-ccaBlue hover:text-ccaBlue/80"
                  >
                    View All →
                  </Link>
                </div>
                {listings.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-400 mb-4">You haven't posted any listings yet.</p>
                    <Link
                      href="/marketplace"
                      className="inline-block px-4 py-2 rounded-lg bg-ccaBlue text-white hover:opacity-90 transition"
                    >
                      Create Your First Listing
                    </Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.slice(0, 4).map((listing) => (
                      <div
                        key={listing.id}
                        className="rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all"
                      >
                        {/* Image Section */}
                        <div className="relative h-64 bg-neutral-900 overflow-hidden">
                          {listing.images && listing.images.length > 0 ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full bg-neutral-800 flex items-center justify-center ${listing.images && listing.images.length > 0 ? 'hidden' : ''}`}>
                            <span className="text-neutral-600 text-sm">No Image</span>
                          </div>
                        </div>
                        {/* Content Section */}
                        <div className="p-4">
                          <h3 className="font-semibold text-lg mb-1 line-clamp-1">{listing.title}</h3>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl font-bold text-white">${listing.price}</span>
                            {listing.shipping !== undefined && listing.shipping > 0 ? (
                              <span className="text-sm text-neutral-400">+ ${listing.shipping} shipping</span>
                            ) : (
                              <span className="text-sm text-green-400">Free shipping</span>
                            )}
                          </div>

                          {listing.description && (
                            <p className="text-sm text-neutral-300 mb-3 line-clamp-2">{listing.description}</p>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-400">
                                {user?.email?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="text-xs text-neutral-500">
                                <div>{user?.email?.split('@')[0] || 'Creator'}</div>
                                <div>
                                  {listing.createdAt 
                                    ? (listing.createdAt.toDate 
                                      ? listing.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                      : new Date(listing.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
                                    : ''}
                                </div>
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                              {listing.condition}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Posted Opportunities */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">My Posted Opportunities</h2>
                  <Link
                    href="/opportunities"
                    className="text-sm text-ccaBlue hover:text-ccaBlue/80"
                  >
                    View All →
                  </Link>
                </div>
                {opportunities.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-400 mb-4">You haven't posted any opportunities yet.</p>
                    <Link
                      href="/opportunities"
                      className="inline-block px-4 py-2 rounded-lg bg-ccaBlue text-white hover:opacity-90 transition"
                    >
                      Post Your First Opportunity
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {opportunities.slice(0, 3).map((opp) => (
                      <div
                        key={opp.id}
                        className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
                      >
                        <div className="font-semibold text-lg">{opp.title}</div>
                        <div className="text-sm text-neutral-400">{opp.company} • {opp.location}</div>
                        <div className="text-xs text-neutral-500 mt-1">{opp.type}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}

