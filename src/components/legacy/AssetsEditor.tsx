"use client";
import { useState } from 'react';
import { ImageUploadZone } from './ImageUploadZone';

type AssetItem = {
  title: string;
  tag?: string;
  image?: string;
};

type Props = {
  overlays: AssetItem[];
  sfx: AssetItem[];
  onOverlaysChange: (items: AssetItem[]) => void;
  onSfxChange: (items: AssetItem[]) => void;
  userId: string;
};

const OVERLAY_TAGS = ['transitions', 'overlays', 'effects', 'titles', 'other'];
const SFX_TAGS = ['wooshes', 'impacts', 'ambience', 'music', 'other'];

export function AssetsEditor({
  overlays,
  sfx,
  onOverlaysChange,
  onSfxChange,
  userId,
}: Props) {
  const [activeTab, setActiveTab] = useState<'overlays' | 'sfx'>('overlays');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Assets</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('overlays')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'overlays'
              ? 'text-ccaBlue border-b-2 border-ccaBlue'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Overlays & Transitions
        </button>
        <button
          onClick={() => setActiveTab('sfx')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'sfx'
              ? 'text-ccaBlue border-b-2 border-ccaBlue'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Sound Effects
        </button>
      </div>

      {activeTab === 'overlays' ? (
        <AssetList
          items={overlays}
          onChange={onOverlaysChange}
          userId={userId}
          type="overlays"
          tags={OVERLAY_TAGS}
        />
      ) : (
        <AssetList
          items={sfx}
          onChange={onSfxChange}
          userId={userId}
          type="sfx"
          tags={SFX_TAGS}
        />
      )}
    </div>
  );
}

function AssetList({
  items,
  onChange,
  userId,
  type,
  tags,
}: {
  items: AssetItem[];
  onChange: (items: AssetItem[]) => void;
  userId: string;
  type: 'overlays' | 'sfx';
  tags: string[];
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<AssetItem | null>(null);

  const addItem = () => {
    const newItem: AssetItem = { title: '', tag: tags[0], image: '' };
    onChange([...items, newItem]);
    setEditingIndex(items.length);
    setEditingItem({ ...newItem });
  };

  const updateItem = (index: number, field: keyof AssetItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    if (confirm('Remove this asset?')) {
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={addItem}
          className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium"
        >
          + Add {type === 'overlays' ? 'Overlay/Transition' : 'Sound Effect'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-neutral-400 text-center py-8">No {type === 'overlays' ? 'overlays' : 'sound effects'} yet.</div>
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
                    <label className="block text-sm text-neutral-300 mb-1">Title</label>
                    <input
                      type="text"
                      value={editingItem?.title || ''}
                      onChange={(e) => setEditingItem({ ...editingItem!, title: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white text-sm"
                      placeholder="Asset name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-300 mb-1">Tag</label>
                    <select
                      value={editingItem?.tag || tags[0]}
                      onChange={(e) => setEditingItem({ ...editingItem!, tag: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white text-sm"
                    >
                      {tags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-300 mb-1">Image</label>
                    {editingItem?.image ? (
                      <div className="relative group">
                        <img src={editingItem.image} alt="Asset" className="w-full h-32 object-cover rounded border border-neutral-800" />
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
                        storagePath={`legacy-creators/${userId}/assets/${type}/${Date.now()}`}
                        maxSizeMB={5}
                      />
                    )}
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
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-medium mb-1">{item.title || 'Untitled'}</h3>
                    {item.tag && (
                      <div className="text-xs text-neutral-400 mb-3">{item.tag}</div>
                    )}
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

