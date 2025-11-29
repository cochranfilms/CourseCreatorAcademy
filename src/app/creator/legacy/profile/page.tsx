"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { useDebounce } from '@/hooks/useDebounce';
import { ImageUploadZone } from '@/components/legacy/ImageUploadZone';
import { VideoManager } from '@/components/legacy/VideoManager';
import { MarketplaceManager } from '@/components/legacy/MarketplaceManager';
import { GearEditor } from '@/components/legacy/GearEditor';
import { AssetsEditor } from '@/components/legacy/AssetsEditor';
import { ProfilePreview } from '@/components/legacy/ProfilePreview';
import Link from 'next/link';

type ActiveSection = 'profile' | 'videos' | 'marketplace' | 'gear' | 'assets' | 'settings';

type ProfileData = {
  displayName: string;
  handle: string;
  bio: string;
  kitSlug: string;
  avatarUrl: string;
  bannerUrl: string;
};

export default function LegacyProfileEditorPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>('profile');
  const [loading, setLoading] = useState(true);
  const [isLegacyCreator, setIsLegacyCreator] = useState<boolean | null>(null);
  const [hasCreatorMapping, setHasCreatorMapping] = useState<boolean>(false);
  
  // Profile state
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: '',
    handle: '',
    bio: '',
    kitSlug: '',
    avatarUrl: '',
    bannerUrl: '',
  });

  // Featured video state
  const [featuredVideo, setFeaturedVideo] = useState<{
    playbackId: string;
    title: string;
    description: string;
    durationSec?: number;
  } | null>(null);

  // Gear and Assets state
  const [gear, setGear] = useState<Array<{name:string; category:string; image?:string; url?:string}>>([]);
  const [assetsOverlays, setAssetsOverlays] = useState<Array<{title:string; tag?:string; image?:string}>>([]);
  const [assetsSfx, setAssetsSfx] = useState<Array<{title:string; tag?:string; image?:string}>>([]);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string>('');

  // Debounce profile data for auto-save
  const debouncedProfileData = useDebounce(profileData, 3000);

  // Load initial data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!user) {
          setLoading(false);
          return;
        }

        // Check legacy creator status
        if (firebaseReady && db) {
          const uref = await getDoc(doc(db, 'users', user.uid));
          const udata = uref.exists() ? (uref.data() as any) : {};
          const legacy = Boolean(udata.isLegacyCreator || udata.roles?.legacyCreator);
          setIsLegacyCreator(legacy);
        }

        // Fetch creator profile
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}`);
        if (res.ok) {
          const json = await res.json();
          const c = json?.creator;
          if (c) {
            setHasCreatorMapping(true);
            setProfileData({
              displayName: c.displayName || '',
              handle: c.handle || '',
              bio: c.bio || '',
              kitSlug: c.kitSlug || user.uid,
              avatarUrl: c.avatarUrl || '',
              bannerUrl: c.bannerUrl || '',
            });
            if (c.featured) {
              setFeaturedVideo({
                playbackId: c.featured.playbackId || '',
                title: c.featured.title || '',
                description: c.featured.description || '',
                durationSec: c.featured.durationSec,
              });
            }
            if (c.assets) {
              setAssetsOverlays(Array.isArray(c.assets.overlays) ? c.assets.overlays : []);
              setAssetsSfx(Array.isArray(c.assets.sfx) ? c.assets.sfx : []);
            }
            if (Array.isArray(c.gear)) {
              setGear(c.gear);
            }
          } else {
            setProfileData(prev => ({ ...prev, kitSlug: user.uid }));
          }
        } else {
          setProfileData(prev => ({ ...prev, kitSlug: user.uid }));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Auto-save when debounced data changes
  useEffect(() => {
    if (!user || loading || !hasCreatorMapping) return;
    
    const save = async () => {
      setSaveStatus('saving');
      setSaveError('');
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/legacy/creators/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            displayName: debouncedProfileData.displayName,
            handle: debouncedProfileData.handle,
            bio: debouncedProfileData.bio,
            kitSlug: debouncedProfileData.kitSlug,
            avatarUrl: debouncedProfileData.avatarUrl,
            bannerUrl: debouncedProfileData.bannerUrl,
            featured: featuredVideo ? {
              playbackId: featuredVideo.playbackId,
              title: featuredVideo.title,
              description: featuredVideo.description,
              durationSec: featuredVideo.durationSec,
            } : null,
            assets: { overlays: assetsOverlays, sfx: assetsSfx },
            gear,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || 'Failed to save');
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error: any) {
        setSaveStatus('error');
        setSaveError(error?.message || 'Save failed');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    };

    save();
  }, [debouncedProfileData, featuredVideo, assetsOverlays, assetsSfx, gear, user, loading, hasCreatorMapping]);

  const updateProfileField = useCallback((field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAvatarUpload = useCallback((url: string) => {
    updateProfileField('avatarUrl', url);
  }, [updateProfileField]);

  const handleBannerUpload = useCallback((url: string) => {
    updateProfileField('bannerUrl', url);
  }, [updateProfileField]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
            <p className="text-neutral-400">Loading profile editor...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="border border-neutral-800 p-8 bg-neutral-950 rounded-lg text-center">
            <p className="text-neutral-300 mb-4">Please sign in to edit your profile.</p>
            <Link href="/login" className="text-ccaBlue hover:underline">Sign In</Link>
          </div>
        </div>
      </main>
    );
  }

  if (isLegacyCreator === false && !hasCreatorMapping) {
    return (
      <main className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="border border-neutral-800 p-8 bg-neutral-950 rounded-lg">
            <p className="text-neutral-300 mb-2">Your account is not enabled as a Legacy Creator yet.</p>
            <p className="text-neutral-400 text-sm">Contact support to request Legacy Creator access.</p>
          </div>
        </div>
      </main>
    );
  }

  const sections: Array<{ id: ActiveSection; label: string; icon: string }> = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'videos', label: 'Videos', icon: '🎬' },
    { id: 'marketplace', label: 'Marketplace', icon: '🛒' },
    { id: 'gear', label: 'Gear', icon: '📷' },
    { id: 'assets', label: 'Assets', icon: '🎨' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Edit Your Profile</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Save Status Indicator */}
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <div className="w-4 h-4 border-2 border-neutral-600 border-t-ccaBlue rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Saved</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{saveError || 'Error'}</span>
                </div>
              )}
              <Link
                href={`/creator-kits/${encodeURIComponent(profileData.kitSlug || user.uid)}`}
                target="_blank"
                className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium text-sm"
              >
                View Public Page →
              </Link>
            </div>
          </div>
          <p className="text-neutral-400 text-sm">
            Changes are saved automatically. Your profile updates in real-time.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <nav className="bg-neutral-950 border border-neutral-800 rounded-lg p-2 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex-shrink-0 text-left px-4 py-3 rounded-lg mb-1 transition whitespace-nowrap ${
                    activeSection === section.id
                      ? 'bg-ccaBlue/20 text-ccaBlue border border-ccaBlue/30'
                      : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 md:p-6">
              {activeSection === 'profile' && (
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <ProfileSection
                      profileData={profileData}
                      onUpdate={updateProfileField}
                      onAvatarUpload={handleAvatarUpload}
                      onBannerUpload={handleBannerUpload}
                      userId={user.uid}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <ProfilePreview
                      kitSlug={profileData.kitSlug || user.uid}
                      displayName={profileData.displayName}
                      handle={profileData.handle}
                      bio={profileData.bio}
                      avatarUrl={profileData.avatarUrl}
                      bannerUrl={profileData.bannerUrl}
                    />
                  </div>
                </div>
              )}
              {activeSection === 'videos' && (
                <VideoManager
                  creatorId={user.uid}
                  featuredPlaybackId={featuredVideo?.playbackId}
                  featuredTitle={featuredVideo?.title}
                  featuredDescription={featuredVideo?.description}
                  onFeaturedChange={(playbackId, title, description, durationSec) => {
                    setFeaturedVideo({ playbackId, title, description, durationSec });
                  }}
                />
              )}
              {activeSection === 'marketplace' && (
                <MarketplaceManager creatorId={user.uid} />
              )}
              {activeSection === 'gear' && (
                <GearEditor
                  items={gear}
                  onChange={setGear}
                  userId={user.uid}
                />
              )}
              {activeSection === 'assets' && (
                <AssetsEditor
                  overlays={assetsOverlays}
                  sfx={assetsSfx}
                  onOverlaysChange={setAssetsOverlays}
                  onSfxChange={setAssetsSfx}
                  userId={user.uid}
                />
              )}
              {activeSection === 'settings' && (
                <SettingsSection userId={user.uid} />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProfileSection({
  profileData,
  onUpdate,
  onAvatarUpload,
  onBannerUpload,
  userId,
}: {
  profileData: ProfileData;
  onUpdate: (field: keyof ProfileData, value: string) => void;
  onAvatarUpload: (url: string) => void;
  onBannerUpload: (url: string) => void;
  userId: string;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-6">Profile Information</h2>
        
        {/* Banner Upload */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-neutral-300 mb-2">Profile Banner</label>
          <div className="max-w-4xl">
            <ImageUploadZone
              currentUrl={profileData.bannerUrl}
              onUploadComplete={onBannerUpload}
              aspectRatio={16/9}
              shape="rect"
              label="Upload banner image (16:9 recommended)"
              storagePath={`legacy-creators/${userId}/banner`}
              maxSizeMB={10}
            />
          </div>
        </div>

        {/* Avatar Upload */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-neutral-300 mb-2">Profile Avatar</label>
          <div className="w-32">
            <ImageUploadZone
              currentUrl={profileData.avatarUrl}
              onUploadComplete={onAvatarUpload}
              aspectRatio={1}
              shape="circle"
              label="Upload avatar"
              storagePath={`legacy-creators/${userId}/avatar`}
              maxSizeMB={5}
            />
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={profileData.displayName}
              onChange={(e) => onUpdate('displayName', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              placeholder="Your display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Handle
            </label>
            <input
              type="text"
              value={profileData.handle}
              onChange={(e) => onUpdate('handle', e.target.value.replace('@', ''))}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              placeholder="yourhandle"
            />
            <p className="text-xs text-neutral-500 mt-1">Your handle will appear as @{profileData.handle || 'yourhandle'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Bio
            </label>
            <textarea
              value={profileData.bio}
              onChange={(e) => onUpdate('bio', e.target.value)}
              rows={4}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none"
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-neutral-500 mt-1">{profileData.bio.length} characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Profile URL Slug
            </label>
            <input
              type="text"
              value={profileData.kitSlug}
              onChange={(e) => onUpdate('kitSlug', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              placeholder="your-profile-slug"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Your profile URL: /creator-kits/{profileData.kitSlug || 'your-slug'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ userId }: { userId: string }) {
  const [connectAccountId, setConnectAccountId] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Load Stripe Connect status
  useEffect(() => {
    const loadConnect = async () => {
      if (!firebaseReady || !db) return;
      try {
        const uref = doc(db, 'users', userId);
        const snap = await getDoc(uref);
        const data = snap.data() as any;
        if (data?.connectAccountId) {
          setConnectAccountId(data.connectAccountId);
          try {
            const res = await fetch(`/api/stripe/connect/status?accountId=${data.connectAccountId}`);
            const json = await res.json();
            setConnectStatus(json);
          } catch {}
        }
      } catch {}
    };
    loadConnect();
  }, [userId]);

  const startOnboarding = async () => {
    setPayoutsLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectAccountId || undefined }),
      });
      const json = await res.json();
      if (json.accountId && firebaseReady && db) {
        await fetch('/api/creator/save-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: json.accountId }),
        }).catch(() => {});
        setConnectAccountId(json.accountId);
      }
      if (json.url) window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message || 'Failed to start onboarding');
    } finally {
      setPayoutsLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!connectAccountId) return;
    setPayoutsLoading(true);
    try {
      const res = await fetch(`/api/stripe/connect/status?accountId=${connectAccountId}`);
      const json = await res.json();
      setConnectStatus(json);
    } catch {}
    setPayoutsLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-white">Settings</h2>

      <div className="border border-neutral-800 rounded-lg p-6 bg-neutral-900/50">
        <h3 className="text-lg font-medium text-white mb-2">Payouts</h3>
        <p className="text-neutral-300 mb-4 text-sm">
          Connect your Stripe account to receive marketplace sales and Legacy+ subscription payouts.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Status:</span>
            <span className={`text-sm font-medium ${
              connectAccountId && connectStatus?.charges_enabled && connectStatus?.payouts_enabled
                ? 'text-green-400'
                : connectAccountId
                ? 'text-yellow-400'
                : 'text-neutral-400'
            }`}>
              {connectAccountId
                ? connectStatus?.charges_enabled && connectStatus?.payouts_enabled
                  ? 'Connected & Active'
                  : 'Connected (Action Required)'
                : 'Not Connected'}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={startOnboarding}
              disabled={payoutsLoading}
              className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium disabled:opacity-50"
            >
              {connectAccountId ? 'Update in Stripe' : 'Connect with Stripe'}
            </button>
            {connectAccountId && (
              <button
                onClick={refreshStatus}
                disabled={payoutsLoading}
                className="px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-lg font-medium disabled:opacity-50"
              >
                Refresh Status
              </button>
            )}
          </div>

          {connectStatus && (
            <div className="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded text-xs">
              <div className="text-neutral-400 space-y-1">
                <div>Charges Enabled: {connectStatus?.charges_enabled ? '✓' : '✗'}</div>
                <div>Payouts Enabled: {connectStatus?.payouts_enabled ? '✓' : '✗'}</div>
                <div>Details Submitted: {connectStatus?.details_submitted ? '✓' : '✗'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
