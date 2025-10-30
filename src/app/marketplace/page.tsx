"use client";
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, addDoc, updateDoc, serverTimestamp, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { ListingImageUpload } from '@/components/ListingImageUpload';
import Link from 'next/link';

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
};

const conditions = ['All Conditions', 'New', 'Like New', 'Excellent', 'Good', 'Fair'];
const locations = ['All Locations', 'United States', 'Canada', 'International'];

export default function MarketplacePage() {
  const { user } = useAuth();
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

  // Form state
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [shipping, setShipping] = useState('');
  const [condition, setCondition] = useState('Excellent');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('United States');
  const [images, setImages] = useState<string[]>([]);

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
          if (data.creatorId) {
            try {
              const userDoc = await getDoc(doc(db, 'users', data.creatorId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                creatorName = userData.displayName || '';
                creatorEmail = userData.email || '';
              }
            } catch (error) {
              console.error('Error fetching creator info:', error);
            }
          }
          return {
            id: d.id,
            ...data,
            creatorName,
            creatorEmail
          } as Listing;
        })
      );
      setListings(listingsData);
    });
    return () => unsub();
  }, []);

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

  const handleEditListing = (listing: Listing) => {
    if (!user || listing.creatorId !== user.uid) {
      alert('You can only edit your own listings.');
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
      alert('Please sign in to post a listing.');
      return;
    }
    if (!title || !price) {
      alert('Please fill in title and price.');
      return;
    }
    if (!firebaseReady || !db) return;

    const priceNum = Number(price);
    const shippingNum = shipping ? Number(shipping) : 0;

    if (isNaN(priceNum) || (shipping && isNaN(shippingNum))) {
      alert('Please enter valid numbers for price and shipping.');
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
      alert('Failed to post listing. Please try again.');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    if (!firebaseReady || !db) return;
    try {
      await deleteDoc(doc(db, 'listings', listingId));
      setShowManageModal(false);
    } catch (error) {
      console.error('Error deleting listing:', error);
      alert('Failed to delete listing. Please try again.');
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
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold">Marketplace</h1>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex-1 min-w-[260px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for gear, equipment..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
          />
        </div>
        
        <div className="relative">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue appearance-none pr-8"
          >
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="relative">
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue appearance-none pr-8"
          >
            {conditions.map(cond => <option key={cond} value={cond}>{cond}</option>)}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <button
          onClick={() => {
            if (user) {
              setShowManageModal(true);
            } else {
              alert('Please sign in to view your listings.');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 border border-neutral-800 bg-neutral-900 text-white hover:bg-neutral-800 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          My Listings
        </button>

        <button
          onClick={() => {
            if (user) {
              setShowPostForm(true);
            } else {
              alert('Please sign in to sell an item.');
            }
          }}
          className="px-6 py-2 bg-red-500 text-white hover:bg-red-600 transition-all font-medium"
        >
          Sell Item
        </button>
      </div>

      {/* Post Listing Modal */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-950 border border-neutral-800 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">{editingListing ? 'Edit Listing' : 'Post a New Listing'}</h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowPostForm(false);
                }}
                className="text-neutral-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Images</label>
                <ListingImageUpload images={images} onImagesChange={setImages} />
                <p className="text-xs text-neutral-500 mt-1">First image will be used as the main image</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Canon 6D Mark II (Body)"
                  className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Price ($) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="1100"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Shipping ($)</label>
                  <input
                    type="number"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    placeholder="35 (or 0 for free)"
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Condition *</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  >
                    {conditions.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Location</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  >
                    {locations.slice(1).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-neutral-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your item, its condition, what's included..."
                  rows={4}
                  className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePostListing}
                  className="px-6 py-2 bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all"
                >
                  {editingListing ? 'Update Listing' : 'Post Listing'}
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowPostForm(false);
                  }}
                  className="px-6 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-950 border border-neutral-800 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Manage Your Listings</h2>
              <button
                onClick={() => setShowManageModal(false)}
                className="text-neutral-400 hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-neutral-400 mb-6">View, edit, or remove your listings.</p>
            {myListings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-neutral-400 mb-4">You don't have any listings yet.</p>
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    setShowPostForm(true);
                  }}
                  className="px-6 py-2 bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all"
                >
                  Post Your First Item
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myListings.map((listing) => (
                  <div key={listing.id} className="p-4 border border-neutral-800 bg-neutral-900">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{listing.title}</h3>
                        <p className="text-sm text-neutral-400">${listing.price}{listing.shipping ? ` + $${listing.shipping} shipping` : ' (Free shipping)'}</p>
                        <p className="text-xs text-neutral-500 mt-1">{listing.condition}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditListing(listing)}
                          className="px-3 py-1 bg-ccaBlue/10 border border-ccaBlue/30 text-ccaBlue hover:bg-ccaBlue/20 transition text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteListing(listing.id)}
                          className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition text-sm"
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
                className="px-6 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {displayListings.length === 0 ? (
        <div className="text-center py-12 border border-neutral-800 bg-neutral-950">
          <p className="text-neutral-400 text-lg">No listings found.</p>
          {searchQuery && (
            <p className="text-neutral-500 text-sm mt-2">Try adjusting your search or filter criteria.</p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayListings.map((listing) => {
            const imageIndex = currentImageIndex[listing.id] || 0;
            const listingImages = listing.images && listing.images.length > 0 ? listing.images : [];
            const hasMultipleImages = listingImages.length > 1;

            return (
              <div key={listing.id} className=" overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-all">
                {/* Image Section */}
                <div className="relative h-64 bg-neutral-900 group">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[imageIndex] || listing.images[0]}
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
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}

                  {/* Image Indicators */}
                  {hasMultipleImages && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {listingImages.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-1.5 h-1.5 transition-all ${
                            idx === imageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
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
                      <div className="w-6 h-6 bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-400">
                        {getInitials(listing.creatorName || '', listing.creatorEmail)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        <div>{listing.creatorName || listing.creatorEmail?.split('@')[0] || 'Creator'}</div>
                        <div>{formatDate(listing.createdAt)}</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {listing.condition}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
