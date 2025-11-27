"use client";
import { useState } from 'react';
import { ImageUploadZone } from './ImageUploadZone';

type GearItem = {
  name: string;
  category: string;
  image?: string;
  url?: string;
};

type Props = {
  items: GearItem[];
  onChange: (items: GearItem[]) => void;
  userId: string;
};

const CATEGORIES = [
  'CAMERA',
  'LENSES',
  'AUDIO',
  'LIGHTING',
  'ACCESSORIES',
  'SOFTWARE',
  'OTHER',
];

export function GearEditor({ items, onChange, userId }: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);

  const addItem = () => {
    const newItem: GearItem = { name: '', category: 'CAMERA', image: '', url: '' };
    onChange([...items, newItem]);
    setEditingIndex(items.length);
    setEditingItem({ ...newItem });
  };

  const updateItem = (index: number, field: keyof GearItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    if (confirm('Remove this gear item?')) {
      onChange(items.filter((_, i) => i !== index));
    }
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingItem({ ...items[index] });
  };

  const saveEdit = () => {
    if (editingIndex !== null && editingItem) {
      const updated = [...items];
      updated[editingIndex] = editingItem;
      onChange(updated);
      setEditingIndex(null);
      setEditingItem(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Gear List</h2>
        <button
          onClick={addItem}
          className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium"
        >
          + Add Gear Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-neutral-400 text-center py-8">No gear items yet. Add your first item above.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/50"
            >
              {editingIndex === index ? (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm text-neutral-300 mb-1">Product Name</label>
                    <input
                      type="text"
                      value={editingItem?.name || ''}
                      onChange={(e) => setEditingItem({ ...editingItem!, name: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white text-sm"
                      placeholder="Canon EOS R5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-300 mb-1">Category</label>
                    <select
                      value={editingItem?.category || 'CAMERA'}
                      onChange={(e) => setEditingItem({ ...editingItem!, category: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white text-sm"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-300 mb-1">Product Image</label>
                    {editingItem?.image ? (
                      <div className="relative group">
                        <img src={editingItem.image} alt="Gear" className="w-full h-32 object-cover rounded border border-neutral-800" />
                        <button
                          onClick={() => setEditingItem({ ...editingItem!, image: '' })}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <ImageUploadZone
                        onUploadComplete={(url) => setEditingItem({ ...editingItem!, image: url })}
                        aspectRatio={16/9}
                        shape="rect"
                        label="Upload Image"
                        storagePath={`legacy-creators/${userId}/gear/${Date.now()}`}
                        maxSizeMB={5}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-300 mb-1">Affiliate URL</label>
                    <input
                      type="url"
                      value={editingItem?.url || ''}
                      onChange={(e) => setEditingItem({ ...editingItem!, url: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex-1 px-3 py-2 bg-ccaBlue text-white rounded text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 bg-neutral-800 text-neutral-300 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative h-40 bg-neutral-800">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-xs mb-2">
                      <span className="px-2 py-1 rounded bg-neutral-800 text-neutral-300">{item.category}</span>
                    </div>
                    <h3 className="text-white font-medium mb-2">{item.name || 'Untitled'}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(index)}
                        className="flex-1 px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeItem(index)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

