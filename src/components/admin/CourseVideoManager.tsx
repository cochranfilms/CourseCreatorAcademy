"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type Lesson = {
  id: string;
  title: string;
  description: string;
  index: number;
  freePreview: boolean;
  durationSec: number;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  muxAnimatedGifUrl: string | null;
  hasVideo: boolean;
};

type Module = {
  id: string;
  title: string;
  index: number;
  lessons: Lesson[];
};

type Course = {
  id: string;
  title: string;
  slug: string;
  modules: Module[];
};

interface CourseVideoManagerProps {
  onUpdate?: () => void;
}

export function CourseVideoManager({ onUpdate }: CourseVideoManagerProps) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingLesson, setEditingLesson] = useState<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  } | null>(null);
  const [editingModule, setEditingModule] = useState<{
    courseId: string;
    moduleId: string;
  } | null>(null);
  const [movingLesson, setMovingLesson] = useState<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadCourses = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/courses/list-with-videos', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data.courses || []);
      
      // Auto-expand courses with videos
      const coursesWithVideos = new Set<string>();
      const modulesWithVideos = new Set<string>();
      (data.courses || []).forEach((course: Course) => {
        course.modules.forEach((module) => {
          if (module.lessons.some((lesson) => lesson.hasVideo)) {
            coursesWithVideos.add(course.id);
            modulesWithVideos.add(`${course.id}-${module.id}`);
          }
        });
      });
      setExpandedCourses(coursesWithVideos);
      setExpandedModules(modulesWithVideos);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const toggleCourse = (courseId: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const toggleModule = (courseId: string, moduleId: string) => {
    const key = `${courseId}-${moduleId}`;
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedModules(newExpanded);
  };

  const handleUpdateLesson = async (
    courseId: string,
    moduleId: string,
    lessonId: string,
    updates: { title?: string; description?: string; index?: number; freePreview?: boolean }
  ) => {
    if (!user) return;

    setUpdating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/courses/lessons/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          moduleId,
          lessonId,
          ...updates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update lesson');
      }

      await loadCourses();
      setEditingLesson(null);
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Error updating lesson:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update lesson';
      alert(`Failed to update lesson: ${errorMessage}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateModule = async (
    courseId: string,
    moduleId: string,
    updates: { title?: string; index?: number }
  ) => {
    if (!user) return;

    setUpdating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/courses/modules/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          moduleId,
          ...updates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update module');
      }

      await loadCourses();
      setEditingModule(null);
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Error updating module:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update module';
      alert(`Failed to update module: ${errorMessage}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleMoveLesson = async (
    courseId: string,
    sourceModuleId: string,
    targetModuleId: string,
    lessonId: string,
    newIndex?: number
  ) => {
    if (!user) return;

    setUpdating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/courses/lessons/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          sourceModuleId,
          targetModuleId,
          lessonId,
          newIndex,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to move lesson');
      }

      await loadCourses();
      setMovingLesson(null);
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Error moving lesson:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to move lesson';
      alert(`Failed to move lesson: ${errorMessage}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleLinkMuxPlaybackId = async (
    courseId: string,
    moduleId: string,
    lessonId: string,
    playbackId?: string,
    assetId?: string
  ) => {
    if (!user) return;

    setUpdating(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/courses/lessons/link-mux', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          courseId,
          moduleId,
          lessonId,
          playbackId,
          assetId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to link playback ID');
      }

      const result = await response.json();
      alert(`Successfully linked playback ID: ${result.playbackId}`);
      await loadCourses();
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Error linking playback ID:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to link playback ID';
      alert(`Failed to link playback ID: ${errorMessage}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ccaBlue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Manage Course Videos</h2>
          <p className="text-neutral-400">
            Edit lesson titles, descriptions, move lessons between modules, and manage course structure.
          </p>
        </div>
        <button
          onClick={loadCourses}
          disabled={updating}
          className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          No courses found. Create a course to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const isCourseExpanded = expandedCourses.has(course.id);
            const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
            const lessonsWithVideos = course.modules.reduce(
              (sum, m) => sum + m.lessons.filter((l) => l.hasVideo).length,
              0
            );

            return (
              <div
                key={course.id}
                className="border border-neutral-800 rounded-lg bg-neutral-900/50"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors flex items-center justify-between"
                  onClick={() => toggleCourse(course.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isCourseExpanded ? '▼' : '▶'}</span>
                    <div>
                      <h3 className="font-semibold text-lg">{course.title}</h3>
                      <p className="text-sm text-neutral-400">
                        {course.modules.length} modules • {totalLessons} lessons • {lessonsWithVideos} with videos
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-neutral-500">Slug: {course.slug}</span>
                </div>

                {isCourseExpanded && (
                  <div className="border-t border-neutral-800 p-4 space-y-4">
                    {course.modules.length === 0 ? (
                      <p className="text-neutral-500 text-sm">No modules in this course.</p>
                    ) : (
                      course.modules.map((module) => {
                        const moduleKey = `${course.id}-${module.id}`;
                        const isModuleExpanded = expandedModules.has(moduleKey);
                        const moduleLessonsWithVideos = module.lessons.filter((l) => l.hasVideo).length;

                        return (
                          <div
                            key={module.id}
                            className="border border-neutral-700 rounded-lg bg-neutral-900"
                          >
                            <div
                              className="p-3 cursor-pointer hover:bg-neutral-800/50 transition-colors flex items-center justify-between"
                              onClick={() => toggleModule(course.id, module.id)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm">{isModuleExpanded ? '▼' : '▶'}</span>
                                <div>
                                  {editingModule?.courseId === course.id &&
                                  editingModule?.moduleId === module.id ? (
                                    <ModuleEditForm
                                      module={module}
                                      onSave={(updates) =>
                                        handleUpdateModule(course.id, module.id, updates)
                                      }
                                      onCancel={() => setEditingModule(null)}
                                    />
                                  ) : (
                                    <>
                                      <h4 className="font-medium">
                                        {module.title} (Index: {module.index})
                                      </h4>
                                      <p className="text-xs text-neutral-400">
                                        {module.lessons.length} lessons • {moduleLessonsWithVideos} with videos
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                              {editingModule?.courseId !== course.id ||
                              editingModule?.moduleId !== module.id ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingModule({ courseId: course.id, moduleId: module.id });
                                  }}
                                  className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
                                >
                                  Edit
                                </button>
                              ) : null}
                            </div>

                            {isModuleExpanded && (
                              <div className="border-t border-neutral-700 p-3 space-y-2">
                                {module.lessons.length === 0 ? (
                                  <p className="text-neutral-500 text-xs">No lessons in this module.</p>
                                ) : (
                                  module.lessons.map((lesson) => (
                                    <LessonCard
                                      key={lesson.id}
                                      course={course}
                                      module={module}
                                      lesson={lesson}
                                      allModules={course.modules}
                                      editing={editingLesson?.lessonId === lesson.id}
                                      moving={movingLesson?.lessonId === lesson.id}
                                      onEdit={() =>
                                        setEditingLesson({
                                          courseId: course.id,
                                          moduleId: module.id,
                                          lessonId: lesson.id,
                                        })
                                      }
                                      onCancelEdit={() => setEditingLesson(null)}
                                      onSave={(updates) =>
                                        handleUpdateLesson(course.id, module.id, lesson.id, updates)
                                      }
                                      onMove={() =>
                                        setMovingLesson({
                                          courseId: course.id,
                                          moduleId: module.id,
                                          lessonId: lesson.id,
                                        })
                                      }
                                      onCancelMove={() => setMovingLesson(null)}
                                      onMoveToModule={(targetModuleId, newIndex) =>
                                        handleMoveLesson(
                                          course.id,
                                          module.id,
                                          targetModuleId,
                                          lesson.id,
                                          newIndex
                                        )
                                      }
                                      onLinkMux={async (data) => {
                                        await handleLinkMuxPlaybackId(
                                          course.id,
                                          module.id,
                                          lesson.id,
                                          data.playbackId,
                                          data.assetId
                                        );
                                      }}
                                      updating={updating}
                                    />
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModuleEditForm({
  module,
  onSave,
  onCancel,
}: {
  module: Module;
  onSave: (updates: { title?: string; index?: number }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(module.title);
  const [index, setIndex] = useState(module.index);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
        placeholder="Module Title"
      />
      <div className="flex gap-2">
        <input
          type="number"
          value={index}
          onChange={(e) => setIndex(parseInt(e.target.value) || 0)}
          className="w-24 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white text-sm"
          placeholder="Index"
        />
        <button
          onClick={() => onSave({ title, index })}
          className="px-3 py-1 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded text-xs"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LessonCard({
  course,
  module,
  lesson,
  allModules,
  editing,
  moving,
  onEdit,
  onCancelEdit,
  onSave,
  onMove,
  onCancelMove,
  onMoveToModule,
  onLinkMux,
  updating,
}: {
  course: Course;
  module: Module;
  lesson: Lesson;
  allModules: Module[];
  editing: boolean;
  moving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updates: { title?: string; description?: string; index?: number; freePreview?: boolean }) => void;
  onMove: () => void;
  onCancelMove: () => void;
  onMoveToModule: (targetModuleId: string, newIndex?: number) => void;
  onLinkMux: (data: { playbackId?: string; assetId?: string }) => Promise<void>;
  updating: boolean;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description);
  const [index, setIndex] = useState(lesson.index);
  const [freePreview, setFreePreview] = useState(lesson.freePreview);
  const [targetModuleId, setTargetModuleId] = useState(module.id);
  const [newIndex, setNewIndex] = useState<number | undefined>(undefined);
  const [linkingPlaybackId, setLinkingPlaybackId] = useState(false);
  const [playbackIdInput, setPlaybackIdInput] = useState('');
  const [assetIdInput, setAssetIdInput] = useState('');

  if (editing) {
    return (
      <div className="p-3 bg-neutral-800 rounded border border-neutral-700 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
          placeholder="Lesson Title"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
          placeholder="Description"
          rows={2}
        />
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={index}
            onChange={(e) => setIndex(parseInt(e.target.value) || 0)}
            className="w-20 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
            placeholder="Index"
          />
          <label className="flex items-center gap-1 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={freePreview}
              onChange={(e) => setFreePreview(e.target.checked)}
              className="rounded"
            />
            Free Preview
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSave({ title, description, index, freePreview })}
            disabled={updating}
            className="px-3 py-1 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded text-xs disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (moving) {
    return (
      <div className="p-3 bg-neutral-800 rounded border border-neutral-700 space-y-2">
        <p className="text-xs text-neutral-300 mb-2">Move lesson to:</p>
        <select
          value={targetModuleId}
          onChange={(e) => setTargetModuleId(e.target.value)}
          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
        >
          {allModules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} (Index: {m.index})
            </option>
          ))}
        </select>
        <input
          type="number"
          value={newIndex ?? ''}
          onChange={(e) => setNewIndex(e.target.value ? parseInt(e.target.value) : undefined)}
          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
          placeholder="New Index (optional, auto-assigned if empty)"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onMoveToModule(targetModuleId, newIndex)}
            disabled={updating}
            className="px-3 py-1 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded text-xs disabled:opacity-50"
          >
            Move
          </button>
          <button
            onClick={onCancelMove}
            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (linkingPlaybackId) {
    return (
      <div className="p-3 bg-neutral-800 rounded border border-neutral-700 space-y-2">
        <p className="text-xs text-neutral-300 mb-2">Link MUX Playback ID:</p>
        <input
          type="text"
          value={playbackIdInput}
          onChange={(e) => setPlaybackIdInput(e.target.value)}
          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
          placeholder="Playback ID (e.g., NMaAUpG220200QGhOTsm1gWUA7pFZ4goU7E9MT005p30284)"
        />
        <p className="text-xs text-neutral-400 text-center">OR</p>
        <input
          type="text"
          value={assetIdInput}
          onChange={(e) => setAssetIdInput(e.target.value)}
          className="w-full px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm"
          placeholder="Asset ID (e.g., kg01Zol2eM02oPW747MeUDjGjRUM01TueF3oMVQm009RDxA)"
        />
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!playbackIdInput && !assetIdInput) {
                alert('Please enter either a Playback ID or Asset ID');
                return;
              }
              await onLinkMux({
                playbackId: playbackIdInput || undefined,
                assetId: assetIdInput || undefined,
              });
              setLinkingPlaybackId(false);
              setPlaybackIdInput('');
              setAssetIdInput('');
            }}
            disabled={updating}
            className="px-3 py-1 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded text-xs disabled:opacity-50"
          >
            Link
          </button>
          <button
            onClick={() => {
              setLinkingPlaybackId(false);
              setPlaybackIdInput('');
              setAssetIdInput('');
            }}
            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded border ${
        lesson.hasVideo
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-neutral-800 border-neutral-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="font-medium text-sm">{lesson.title}</h5>
            {lesson.hasVideo && (
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                Video
              </span>
            )}
            {lesson.freePreview && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                Free Preview
              </span>
            )}
          </div>
          {lesson.description && (
            <p className="text-xs text-neutral-400 mt-1">{lesson.description}</p>
          )}
          <div className="flex gap-3 mt-1 text-xs text-neutral-500">
            <span>Index: {lesson.index}</span>
            {lesson.durationSec > 0 && (
              <span>Duration: {Math.floor(lesson.durationSec / 60)}:{(lesson.durationSec % 60).toString().padStart(2, '0')}</span>
            )}
            {lesson.muxAssetId && <span>Asset: {lesson.muxAssetId.substring(0, 8)}...</span>}
          </div>
          {lesson.muxAnimatedGifUrl && (
            <img
              src={lesson.muxAnimatedGifUrl}
              alt="Thumbnail"
              className="mt-2 w-32 h-20 object-cover rounded"
            />
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300"
          >
            Edit
          </button>
          <button
            onClick={onMove}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300"
          >
            Move
          </button>
          <button
            onClick={() => setLinkingPlaybackId(true)}
            className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 rounded text-white"
          >
            Link Playback ID
          </button>
        </div>
      </div>
    </div>
  );
}

