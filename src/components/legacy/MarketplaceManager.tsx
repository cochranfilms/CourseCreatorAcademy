"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { ImageUploadZone } from './ImageUploadZone';

type Listing = {
  id: string;
  title: string;
  price: number;
  condition?: string;
  description?: string;
  location?: string;
  shipping?: number;
  images?: string[];
  createdAt?: any;
};

type Props = {
  creatorId: string;
};

export function MarketplaceManager({ creatorId }: Props) {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCondition, setFormCondition] = useState('Good');
  const [formDescription, setFormDescription] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formShipping, setFormShipping] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load listings
  useEffect(() => {
    const loadListings = async () => {
      if (!firebaseReady || !db) return;
      setLoading(true);
      try {
        let canonicalId = creatorId;
        try {
          const res = await fetch(`/api/legacy/creators/${encodeURIComponent(creatorId)}?soft=1`, { cache: 'no-store' });
          const json = await res.json().catch(() => ({}));
          const creator = json?.creator;
          canonicalId = creator?.id || creator?.kitSlug || creatorId;
        } catch {}

        const q = query(
          collection(db, 'listings'),
          where('creatorId', '==', canonicalId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || '',
            price: data.price || 0,
            condition: data.condition || 'Good',
            description: data.description || '',
            location: data.location || '',
            shipping: data.shipping ?? 0,
            images: Array.isArray(data.images) ? data.images : [],
            createdAt: data.createdAt || null,
          };
        });
        setListings(list);
      } catch (error) {
        console.error('Error loading listings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadListings();
  }, [creatorId]);

  const resetForm = () => {
    setFormTitle('');
    setFormPrice('');
    setFormCondition('Good');
    setFormDescription('');
    setFormLocation('');
    setFormShipping('');
    setFormImages([]);
    setEditingListing(null);
    setShowForm(false);
  };

  const handleEdit = (listing: Listing) => {
    setEditingListing(listing);
    setFormTitle(listing.title);
    setFormPrice(listing.price.toString());
    setFormCondition(listing.condition || 'Good');
    setFormDescription(listing.description || '');
    setFormLocation(listing.location || '');
    setFormShipping(listing.shipping?.toString() || '');
    setFormImages(listing.images || []);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !firebaseReady || !db) return;
    if (!formTitle || !formPrice) {
      alert('Please fill in title and price.');
      return;
    }

    const priceNum = Number(formPrice);
    const shippingNum = formShipping ? Number(formShipping) : 0;

    if (isNaN(priceNum) || (formShipping && isNaN(shippingNum))) {
      alert('Please enter valid numbers for price and shipping.');
      return;
    }

    setSaving(true);
    try {
      let canonicalId = creatorId;
      try {
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(creatorId)}?soft=1`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        const creator = json?.creator;
        canonicalId = creator?.id || creator?.kitSlug || creatorId;
      } catch {}

      if (editingListing) {
        // Update existing
        await updateDoc(doc(db, 'listings', editingListing.id), {
          title: formTitle.trim(),
          price: priceNum,
          shipping: shippingNum,
          condition: formCondition,
          description: formDescription.trim(),
          location: formLocation.trim(),
          images: formImages,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new
        await addDoc(collection(db, 'listings'), {
          title: formTitle.trim(),
          price: priceNum,
          shipping: shippingNum,
          condition: formCondition,
          description: formDescription.trim(),
          location: formLocation.trim(),
          images: formImages,
          creatorId: canonicalId,
          creatorName: user.displayName || user.email?.split('@')[0] || 'Creator',
          createdAt: serverTimestamp(),
        });
      }

      // Reload listings
      const q = query(
        collection(db, 'listings'),
        where('creatorId', '==', canonicalId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          price: data.price || 0,
          condition: data.condition || 'Good',
          description: data.description || '',
          location: data.location || '',
          shipping: data.shipping ?? 0,
          images: Array.isArray(data.images) ? data.images : [],
          createdAt: data.createdAt || null,
        };
      });
      setListings(list);

      resetForm();
    } catch (error) {
      console.error('Error saving listing:', error);
      alert('Failed to save listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (listingId: string) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    if (!firebaseReady || !db) return;

    try {
      await deleteDoc(doc(db, 'listings', listingId));
      setListings((prev) => prev.filter((l) => l.id !== listingId));
    } catch (error) {
      alert('Failed to delete listing.');
    }
  };

  const handleImageUpload = (url: string) => {
    setFormImages((prev) => [...prev, url]);
  };

  const removeImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="text-neutral-400">Loading listings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Marketplace Listings</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium"
        >
          + Create Listing
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-900/50">
          <h3 className="text-lg font-medium text-white mb-4">
            {editingListing ? 'Edit Listing' : 'Create New Listing'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                placeholder="Product name"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Price ($) *</label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Shipping ($)</label>
                <input
                  type="number"
                  value={formShipping}
                  onChange={(e) => setFormShipping(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Condition</label>
                <select
                  value={formCondition}
                  onChange={(e) => setFormCondition(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                >
                  <option value="New">New</option>
                  <option value="Like New">Like New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1">Location</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                  placeholder="City, State"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-1">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                rows={4}
                placeholder="Describe your item..."
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-300 mb-2">Images</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {formImages.map((url, index) => (
                  <div key={index} className="relative group">
                    <img src={url} alt={`Image ${index + 1}`} className="w-full h-32 object-cover rounded border border-neutral-800" />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {formImages.length < 8 && (
                  <div className="w-full">
                    <ImageUploadZone
                      onUploadComplete={handleImageUpload}
                      aspectRatio={1}
                      shape="rect"
                      label="Add Image"
                      storagePath={`listing-images/${user?.uid}/${Date.now()}`}
                      maxSizeMB={5}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingListing ? 'Update Listing' : 'Create Listing'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="text-neutral-400 text-center py-8">No listings yet. Create your first listing above.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <div key={listing.id} className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/50">
              <div className="relative h-48 bg-neutral-800">
                {listing.images && listing.images[0] ? (
                  <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600">No Image</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-white font-medium mb-1 truncate">{listing.title}</h3>
                <div className="text-ccaBlue font-semibold mb-2">${listing.price}</div>
                <div className="text-xs text-neutral-400 mb-3">{listing.condition}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(listing)}
                    className="flex-1 px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(listing.id)}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

