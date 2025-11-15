"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, auth } from '@/lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Discount {
  id: string;
  title: string;
  description: string;
  partnerName: string;
  partnerLogoUrl?: string;
  discountCode?: string;
  discountLink?: string;
  discountType: 'code' | 'link' | 'both';
  discountAmount?: string;
  category?: string;
  isActive: boolean;
  isTestOnly: boolean;
  requiresMembership: boolean;
  maxRedemptions?: number;
  expirationDate?: string;
}

export default function AdminDiscountsPage() {
  return (
    <ProtectedRoute>
      <AdminDiscountsManager />
    </ProtectedRoute>
  );
}

function AdminDiscountsManager() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  async function checkAdmin() {
    if (!user || !firebaseReady || !db) {
      setIsAdmin(false);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.data() as any;
      const admin = Boolean(data?.roles?.admin || data?.isAdmin);
      setIsAdmin(admin);
    } catch {
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin && user && auth.currentUser) {
      fetchDiscounts();
    }
  }, [isAdmin, user]);

  const fetchDiscounts = async () => {
    if (!auth.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/discounts', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch discounts');
      setDiscounts(data.discounts || []);
    } catch (err: any) {
      console.error('Error fetching discounts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin === null) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-neutral-400">Verifying admin access...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Discounts</h1>
        <p className="text-neutral-400">You do not have access to this page.</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 pt-24 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Discounts</h1>
          <p className="text-neutral-400 mt-2">Manage partner discounts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-ccaBlue hover:opacity-90 transition text-white font-medium rounded-lg"
        >
          Create Discount
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {discounts.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">No discounts found.</div>
          ) : (
            discounts.map((discount) => (
              <DiscountRow
                key={discount.id}
                discount={discount}
                onEdit={() => setEditingDiscount(discount)}
                onDelete={async () => {
                  if (confirm('Are you sure you want to delete this discount?')) {
                    await deleteDiscount(discount.id);
                    fetchDiscounts();
                  }
                }}
                onToggleActive={async () => {
                  await updateDiscount(discount.id, { isActive: !discount.isActive });
                  fetchDiscounts();
                }}
              />
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <DiscountFormModal
          onClose={() => {
            setShowCreateModal(false);
            fetchDiscounts();
          }}
        />
      )}

      {editingDiscount && (
        <DiscountFormModal
          discount={editingDiscount}
          onClose={() => {
            setEditingDiscount(null);
            fetchDiscounts();
          }}
        />
      )}
    </main>
  );

  async function deleteDiscount(id: string) {
    if (!auth.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/discounts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete discount');
    } catch (err) {
      alert('Failed to delete discount');
    }
  }

  async function updateDiscount(id: string, updates: Partial<Discount>) {
    if (!auth.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/discounts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update discount');
    } catch (err) {
      alert('Failed to update discount');
    }
  }
}

function DiscountRow({
  discount,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  discount: Discount;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {discount.partnerLogoUrl && (
            <img
              src={discount.partnerLogoUrl}
              alt={discount.partnerName}
              className="w-12 h-12 object-contain"
            />
          )}
          <div>
            <div className="font-semibold">{discount.title}</div>
            <div className="text-sm text-neutral-400">{discount.partnerName}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-1 rounded text-xs ${
            discount.isActive
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {discount.isActive ? 'Active' : 'Inactive'}
        </span>
        {discount.isTestOnly && (
          <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-400">
            Test
          </span>
        )}
        <button
          onClick={onToggleActive}
          className="px-3 py-1 text-sm bg-neutral-800 hover:bg-neutral-700 rounded"
        >
          {discount.isActive ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1 text-sm bg-ccaBlue hover:opacity-90 rounded"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function DiscountFormModal({
  discount,
  onClose,
}: {
  discount?: Discount;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [createdDiscountId, setCreatedDiscountId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Discount>>({
    title: discount?.title || '',
    description: discount?.description || '',
    partnerName: discount?.partnerName || '',
    partnerLogoUrl: discount?.partnerLogoUrl || '',
    discountCode: discount?.discountCode || '',
    discountLink: discount?.discountLink || '',
    discountType: discount?.discountType || 'code',
    discountAmount: discount?.discountAmount || '',
    category: discount?.category || '',
    isActive: discount?.isActive ?? true,
    isTestOnly: discount?.isTestOnly ?? false,
    requiresMembership: discount?.requiresMembership ?? true,
    maxRedemptions: discount?.maxRedemptions || undefined,
    expirationDate: discount?.expirationDate || undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const url = discount || createdDiscountId
        ? `/api/admin/discounts/${discount?.id || createdDiscountId}`
        : '/api/admin/discounts';
      const method = discount || createdDiscountId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save discount');

      // If creating a new discount, save the ID for logo upload
      if (!discount && !createdDiscountId && data.discount?.id) {
        setCreatedDiscountId(data.discount.id);
        // Don't close yet - allow logo upload
        return;
      }

      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save discount');
    } finally {
      setLoading(false);
    }
  };

  const validateImageUrl = (url: string): boolean => {
    if (!url) return true; // Empty is OK
    // Check if URL ends with common image extensions
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
    const lowerUrl = url.toLowerCase();
    const hasImageExtension = imageExtensions.some(ext => lowerUrl.includes(ext));
    
    // Also check if it's a data URL or blob URL
    const isDataUrl = url.startsWith('data:image/');
    const isBlobUrl = url.startsWith('blob:');
    
    return hasImageExtension || isDataUrl || isBlobUrl || url.includes('firebasestorage.googleapis.com') || url.includes('firebasestorage.app');
  };

  const handleLogoUrlChange = (url: string) => {
    setFormData({ ...formData, partnerLogoUrl: url });
    // Warn if URL doesn't look like an image URL
    if (url && !validateImageUrl(url)) {
      console.warn('Warning: URL does not appear to be a direct image URL. Use a URL ending in .png, .jpg, .svg, etc.');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    const discountId = discount?.id || createdDiscountId;
    if (!discountId) {
      alert('Please save the discount first before uploading a logo');
      return;
    }

    setUploadingLogo(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`/api/admin/discounts/${discountId}/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: uploadFormData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload logo');

      setFormData((prev) => ({ ...prev, partnerLogoUrl: data.logoUrl }));
    } catch (err: any) {
      alert(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-white">
            {discount ? 'Edit Discount' : 'Create Discount'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white transition-colors p-1 hover:bg-neutral-800 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Partner Name *</label>
            <input
              type="text"
              required
              value={formData.partnerName}
              onChange={(e) => setFormData({ ...formData, partnerName: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Discount Type *</label>
            <select
              required
              value={formData.discountType}
              onChange={(e) =>
                setFormData({ ...formData, discountType: e.target.value as any })
              }
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            >
              <option value="code">Code Only</option>
              <option value="link">Link Only</option>
              <option value="both">Code + Link</option>
            </select>
          </div>

          {(formData.discountType === 'code' || formData.discountType === 'both') && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Discount Code *</label>
              <input
                type="text"
                required
                value={formData.discountCode}
                onChange={(e) => setFormData({ ...formData, discountCode: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              />
            </div>
          )}

          {(formData.discountType === 'link' || formData.discountType === 'both') && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Discount Link *</label>
              <input
                type="url"
                required
                value={formData.discountLink}
                onChange={(e) => setFormData({ ...formData, discountLink: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Discount Amount</label>
            <input
              type="text"
              placeholder="e.g., 10% or $50 off"
              value={formData.discountAmount}
              onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Category</label>
            <input
              type="text"
              placeholder="e.g., software, gear, services"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Partner Logo</label>
            {formData.partnerLogoUrl && (
              <div className="mb-3 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <img
                  src={formData.partnerLogoUrl}
                  alt="Logo preview"
                  className="w-24 h-24 object-contain mx-auto"
                />
              </div>
            )}
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Option 1: Enter Logo URL</label>
                <input
                  type="url"
                  value={formData.partnerLogoUrl || ''}
                  onChange={(e) => handleLogoUrlChange(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className={`w-full bg-neutral-900 border px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent ${
                    formData.partnerLogoUrl && !validateImageUrl(formData.partnerLogoUrl)
                      ? 'border-yellow-500/50'
                      : 'border-neutral-800'
                  }`}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Must be a direct image URL (ends in .png, .jpg, .svg, etc.), not a website URL
                </p>
                {formData.partnerLogoUrl && !validateImageUrl(formData.partnerLogoUrl) && (
                  <p className="text-xs text-yellow-500 mt-1">
                    ⚠️ This URL doesn't appear to be a direct image URL. It may be blocked by security policies.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Option 2: Upload Logo File
                  {(discount || createdDiscountId) ? '' : ' (Save discount first)'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo || (!discount && !createdDiscountId)}
                  className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-ccaBlue file:text-white hover:file:opacity-90"
                />
                {uploadingLogo && (
                  <p className="text-sm text-ccaBlue mt-1 flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Uploading logo...
                  </p>
                )}
                {!discount && !createdDiscountId && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Create the discount first, then you can upload a logo file
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-neutral-300">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isTestOnly}
                onChange={(e) => setFormData({ ...formData, isTestOnly: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-neutral-300">Test Only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requiresMembership}
                onChange={(e) =>
                  setFormData({ ...formData, requiresMembership: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm text-neutral-300">Requires Membership</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Max Redemptions</label>
            <input
              type="number"
              value={formData.maxRedemptions || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxRedemptions: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Expiration Date</label>
            <input
              type="datetime-local"
              value={formData.expirationDate?.substring(0, 16) || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expirationDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                })
              }
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2.5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-6 border-t border-neutral-800">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-ccaBlue hover:opacity-90 transition text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : discount || createdDiscountId ? 'Update Discount' : 'Create Discount'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition text-white font-medium rounded-lg"
            >
              {createdDiscountId ? 'Done' : 'Cancel'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

