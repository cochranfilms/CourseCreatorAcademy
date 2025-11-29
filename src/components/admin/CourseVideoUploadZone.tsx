"use client";
import { useState, useCallback, useRef, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import * as tus from 'tus-js-client';

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Module = {
  id: string;
  title: string;
  index: number;
};

type Lesson = {
  id: string;
  title: string;
  index: number;
  description?: string;
};

interface CourseVideoUploadZoneProps {
  onUploadComplete?: (data: { courseId: string; moduleId: string; lessonId: string; muxAssetId: string }) => void;
  disabled?: boolean;
}

export function CourseVideoUploadZone({ onUploadComplete, disabled }: CourseVideoUploadZoneProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseSlug, setNewCourseSlug] = useState('');
  const [showNewCourse, setShowNewCourse] = useState(false);
  
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleIndex, setNewModuleIndex] = useState(1);
  const [showNewModule, setShowNewModule] = useState(false);
  
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonIndex, setNewLessonIndex] = useState(1);
  const [newLessonDescription, setNewLessonDescription] = useState('');
  const [newLessonFreePreview, setNewLessonFreePreview] = useState(false);
  const [showNewLesson, setShowNewLesson] = useState(false);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  // Load courses on mount
  useEffect(() => {
    async function loadCourses() {
      if (!db) return;
      setLoadingCourses(true);
      try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(query(coursesRef, orderBy('title', 'asc')));
        const coursesData: Course[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          coursesData.push({
            id: doc.id,
            title: data.title || 'Untitled Course',
            slug: data.slug || doc.id,
          });
        });
        setCourses(coursesData);
      } catch (error) {
        console.error('Error loading courses:', error);
      } finally {
        setLoadingCourses(false);
      }
    }
    loadCourses();
  }, []);

  // Load modules when course changes
  useEffect(() => {
    async function loadModules() {
      if (!db || !selectedCourseId) {
        setModules([]);
        setSelectedModuleId('');
        return;
      }
      setLoadingModules(true);
      try {
        const modulesRef = collection(db, `courses/${selectedCourseId}/modules`);
        const snapshot = await getDocs(query(modulesRef, orderBy('index', 'asc')));
        const modulesData: Module[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          modulesData.push({
            id: doc.id,
            title: data.title || 'Untitled Module',
            index: data.index || 0,
          });
        });
        setModules(modulesData);
        if (modulesData.length > 0 && !selectedModuleId) {
          setSelectedModuleId(modulesData[0].id);
        }
      } catch (error) {
        console.error('Error loading modules:', error);
      } finally {
        setLoadingModules(false);
      }
    }
    loadModules();
  }, [selectedCourseId, selectedModuleId]);

  // Load lessons when module changes
  useEffect(() => {
    async function loadLessons() {
      if (!db || !selectedCourseId || !selectedModuleId) {
        setLessons([]);
        setSelectedLessonId('');
        return;
      }
      setLoadingLessons(true);
      try {
        const lessonsRef = collection(db, `courses/${selectedCourseId}/modules/${selectedModuleId}/lessons`);
        const snapshot = await getDocs(query(lessonsRef, orderBy('index', 'asc')));
        const lessonsData: Lesson[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          lessonsData.push({
            id: doc.id,
            title: data.title || 'Untitled Lesson',
            index: data.index || 0,
            description: data.description,
          });
        });
        setLessons(lessonsData);
        if (lessonsData.length > 0 && !selectedLessonId) {
          setSelectedLessonId(lessonsData[0].id);
        }
      } catch (error) {
        console.error('Error loading lessons:', error);
      } finally {
        setLoadingLessons(false);
      }
    }
    loadLessons();
  }, [selectedCourseId, selectedModuleId, selectedLessonId]);

  const handleCreateCourse = useCallback(async () => {
    if (!db || !newCourseTitle.trim()) return;
    try {
      const response = await fetch('/api/admin/courses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCourseTitle,
          slug: newCourseSlug || newCourseTitle.toLowerCase().replace(/\s+/g, '-'),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create course');
      }
      const data = await response.json();
      setSelectedCourseId(data.courseId);
      setNewCourseTitle('');
      setNewCourseSlug('');
      setShowNewCourse(false);
      // Reload courses
      const coursesRef = collection(db, 'courses');
      const snapshot = await getDocs(query(coursesRef, orderBy('title', 'asc')));
      const coursesData: Course[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        coursesData.push({ id: doc.id, title: data.title || 'Untitled Course', slug: data.slug || doc.id });
      });
      setCourses(coursesData);
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Error creating course: ${err.message}`);
    }
  }, [newCourseTitle, newCourseSlug]);

  const handleCreateModule = useCallback(async () => {
    if (!db || !selectedCourseId || !newModuleTitle.trim()) return;
    try {
      const response = await fetch('/api/admin/courses/modules/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          title: newModuleTitle,
          index: newModuleIndex,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create module');
      }
      const data = await response.json();
      setSelectedModuleId(data.moduleId);
      setNewModuleTitle('');
      setNewModuleIndex(1);
      setShowNewModule(false);
      // Reload modules
      const modulesRef = collection(db, `courses/${selectedCourseId}/modules`);
      const snapshot = await getDocs(query(modulesRef, orderBy('index', 'asc')));
      const modulesData: Module[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        modulesData.push({ id: doc.id, title: data.title || 'Untitled Module', index: data.index || 0 });
      });
      setModules(modulesData);
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Error creating module: ${err.message}`);
    }
  }, [selectedCourseId, newModuleTitle, newModuleIndex]);

  const handleCreateLesson = useCallback(async () => {
    if (!db || !selectedCourseId || !selectedModuleId || !newLessonTitle.trim()) return;
    try {
      const response = await fetch('/api/admin/courses/lessons/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          moduleId: selectedModuleId,
          title: newLessonTitle,
          index: newLessonIndex,
          description: newLessonDescription,
          freePreview: newLessonFreePreview,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create lesson');
      }
      const data = await response.json();
      setSelectedLessonId(data.lessonId);
      setNewLessonTitle('');
      setNewLessonIndex(1);
      setNewLessonDescription('');
      setNewLessonFreePreview(false);
      setShowNewLesson(false);
      // Reload lessons
      const lessonsRef = collection(db, `courses/${selectedCourseId}/modules/${selectedModuleId}/lessons`);
      const snapshot = await getDocs(query(lessonsRef, orderBy('index', 'asc')));
      const lessonsData: Lesson[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        lessonsData.push({ 
          id: doc.id, 
          title: data.title || 'Untitled Lesson', 
          index: data.index || 0,
          description: data.description,
        });
      });
      setLessons(lessonsData);
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Error creating lesson: ${err.message}`);
    }
  }, [selectedCourseId, selectedModuleId, newLessonTitle, newLessonIndex, newLessonDescription, newLessonFreePreview]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setUploadError(null);
    } else {
      alert('Please select a video file');
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!videoFile || !selectedCourseId || !selectedModuleId || !selectedLessonId) {
      alert('Please select a course, module, lesson, and video file');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Step 1: Create MUX direct upload URL
      const selectedLesson = lessons.find(l => l.id === selectedLessonId);
      const uploadResponse = await fetch('/api/admin/courses/videos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          moduleId: selectedModuleId,
          lessonId: selectedLessonId,
          title: selectedLesson?.title || newLessonTitle || 'Untitled Lesson',
          description: selectedLesson?.description || newLessonDescription || '',
        }),
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Failed to create upload URL');
      }

      const { uploadId, uploadUrl } = await uploadResponse.json();

      // Step 2: Upload video using TUS
      // Use MUX URL directly to avoid Vercel's 413 Payload Too Large error for large files
      // MUX handles CORS when cors_origin is set correctly during upload creation
      // MUX direct upload URLs are pre-created, so POST returns 405 - we handle this by
      // manually fetching upload info and resuming the upload
      const upload = new tus.Upload(videoFile, {
        endpoint: uploadUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: videoFile.name,
          filetype: videoFile.type,
        },
        onError: async (error) => {
          console.error('Upload error:', error);
          const errorMessage = error.message || '';
          
          // Handle 405 on POST - MUX direct upload URLs are pre-created, so POST fails
          // We need to fetch upload info via HEAD and then manually resume with PATCH
          if (errorMessage.includes('405') || errorMessage.includes('Method Not Allowed')) {
            console.log('405 error detected - upload already exists, fetching upload info via HEAD');
            
            try {
              // Fetch upload info via HEAD request
              const headResponse = await fetch(uploadUrl, {
                method: 'HEAD',
                headers: {
                  'Tus-Resumable': '1.0.0',
                },
              });
              
              if (headResponse.ok) {
                const uploadOffset = headResponse.headers.get('Upload-Offset') || '0';
                const uploadLength = headResponse.headers.get('Upload-Length') || String(videoFile.size);
                const offset = parseInt(uploadOffset);
                const length = parseInt(uploadLength);
                
                console.log(`Upload info - Offset: ${offset}, Length: ${length}`);
                
                // If upload is already complete, call success
                if (offset >= length) {
                  console.log('Upload already complete');
                  setUploadStatus('processing');
                  setUploadProgress(100);
                  setTimeout(() => {
                    setUploadStatus('completed');
                    if (onUploadComplete) {
                      onUploadComplete({
                        courseId: selectedCourseId,
                        moduleId: selectedModuleId,
                        lessonId: selectedLessonId,
                        muxAssetId: uploadId,
                      });
                    }
                  }, 2000);
                  return;
                }
                
                // Resume upload by calling start() again - TUS client should skip POST and go to PATCH
                console.log(`Resuming upload from offset ${offset}`);
                if (uploadRef.current) {
                  uploadRef.current.start();
                }
                return;
              } else {
                console.error('HEAD request failed:', headResponse.status, headResponse.statusText);
              }
            } catch (headError) {
              console.error('Error fetching upload info:', headError);
            }
          }
          
          setUploadError(error.message || 'Upload failed');
          setUploadStatus('error');
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = (bytesUploaded / bytesTotal) * 100;
          setUploadProgress(progress);
        },
        onSuccess: async () => {
          setUploadStatus('processing');
          setUploadProgress(100);
          // The MUX webhook will handle updating the lesson document
          // We'll poll for the asset ID or wait for webhook
          // For now, just show success - webhook will update lesson
          setTimeout(() => {
            setUploadStatus('completed');
            if (onUploadComplete) {
              onUploadComplete({
                courseId: selectedCourseId,
                moduleId: selectedModuleId,
                lessonId: selectedLessonId,
                muxAssetId: uploadId, // This is the upload ID, asset ID comes from webhook
              });
            }
          }, 2000);
        },
      });

      uploadRef.current = upload;
      upload.start();
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const err = error as Error;
      setUploadError(err.message || 'Upload failed');
      setUploadStatus('error');
    }
  }, [videoFile, selectedCourseId, selectedModuleId, selectedLessonId, lessons, newLessonTitle, newLessonDescription, onUploadComplete]);

  const handleCancelUpload = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setUploadStatus('idle');
    setUploadProgress(0);
  }, []);

  return (
    <div className="space-y-6">
      {/* Course Selection */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Course *
        </label>
        <div className="flex gap-2">
          <select
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setSelectedModuleId('');
              setSelectedLessonId('');
            }}
            disabled={disabled || loadingCourses}
            className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50"
          >
            <option value="">Select a course...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewCourse(!showNewCourse)}
            disabled={disabled}
            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {showNewCourse ? 'Cancel' : '+ New'}
          </button>
        </div>
        {showNewCourse && (
          <div className="mt-2 p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-2">
            <input
              type="text"
              value={newCourseTitle}
              onChange={(e) => setNewCourseTitle(e.target.value)}
              placeholder="Course Title"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
            />
            <input
              type="text"
              value={newCourseSlug}
              onChange={(e) => setNewCourseSlug(e.target.value)}
              placeholder="Course Slug (optional)"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
            />
            <button
              type="button"
              onClick={handleCreateCourse}
              disabled={!newCourseTitle.trim()}
              className="w-full px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded-lg disabled:opacity-50"
            >
              Create Course
            </button>
          </div>
        )}
      </div>

      {/* Module Selection */}
      {selectedCourseId && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Module *
          </label>
          <div className="flex gap-2">
            <select
              value={selectedModuleId}
              onChange={(e) => {
                setSelectedModuleId(e.target.value);
                setSelectedLessonId('');
              }}
              disabled={disabled || loadingModules || !selectedCourseId}
              className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50"
            >
              <option value="">Select a module...</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title} (Index: {module.index})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewModule(!showNewModule)}
              disabled={disabled || !selectedCourseId}
              className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {showNewModule ? 'Cancel' : '+ New'}
            </button>
          </div>
          {showNewModule && (
            <div className="mt-2 p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-2">
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="Module Title"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
              />
              <input
                type="number"
                value={newModuleIndex}
                onChange={(e) => setNewModuleIndex(parseInt(e.target.value) || 1)}
                placeholder="Module Index"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
              />
              <button
                type="button"
                onClick={handleCreateModule}
                disabled={!newModuleTitle.trim()}
                className="w-full px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded-lg disabled:opacity-50"
              >
                Create Module
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lesson Selection */}
      {selectedModuleId && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Lesson *
          </label>
          <div className="flex gap-2">
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              disabled={disabled || loadingLessons || !selectedModuleId}
              className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50"
            >
              <option value="">Select a lesson...</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title} (Index: {lesson.index})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewLesson(!showNewLesson)}
              disabled={disabled || !selectedModuleId}
              className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {showNewLesson ? 'Cancel' : '+ New'}
            </button>
          </div>
          {showNewLesson && (
            <div className="mt-2 p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-3">
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="Lesson Title *"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newLessonIndex}
                  onChange={(e) => setNewLessonIndex(parseInt(e.target.value) || 1)}
                  placeholder="Lesson Index"
                  className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
                />
                <label className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-300">
                  <input
                    type="checkbox"
                    checked={newLessonFreePreview}
                    onChange={(e) => setNewLessonFreePreview(e.target.checked)}
                    className="rounded"
                  />
                  Free Preview
                </label>
              </div>
              <textarea
                value={newLessonDescription}
                onChange={(e) => setNewLessonDescription(e.target.value)}
                placeholder="Lesson Description (optional)"
                rows={3}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white"
              />
              <button
                type="button"
                onClick={handleCreateLesson}
                disabled={!newLessonTitle.trim()}
                className="w-full px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded-lg disabled:opacity-50"
              >
                Create Lesson
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lesson Details (if existing lesson selected) */}
      {selectedLessonId && !showNewLesson && (
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">Selected Lesson</h3>
          <p className="text-white">{lessons.find(l => l.id === selectedLessonId)?.title || 'Unknown'}</p>
        </div>
      )}

      {/* Video Upload */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Video File *
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={disabled || uploadStatus === 'uploading' || uploadStatus === 'processing'}
          className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-ccaBlue file:text-white hover:file:bg-ccaBlue/80 disabled:opacity-50"
        />
        {videoFile && (
          <p className="mt-2 text-sm text-neutral-400">
            Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>

      {/* Upload Progress */}
      {uploadStatus === 'uploading' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-300">Uploading...</span>
            <span className="text-neutral-400">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-ccaBlue transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancelUpload}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Cancel Upload
          </button>
        </div>
      )}

      {uploadStatus === 'processing' && (
        <div className="p-4 bg-ccaBlue/10 border border-ccaBlue/30 rounded-lg">
          <p className="text-ccaBlue">Video uploaded! Processing with MUX...</p>
          <p className="text-sm text-neutral-400 mt-1">
            The lesson will be automatically updated when processing completes.
          </p>
        </div>
      )}

      {uploadStatus === 'completed' && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400">✓ Upload completed successfully!</p>
          <p className="text-sm text-neutral-400 mt-1">
            The video is being processed. Thumbnail and metadata will be updated automatically via webhook.
          </p>
        </div>
      )}

      {uploadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">Error: {uploadError}</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={
          disabled ||
          !videoFile ||
          !selectedCourseId ||
          !selectedModuleId ||
          !selectedLessonId ||
          uploadStatus === 'uploading' ||
          uploadStatus === 'processing'
        }
        className="w-full px-6 py-3 bg-ccaBlue hover:bg-ccaBlue/80 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : uploadStatus === 'processing' ? 'Processing...' : 'Upload Video'}
      </button>
    </div>
  );
}

