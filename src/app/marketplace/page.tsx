"use client";
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, addDoc, updateDoc, serverTimestamp, where, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { ListingImageUpload } from '@/components/ListingImageUpload';
import Link from 'next/link';
import Image from 'next/image';
import { Messages } from '@/components/Messages';
import { toggleSaved, isSaved } from '@/lib/userData';

type Listing = { 
  id: string; 
  title: string; 
  price: number; 
  condition: string; 
  createdAt?: any;
  creatorId?: string;
  description?: string;
  shipping?: number;
  location?: string;
  images?: string[];
  creatorName?: string;
  creatorEmail?: string;
  connectAccountId?: string;
};

const conditions = ['All Conditions', 'New', 'Like New', 'Excellent', 'Good', 'Fair'];
const locations = ['All Locations', 'United States', 'Canada', 'International'];

export default function MarketplacePage() {
  const { user } = useAuth();
  const { alert, confirm } = useAlert();
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All Conditions');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [showPostForm, setShowPostForm] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showMessageToSeller, setShowMessageToSeller] = useState(false);
  const [myConnectAccountId, setMyConnectAccountId] = useState<string | null>(null);
  const [favoritedListings, setFavoritedListings] = useState<Set<string>>(new Set());

  // Form state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [shipping, setShipping] = useState('');
  const [condition, setCondition] = useState('Excellent');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('United States');
  const [images, setImages] = useState<string[]>([]);

  // Terms & Conditions gating
  const [termsRequiredVersion, setTermsRequiredVersion] = useState<string | null>(null);
  const [userTermsVersion, setUserTermsVersion] = useState<string | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [termsLoading, setTermsLoading] = useState<boolean>(true);
  const [termsTitle, setTermsTitle] = useState<string | null>(null);
  const [termsUrl, setTermsUrl] = useState<string | null>(null);

  // Fetch terms requirement and user acceptance
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!firebaseReady || !db) { setTermsLoading(false); return; }
      try {
        // Read config/terms
        const cfgSnap = await getDoc(doc(db, 'config', 'terms'));
        const cfgData = cfgSnap.exists() ? (cfgSnap.data() as any) : null;
        const required = cfgData ? cfgData.requiredVersion || null : null;
        if (!cancelled) setTermsRequiredVersion(required);
        if (!cancelled) setTermsTitle(cfgData?.title || 'Terms & Conditions');
        if (!cancelled) setTermsUrl(cfgData?.url || cfgData?.termsUrl || null);

        if (user) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          const u = userSnap.exists() ? userSnap.data() as any : {};
          const accepted = Boolean(u?.terms?.accepted);
          const version = u?.terms?.version || null;
          if (!cancelled) {
            setHasAcceptedTerms(accepted && required ? version === required : false);
            setUserTermsVersion(version);
          }
        } else {
          if (!cancelled) {
            setHasAcceptedTerms(false);
            setUserTermsVersion(null);
          }
        }
      } catch (e) {
        console.error('Failed to load terms config/user terms', e);
      } finally {
        if (!cancelled) setTermsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  // Decide whether to show the modal on visit
  useEffect(() => {
    if (!termsLoading && user && termsRequiredVersion) {
      const needs = !hasAcceptedTerms || userTermsVersion !== termsRequiredVersion;
      if (needs) setShowTermsModal(true);
    }
  }, [termsLoading, user, termsRequiredVersion, hasAcceptedTerms, userTermsVersion]);

  const handleAcceptTerms = async () => {
    if (!firebaseReady || !db || !user || !termsRequiredVersion) { setShowTermsModal(false); return; }
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          terms: {
            accepted: true,
            version: termsRequiredVersion,
            acceptedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      setHasAcceptedTerms(true);
      setUserTermsVersion(termsRequiredVersion);
      setShowTermsModal(false);
    } catch (e) {
      console.error('Failed to accept terms', e);
      await alert('Could not save your acceptance. Please try again.');
    }
  };

  // Fetch all listings
  useEffect(() => {
    if (!firebaseReady || !db) return;
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const listingsData = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          // Try to get creator info
          let creatorName = '';
          let creatorEmail = '';
          // Use connectAccountId from listing first, then fall back to user's account
          let connectAccountId = data.connectAccountId || '';
          if (data.creatorId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.creatorId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                creatorName = userData.displayName || data.creatorName || '';
                creatorEmail = userData.email || '';
                // Only use user's connectAccountId if listing doesn't have one
                if (!connectAccountId) {
                  connectAccountId = userData.connectAccountId || '';
                }
              }
            } catch (error) {
              console.error('Error fetching creator info:', error);
            }
          }
          return {
            id: d.id,
            ...data,
            creatorName: creatorName || data.creatorName || '',
            creatorEmail,
            connectAccountId: connectAccountId || data.connectAccountId || ''
          } as Listing;
        })
      );
      setListings(listingsData);
    });
    return () => unsub();
  }, []);

  // Load current user's Stripe Connect account id
  useEffect(() => {
    const loadMyConnect = async () => {
      if (!firebaseReady || !db || !user) {
        setMyConnectAccountId(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() as any;
        setMyConnectAccountId(data?.connectAccountId || null);
      } catch {
        setMyConnectAccountId(null);
      }
    };
    loadMyConnect();
  }, [user]);

  // Load favorite status for all listings
  useEffect(() => {
    if (!user || listings.length === 0) {
      setFavoritedListings(new Set());
      return;
    }

    const loadFavorites = async () => {
      const favorites = new Set<string>();
      await Promise.all(
        listings.map(async (listing) => {
          const saved = await isSaved(user.uid, 'market', listing.id);
          if (saved) {
            favorites.add(listing.id);
          }
        })
      );
      setFavoritedListings(favorites);
    };

    loadFavorites();
  }, [user, listings]);

  // Fetch user's listings
  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setMyListings([]);
      return;
    }
    const q = query(
      collection(db, 'listings'),
      where('creatorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const myListingsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[];
        setMyListings(myListingsData);
      },
      (error) => {
        console.error('Error fetching user listings:', error);
        // Fallback without orderBy
        const fallbackQuery = query(
          collection(db, 'listings'),
          where('creatorId', '==', user.uid)
        );
        onSnapshot(fallbackQuery, (snap) => {
          const myListingsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[];
          const sorted = myListingsData.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return bTime - aTime;
          });
          setMyListings(sorted);
        });
      }
    );
    return () => unsub();
  }, [user]);

  // Filter listings
  useEffect(() => {
    let filtered = listings;

    // Filter by search query
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter(listing =>
        listing.title.toLowerCase().includes(queryLower) ||
        listing.description?.toLowerCase().includes(queryLower)
      );
    }

    // Filter by condition
    if (selectedCondition !== 'All Conditions') {
      filtered = filtered.filter(listing => listing.condition === selectedCondition);
    }

    // Filter by location
    if (selectedLocation !== 'All Locations') {
      filtered = filtered.filter(listing => listing.location === selectedLocation);
    }

    setFilteredListings(filtered);
  }, [listings, searchQuery, selectedCondition, selectedLocation]);

  const resetForm = () => {
    setTitle('');
    setPrice('');
    setShipping('');
    setDescription('');
    setCondition('Excellent');
    setLocation('United States');
    setImages([]);
    setEditingListing(null);
  };

  const handleEditListing = async (listing: Listing) => {
    if (!user || listing.creatorId !== user.uid) {
      await alert('You can only edit your own listings.');
      return;
    }
    setEditingListing(listing);
    setTitle(listing.title);
    setPrice(listing.price.toString());
    setShipping(listing.shipping?.toString() || '');
    setCondition(listing.condition);
    setDescription(listing.description || '');
    setLocation(listing.location || 'United States');
    setImages(listing.images || []);
    setShowManageModal(false);
    setShowPostForm(true);
  };

  const handlePostListing = async () => {
    if (!user) {
      await alert('Please sign in to post a listing.');
      return;
    }
    if (!myConnectAccountId) {
      const shouldConnect = await confirm('You must connect your Stripe account before posting a listing. Go to Connect now?');
      if (shouldConnect) {
        window.location.href = '/creator/onboarding';
      }
      return;
    }
    if (!title || !price) {
      await alert('Please fill in title and price.');
      return;
    }
    if (!firebaseReady || !db) return;

    const priceNum = Number(price);
    const shippingNum = shipping ? Number(shipping) : 0;

    if (isNaN(priceNum) || (shipping && isNaN(shippingNum))) {
      await alert('Please enter valid numbers for price and shipping.');
      return;
    }

    try {
      if (editingListing) {
        // Update existing listing
        await updateDoc(doc(db, 'listings', editingListing.id), {
          title,
          price: priceNum,
          shipping: shippingNum,
          condition,
          description,
          location,
          images,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new listing
        await addDoc(collection(db, 'listings'), {
          title,
          price: priceNum,
          shipping: shippingNum,
          condition,
          description,
          location,
          images,
          creatorId: user.uid,
          creatorName: user.displayName || user.email?.split('@')[0] || 'Creator',
          createdAt: serverTimestamp()
        });
      }
      resetForm();
      setShowPostForm(false);
    } catch (error) {
      console.error('Error posting listing:', error);
      await alert('Failed to post listing. Please try again.');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    const confirmed = await confirm('Are you sure you want to delete this listing?');
    if (!confirmed) return;
    if (!firebaseReady || !db) return;
    try {
      await deleteDoc(doc(db, 'listings', listingId));
      setShowManageModal(false);
    } catch (error) {
      console.error('Error deleting listing:', error);
      await alert('Failed to delete listing. Please try again.');
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getInitials = (name: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.charAt(0).toUpperCase();
    return 'U';
  };

  const displayListings = filteredListings.length > 0 ? filteredListings : listings;

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pt-safe">
        <div className="mb-4 sm:mb-6 md:mb-8 px-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">Marketplace</h1>
          <p className="text-sm sm:text-base text-neutral-400 leading-relaxed mt-2">Buy and sell gear, assets, and digital products with creators in the community.</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="space-y-3 mb-6 sm:mb-8">
          {/* Search Bar - Full Width on Mobile */}
          <div className="relative w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for gear, equipment..."
              className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue transition-all text-sm sm:text-base"
            />
          </div>
          
          {/* Filters Row - Scrollable on Mobile */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
            <div className="relative flex-shrink-0">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue appearance-none pr-7 sm:pr-8 transition-all text-sm sm:text-base whitespace-nowrap"
              >
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
              <svg className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <div className="relative flex-shrink-0">
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue appearance-none pr-7 sm:pr-8 transition-all text-sm sm:text-base whitespace-nowrap"
              >
                {conditions.map(cond => <option key={cond} value={cond}>{cond}</option>)}
              </select>
              <svg className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <button
              onClick={async () => {
                if (user) {
                  setShowManageModal(true);
                } else {
                  await alert('Please sign in to view your listings.');
                }
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg text-white hover:bg-neutral-800/80 transition-all font-medium text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline">My Listings</span>
              <span className="sm:hidden">Listings</span>
            </button>

            <button
              onClick={async () => {
                if (user) {
                  const needs = termsRequiredVersion && (!hasAcceptedTerms || userTermsVersion !== termsRequiredVersion);
                  if (needs) {
                    setShowTermsModal(true);
                  } else {
                    setShowPostForm(true);
                  }
                } else {
                  await alert('Please sign in to sell an item.');
                }
              }}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-red-500 text-white hover:bg-red-600 transition-all font-semibold rounded-lg shadow-lg shadow-red-500/20 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            >
              Sell Item
            </button>
          </div>
        </div>

      {/* Post Listing Modal */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-neutral-950 border border-neutral-800 p-4 sm:p-6 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white pr-2">{editingListing ? 'Edit Listing' : 'Post a New Listing'}</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowPostForm(false);
                }}
                className="text-neutral-400 hover:text-white transition p-1 rounded-lg hover:bg-neutral-800 flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-neutral-200">Images</label>
                <ListingImageUpload images={images} onImagesChange={setImages} />
                <p className="text-xs text-neutral-500 mt-2">First image will be used as the main image</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-neutral-200">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Canon 6D Mark II (Body)"
                  className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue transition-all"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-neutral-200">Price ($) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1100"
                    className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-neutral-200">Shipping ($)</label>
                  <input
                    type="number"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    placeholder="35 (or 0 for free)"
                    className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue transition-all"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-neutral-200">Condition *</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue transition-all"
                  >
                    {conditions.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-neutral-200">Location</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue transition-all"
                  >
                    {locations.slice(1).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-neutral-200">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your item, its condition, what's included..."
                  rows={4}
                  className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-ccaBlue resize-none transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handlePostListing}
                  className="px-6 py-3 bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-semibold transition-all rounded-lg shadow-lg shadow-white/10"
                >
                  {editingListing ? 'Update Listing' : 'Post Listing'}
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowPostForm(false);
                  }}
                  className="px-6 py-3 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-neutral-300 hover:bg-neutral-800/80 transition-all rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Listings Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-950 border border-neutral-800 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Manage Your Listings</h2>
              <button
                onClick={() => setShowManageModal(false)}
                className="text-neutral-400 hover:text-white transition p-1 rounded-lg hover:bg-neutral-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-neutral-400 mb-6">View, edit, or remove your listings.</p>
            {myListings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-300 mb-4 font-medium">You don't have any listings yet.</p>
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    setShowPostForm(true);
                  }}
                  className="px-6 py-3 bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-semibold transition-all rounded-lg shadow-lg shadow-white/10"
                >
                  Post Your First Item
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((listing) => (
                  <div key={listing.id} className="p-4 border border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm rounded-lg hover:bg-neutral-900/70 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-white mb-1">{listing.title}</h3>
                        <p className="text-sm text-neutral-300">${listing.price.toLocaleString()}{listing.shipping ? ` + $${listing.shipping} shipping` : ' (Free shipping)'}</p>
                        <p className="text-xs text-neutral-500 mt-1">{listing.condition}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditListing(listing)}
                          className="px-4 py-2 bg-ccaBlue/10 border border-ccaBlue/30 text-ccaBlue hover:bg-ccaBlue/20 transition text-sm font-medium rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteListing(listing.id)}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition text-sm font-medium rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowManageModal(false)}
                className="px-6 py-3 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-neutral-300 hover:bg-neutral-800/80 transition-all rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {displayListings.length === 0 ? (
        <div className="text-center py-12 sm:py-16 border border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm rounded-lg">
          <p className="text-neutral-300 text-base sm:text-lg font-medium">No listings found.</p>
          {searchQuery && (
            <p className="text-neutral-500 text-xs sm:text-sm mt-2">Try adjusting your search or filter criteria.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {displayListings.map((listing) => {
            const imageIndex = currentImageIndex[listing.id] || 0;
            const listingImages = listing.images && listing.images.length > 0 ? listing.images : [];
            const hasMultipleImages = listingImages.length > 1;

            return (
              <div 
                key={listing.id} 
                className="group overflow-hidden rounded-lg border border-neutral-800/50 bg-neutral-900/50 backdrop-blur-sm hover:border-neutral-700 hover:shadow-xl hover:shadow-black/20 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => { setSelectedListing(listing); setShowListingModal(true); }}
              >
                {/* Image Section */}
                <div className="relative h-64 bg-neutral-800 overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[imageIndex] || listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full bg-neutral-800 flex items-center justify-center ${listing.images && listing.images.length > 0 ? 'hidden' : ''}`}>
                    <span className="text-neutral-600 text-sm">No Image</span>
                  </div>
                  
                  {/* Favorite Button */}
                  {user && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nowFavorited = await toggleSaved(user.uid, 'market', listing.id, {
                          listingId: listing.id,
                          title: listing.title,
                          price: listing.price,
                          condition: listing.condition,
                        });
                        setFavoritedListings(prev => {
                          const newSet = new Set(prev);
                          if (nowFavorited) {
                            newSet.add(listing.id);
                          } else {
                            newSet.delete(listing.id);
                          }
                          return newSet;
                        });
                      }}
                      className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-sm transition ${
                        favoritedListings.has(listing.id)
                          ? 'bg-pink-500/90 text-white' 
                          : 'bg-neutral-900/80 text-neutral-400 hover:bg-neutral-800/90'
                      }`}
                      title={favoritedListings.has(listing.id) ? 'Unfavorite' : 'Favorite'}
                    >
                      <svg 
                        className={`w-5 h-5 ${favoritedListings.has(listing.id) ? 'fill-current' : ''}`} 
                        fill={favoritedListings.has(listing.id) ? 'currentColor' : 'none'} 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Image Navigation Arrows */}
                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex({
                            ...currentImageIndex,
                            [listing.id]: imageIndex > 0 ? imageIndex - 1 : listingImages.length - 1
                          });
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex({
                            ...currentImageIndex,
                            [listing.id]: imageIndex < listingImages.length - 1 ? imageIndex + 1 : 0
                          });
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}

                  {/* Image Indicators */}
                  {hasMultipleImages && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      {listingImages.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === imageIndex ? 'bg-white' : 'bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-4 sm:p-5">
                  <h3 className="font-bold text-base sm:text-lg mb-2 line-clamp-1 text-white group-hover:text-ccaBlue transition-colors">{listing.title}</h3>
                  
                  <div className="flex items-baseline gap-2 mb-2 sm:mb-3">
                    <span className="text-xl sm:text-2xl font-extrabold text-white">${listing.price.toLocaleString()}</span>
                    {listing.shipping !== undefined && listing.shipping > 0 ? (
                      <span className="text-xs sm:text-sm text-neutral-400">+ ${listing.shipping} shipping</span>
                    ) : (
                      <span className="text-xs sm:text-sm text-green-400 font-medium">Free shipping</span>
                    )}
                  </div>

                  {listing.description && (
                    <p className="text-xs sm:text-sm text-neutral-300 mb-3 sm:mb-4 line-clamp-2 leading-relaxed">{listing.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-neutral-800/50">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-neutral-800 rounded-full flex items-center justify-center text-xs font-semibold text-neutral-300 border border-neutral-700 flex-shrink-0">
                        {getInitials(listing.creatorName || '', listing.creatorEmail)}
                      </div>
                      <div className="text-xs text-neutral-400 min-w-0">
                        <div className="font-medium text-neutral-300 truncate">{listing.creatorName || listing.creatorEmail?.split('@')[0] || 'Creator'}</div>
                        <div className="text-xs">{formatDate(listing.createdAt)}</div>
                      </div>
                    </div>
                    <span className="px-2 sm:px-3 py-1 rounded-md text-xs font-semibold bg-neutral-800/80 text-neutral-200 border border-neutral-700/50 flex-shrink-0 ml-2">
                      {listing.condition}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Listing Detail Modal */}
      {showListingModal && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4" onClick={() => setShowListingModal(false)}>
          <div className="relative bg-neutral-950 border border-neutral-800 max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowListingModal(false)}
              className="absolute right-2 sm:right-4 top-2 sm:top-4 z-10 text-neutral-400 hover:text-white transition p-2 rounded-lg hover:bg-neutral-800"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="grid md:grid-cols-2 gap-0 flex-1 overflow-hidden">
              {/* Left: Image gallery */}
              <div className="relative bg-neutral-900 min-h-[250px] sm:min-h-[300px] md:min-h-0">
                {selectedListing.images && selectedListing.images.length > 0 ? (
                  <Image
                    src={selectedListing.images[ currentImageIndex[selectedListing.id] || 0 ] || selectedListing.images[0]}
                    alt={selectedListing.title}
                    width={1024}
                    height={768}
                    className="w-full h-full object-cover max-h-[90vh]"
                    priority
                  />
                ) : (
                  <div className="h-full min-h-[300px] flex items-center justify-center text-neutral-500">No Image</div>
                )}

                {/* Gallery controls */}
                {selectedListing.images && selectedListing.images.length > 1 && (
                  <div>
                    <button
                      onClick={() => setCurrentImageIndex({
                        ...currentImageIndex,
                        [selectedListing.id]: (currentImageIndex[selectedListing.id] || 0) > 0
                          ? (currentImageIndex[selectedListing.id] || 0) - 1
                          : selectedListing.images!.length - 1,
                      })}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex({
                        ...currentImageIndex,
                        [selectedListing.id]: (currentImageIndex[selectedListing.id] || 0) < (selectedListing.images!.length - 1)
                          ? (currentImageIndex[selectedListing.id] || 0) + 1
                          : 0,
                      })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white break-words flex-1">{selectedListing.title}</h2>
                  {user && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nowFavorited = await toggleSaved(user.uid, 'market', selectedListing.id, {
                          listingId: selectedListing.id,
                          title: selectedListing.title,
                          price: selectedListing.price,
                          condition: selectedListing.condition,
                        });
                        setFavoritedListings(prev => {
                          const newSet = new Set(prev);
                          if (nowFavorited) {
                            newSet.add(selectedListing.id);
                          } else {
                            newSet.delete(selectedListing.id);
                          }
                          return newSet;
                        });
                      }}
                      className={`p-2 rounded-full backdrop-blur-sm transition flex-shrink-0 ${
                        favoritedListings.has(selectedListing.id)
                          ? 'bg-pink-500/90 text-white' 
                          : 'bg-neutral-900/80 text-neutral-400 hover:bg-neutral-800/90'
                      }`}
                      title={favoritedListings.has(selectedListing.id) ? 'Unfavorite' : 'Favorite'}
                    >
                      <svg 
                        className={`w-5 h-5 ${favoritedListings.has(selectedListing.id) ? 'fill-current' : ''}`} 
                        fill={favoritedListings.has(selectedListing.id) ? 'currentColor' : 'none'} 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="text-3xl sm:text-4xl font-extrabold text-white">${selectedListing.price.toLocaleString()}</div>
                  <div className="text-xs sm:text-sm text-neutral-400">{selectedListing.shipping ? `+$${selectedListing.shipping} shipping` : <span className="text-green-400 font-medium">Free shipping</span>}</div>
                </div>
                <div className="pt-2 border-t border-neutral-800/50" />
                <div>
                  <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Condition</div>
                  <div className="font-semibold text-white text-sm sm:text-base">{selectedListing.condition}</div>
                </div>
                {selectedListing.location && (
                  <div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Location</div>
                    <div className="font-semibold text-white text-sm sm:text-base">{selectedListing.location}</div>
                  </div>
                )}
                {selectedListing.description && (
                  <div>
                    <div className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Description</div>
                    <p className="text-sm sm:text-base text-neutral-300 whitespace-pre-line leading-relaxed">{selectedListing.description}</p>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-2 sm:gap-3 pb-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-neutral-800 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold text-neutral-300 border border-neutral-700 flex-shrink-0">
                    {getInitials(selectedListing.creatorName || '', selectedListing.creatorEmail)}
                  </div>
                  <div className="text-xs sm:text-sm text-neutral-400 min-w-0 flex-1">
                    <div className="font-medium text-neutral-300 truncate">Listed by {selectedListing.creatorName || selectedListing.creatorEmail?.split('@')[0] || 'Creator'}</div>
                    <div className="text-xs">{formatDate(selectedListing.createdAt)}</div>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        if (!user) { alert('Please sign in to message the seller.'); return; }
                        setShowListingModal(false);
                        setShowMessageToSeller(true);
                      }}
                      className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 hover:bg-neutral-800 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition shadow-lg text-sm sm:text-base"
                    >
                      Message Seller
                    </button>
                    <button
                      onClick={async () => {
                        if (!user) { await alert('Please sign in to purchase.'); return; }
                        if (!selectedListing?.connectAccountId) { await alert('Seller has not connected Stripe yet.'); return; }
                        if (!myConnectAccountId) {
                          const shouldConnect = await confirm('You must connect your Stripe account before purchasing. Go to Connect now?');
                          if (shouldConnect) {
                            window.location.href = '/creator/onboarding';
                          }
                          return;
                        }
                        const totalCents = Math.round((Number(selectedListing.price || 0) + Number(selectedListing.shipping || 0)) * 100);
                        try {
                          const res = await fetch('/api/checkout/listing', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              amount: totalCents,
                              currency: 'usd',
                              sellerAccountId: selectedListing.connectAccountId,
                              listingId: selectedListing.id,
                              listingTitle: selectedListing.title,
                              buyerId: user.uid,
                              sellerId: selectedListing.creatorId
                            })
                          });
                          const json = await res.json();
                          if (json.url) window.location.href = json.url;
                          else if (json.error) await alert(json.error);
                        } catch (e: any) {
                          await alert(e.message || 'Failed to start checkout');
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 sm:py-3 rounded-lg transition shadow-lg shadow-red-600/20 text-sm sm:text-base"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages pre-targeted to seller */}
      {showMessageToSeller && selectedListing && (
        <Messages
          isOpen={showMessageToSeller}
          onClose={() => setShowMessageToSeller(false)}
          initialRecipientUserId={selectedListing.creatorId || ''}
        />
      )}

      {/* Terms & Conditions Modal */}
      {showTermsModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowTermsModal(false)}>
          <div className="relative bg-neutral-950 border border-neutral-800 max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-800 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{termsTitle || 'Terms & Conditions'}</h2>
                {termsRequiredVersion && (
                  <p className="text-xs text-neutral-500 mt-1">Version: {termsRequiredVersion}</p>
                )}
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-neutral-400 hover:text-white transition"
                aria-label="Close terms modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-neutral-300">
                To sell items on the CCA Marketplace, you must agree to our latest Terms & Conditions.
              </p>
              <div className="rounded border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
                <p className="mb-2 font-medium">Highlights</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide accurate item descriptions and pricing.</li>
                  <li>Ship within 72 hours and provide a valid tracking number.</li>
                  <li>Comply with all platform policies and applicable laws.</li>
                </ul>
                {termsUrl && (
                  <div className="mt-4">
                    <a
                      href={termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h6m0 0v6m0-6L10 16" />
                      </svg>
                      View full Terms & Conditions
                    </a>
                  </div>
                )}
              </div>
              <p className="text-neutral-400 text-sm">
                By clicking “I Agree”, you confirm you have read and accept the Terms & Conditions.
              </p>
            </div>
            <div className="p-6 border-t border-neutral-800 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-5 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all"
              >
                Not now
              </button>
              <button
                onClick={handleAcceptTerms}
                className="px-6 py-2 bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all"
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
