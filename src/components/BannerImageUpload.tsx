'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';

interface Props {
	onUploadComplete?: (url: string) => void;
}

export function BannerImageUpload({ onUploadComplete }: Props) {
	const { user } = useAuth();
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const onFile = (file: File) => {
		if (!user || !firebaseReady || !storage || !db) {
			setError('Not signed in or Firebase not ready');
			return;
		}
		try {
			setUploading(true);
			setError(null);
			const path = `profile-banners/${user.uid}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
			const sref = storageRef(storage, path);
			const task = uploadBytesResumable(sref, file);
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
					if (onUploadComplete) onUploadComplete(url);
				}
			);
		} catch (e: any) {
			setError(e?.message || 'Upload failed');
			setUploading(false);
		}
	};

	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium mb-1 text-neutral-300">Profile banner (optional)</label>
			<input
				type="file"
				accept="image/*"
				onChange={(e) => {
					const f = e.target.files && e.target.files[0];
					if (f) onFile(f);
				}}
				className="block w-full text-sm text-neutral-300 file:mr-4 file:px-3 file:py-2 file:rounded-md file:border file:border-neutral-700 file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700"
			/>
			{uploading && <div className="text-xs text-neutral-400">Uploading… {progress.toFixed(0)}%</div>}
			{error && <div className="text-xs text-red-400">{error}</div>}
			<p className="text-xs text-neutral-500">Recommended size: 1600×400 or larger (wide)</p>
		</div>
	);
}

