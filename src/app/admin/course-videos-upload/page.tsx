"use client";
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CourseVideoUploadZone } from '@/components/admin/CourseVideoUploadZone';
import { CourseVideoManager } from '@/components/admin/CourseVideoManager';

export default function AdminCourseVideosUploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if user is authorized
  if (!authLoading && (!user || user.email !== 'info@cochranfilms.com')) {
    router.push('/home');
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Course Video Management</h1>
        <p className="text-neutral-400 mb-8">
          Upload new course videos to MUX or manage existing course videos. Videos are automatically linked to lessons and thumbnails are pulled from MUX.
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-ccaBlue border-b-2 border-ccaBlue'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Upload New Video
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'manage'
                ? 'text-ccaBlue border-b-2 border-ccaBlue'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Manage Existing Videos
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <CourseVideoUploadZone
            key={refreshKey}
            onUploadComplete={(data) => {
              console.log('Upload complete:', data);
              alert(`Video uploaded successfully! Course: ${data.courseId}, Module: ${data.moduleId}, Lesson: ${data.lessonId}`);
              // Switch to manage tab and refresh
              setActiveTab('manage');
              setRefreshKey((prev) => prev + 1);
            }}
          />
        )}

        {activeTab === 'manage' && (
          <CourseVideoManager
            key={refreshKey}
            onUpdate={() => {
              // Refresh the manager view
              setRefreshKey((prev) => prev + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

