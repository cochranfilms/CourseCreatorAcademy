"use client";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CourseVideoUploadZone } from '@/components/admin/CourseVideoUploadZone';

export default function AdminCourseVideosUploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Check if user is authorized
  if (!authLoading && (!user || user.email !== 'info@cochranfilms.com')) {
    router.push('/home');
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Course Video Upload</h1>
        <p className="text-neutral-400 mb-8">
          Upload course videos to MUX. Videos will be automatically linked to lessons and thumbnails will be pulled from MUX.
        </p>

        <CourseVideoUploadZone
          onUploadComplete={(data) => {
            console.log('Upload complete:', data);
            alert(`Video uploaded successfully! Course: ${data.courseId}, Module: ${data.moduleId}, Lesson: ${data.lessonId}`);
          }}
        />
      </div>
    </div>
  );
}

