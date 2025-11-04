"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyUploadPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/creator/legacy/profile');
  }, [router]);
  return null;
}
