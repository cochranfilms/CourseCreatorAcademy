'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import ImageCropperModal from './ImageCropperModal';

interface Props {
	onUploadComplete?: (url: string) => void;
}

export function BannerImageUpload({ onUploadComplete }: Props) {
	const { user } = useAuth();
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);
	const [cropSrc, setCropSrc] = useState<string | null>(null);
	const [pendingFileName, setPendingFileName] = useState<string>('banner.jpg');
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Fetch current banner URL from user profile
	useEffect(() => {
		if (!user || !firebaseReady || !db) return;
		
		const fetchBanner = async () => {
			try {
				const userDoc = await getDoc(doc(db, 'users', user.uid));
				if (userDoc.exists()) {
					const data = userDoc.data();
					if (data.bannerUrl) {
						setCurrentBannerUrl(data.bannerUrl);
					}
				}
			} catch (err) {
				console.error('Error fetching banner:', err);
			}
		};

		fetchBanner();
	}, [user]);

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			setError('Please select an image file');
			return;
		}

		// Validate file size (max 10MB)
		if (file.size > 10 * 1024 * 1024) {
			setError('Image size must be less than 10MB');
			return;
		}

		// Open cropper first; we'll upload the cropped blob
		const reader = new FileReader();
		reader.onload = () => {
			setCropSrc(reader.result as string);
			setPendingFileName(file.name);
		};
		reader.readAsDataURL(file);
	};

	const uploadCroppedBlob = async (blob: Blob) => {
		if (!user || !firebaseReady || !storage || !db) {
			setError('Firebase is not configured');
			return;
		}
		// Close the cropper immediately so the user sees the progress
		setCropSrc(null);

		// Show a local preview right away while the upload runs
		try {
			const objectUrl = URL.createObjectURL(blob);
			setCurrentBannerUrl(objectUrl);
		} catch {}

		setUploading(true);
		setError(null);
		setProgress(0);
		try {
			const path = `profile-banners/${user.uid}/${Date.now()}_${pendingFileName.replace(/\s+/g, '_')}`;
			const sref = storageRef(storage, path);
			const task = uploadBytesResumable(sref, blob, { contentType: 'image/jpeg' });
			task.on(
				'state_changed',
				(snap) => {
					setProgress((snap.bytesTransferred / snap.totalBytes) * 100);
				},
				(err) => {
					setError(err?.message || 'Upload failed');
					setUploading(false);
				},
				async () => {
					const url = await getDownloadURL(task.snapshot.ref);
					await setDoc(
						doc(db, 'users', String(user.uid)),
						{
							bannerUrl: url,
							updatedAt: new Date()
						} as any,
						{ merge: true }
					);
					setUploading(false);
					setProgress(0);
					setCurrentBannerUrl(url);
					if (onUploadComplete) onUploadComplete(url);
				}
			);
		} catch (e: any) {
			setError(e?.message || 'Upload failed');
			setUploading(false);
		}
	};

	const handleRemoveBanner = async () => {
		if (!user || !firebaseReady || !db) {
			setError('Firebase is not configured');
			return;
		}

		if (!confirm('Are you sure you want to remove your banner image?')) {
			return;
		}

		try {
			await setDoc(
				doc(db, 'users', String(user.uid)),
				{
					bannerUrl: null,
					updatedAt: new Date()
				} as any,
				{ merge: true }
			);
			setCurrentBannerUrl(null);
			if (onUploadComplete) onUploadComplete('');
		} catch (e: any) {
			setError(e?.message || 'Failed to remove banner');
		}
	};

	return (
		<div className="space-y-3">
			<label className="block text-sm font-medium mb-2 text-neutral-300">Profile banner</label>
			
			{/* Current Banner Preview */}
			{currentBannerUrl && (
				<div className="relative w-full h-32 sm:h-40 md:h-48 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900">
					<img
						src={currentBannerUrl}
						alt="Current banner"
						className="w-full h-full object-cover"
					/>
					<div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
						<span className="text-white text-sm">Current Banner</span>
					</div>
				</div>
			)}

			{/* File Input (hidden) */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={handleFileSelect}
				className="hidden"
				disabled={uploading}
			/>

			{/* Action Buttons */}
			<div className="flex flex-wrap gap-2">
				<button
					onClick={() => fileInputRef.current?.click()}
					disabled={uploading}
					className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
				>
					{uploading ? `Uploading... ${Math.round(progress)}%` : currentBannerUrl ? 'Change Banner' : 'Upload Banner'}
				</button>
				
				{currentBannerUrl && (
					<button
						onClick={handleRemoveBanner}
						disabled={uploading}
						className="px-4 py-2 bg-red-900/30 border border-red-800/50 text-red-300 hover:bg-red-900/50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
					>
						Remove Banner
					</button>
				)}
			</div>

			{/* Progress Bar */}
			{uploading && (
				<div className="w-full bg-neutral-900 h-2 rounded overflow-hidden">
					<div
						className="bg-ccaBlue h-2 transition-all duration-300"
						style={{ width: `${progress}%` }}
					/>
				</div>
			)}

			{/* Error Message */}
			{error && <div className="text-xs text-red-400">{error}</div>}

			{/* Help Text */}
			<p className="text-xs text-neutral-500">Recommended size: 1600×500px or larger (4:1.25 ratio, wide banner)</p>

			{/* Cropper Modal */}
			{cropSrc && (
				<ImageCropperModal
					imageSrc={cropSrc}
					aspect={3.2} // 4:1.25 ratio (1600x500)
					onCancel={() => setCropSrc(null)}
					onCropped={(blob) => uploadCroppedBlob(blob)}
				/>
			)}
		</div>
	);
}

