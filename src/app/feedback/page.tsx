"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, firebaseReady } from '@/lib/firebaseClient';

export default function FeedbackPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form fields
  const [feedback, setFeedback] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Filter to only images and limit to 5 files
      const imageFiles = files.filter(file => file.type.startsWith('image/')).slice(0, 5);
      setScreenshots(prev => [...prev, ...imageFiles].slice(0, 5));
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please sign in to submit feedback');
      return;
    }

    if (!feedback.trim()) {
      setError('Please provide your feedback');
      return;
    }

    if (!firebaseReady || !db || !storage) {
      setError('Firebase is not configured. Please try again later.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload screenshots first
      const screenshotUrls: string[] = [];
      
      for (let i = 0; i < screenshots.length; i++) {
        const file = screenshots[i];
        const fileName = `feedback-${user.uid}-${Date.now()}-${i}.${file.name.split('.').pop()}`;
        const storageRef = ref(storage, `feedback-screenshots/${user.uid}/${fileName}`);
        
        try {
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          screenshotUrls.push(downloadURL);
          setUploadProgress(prev => ({ ...prev, [fileName]: 100 }));
        } catch (uploadError: any) {
          console.error('Error uploading screenshot:', uploadError);
          // Continue with other uploads even if one fails
          if (uploadError?.code === 'storage/unauthorized') {
            throw new Error('Upload blocked. Please contact support.');
          }
        }
      }

      // Save feedback to Firestore
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || '',
        feedback: feedback.trim(),
        screenshotUrls,
        createdAt: serverTimestamp(),
        status: 'new'
      });

      // Reset form
      setFeedback('');
      setScreenshots([]);
      setUploadProgress({});
      setSuccess(true);

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/home');
      }, 3000);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center px-3 sm:px-4 py-6 sm:py-12 -mt-16 pt-safe pb-safe">
      <div className="w-full max-w-3xl">
        {/* Thank You Section */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white px-2">
            Thank You for Testing!
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-neutral-300 max-w-2xl mx-auto px-2 leading-relaxed">
            Your participation in this round of testing is incredibly valuable to us. 
            We appreciate the time you've taken to explore the platform and provide your insights.
          </p>
          <p className="text-xs sm:text-sm md:text-base text-neutral-400 mt-3 sm:mt-4 max-w-2xl mx-auto px-2 leading-relaxed">
            Please share your feedback, suggestions, and any issues you encountered below. 
            Your input helps us build a better experience for everyone.
          </p>
        </div>

        {/* Feedback Form */}
        <div className="bg-neutral-950 border border-neutral-800 p-4 sm:p-6 md:p-8 rounded-lg">
          {success && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-500/10 border border-green-500/30 text-green-400 text-xs sm:text-sm rounded">
              <p className="font-semibold mb-1">Thank you!</p>
              <p>Your feedback has been submitted successfully. You'll be redirected shortly...</p>
            </div>
          )}

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm rounded break-words">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label htmlFor="feedback" className="block text-xs sm:text-sm font-medium mb-2 text-neutral-300">
                Your Feedback *
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                required
                rows={6}
                placeholder="Share your thoughts, suggestions, bug reports, or any other feedback about your testing experience..."
                className="w-full bg-neutral-900 border border-neutral-800 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none rounded"
              />
              <p className="mt-1.5 sm:mt-2 text-xs text-neutral-500">
                Be as detailed as you'd like. We read every submission!
              </p>
            </div>

            <div>
              <label htmlFor="screenshots" className="block text-xs sm:text-sm font-medium mb-2 text-neutral-300">
                Screenshots (Optional)
              </label>
              <div className="space-y-2 sm:space-y-3">
                <input
                  id="screenshots"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={loading || screenshots.length >= 5}
                  className="w-full bg-neutral-900 border border-neutral-800 px-2 sm:px-4 py-2 text-xs sm:text-sm text-white file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-2 sm:file:px-4 file:rounded file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-ccaBlue file:text-white active:file:bg-ccaBlue/80 file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded"
                />
                {screenshots.length > 0 && (
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mt-2 sm:mt-3">
                    {screenshots.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeScreenshot(index)}
                          disabled={loading}
                          className="absolute top-1 right-1 bg-red-500/90 active:bg-red-500 text-white rounded-full p-1.5 sm:p-1 touch-manipulation opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          aria-label={`Remove screenshot ${index + 1}`}
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <p className="mt-1 text-xs text-neutral-400 truncate px-0.5">{file.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                {screenshots.length >= 5 && (
                  <p className="text-xs text-neutral-500 mt-1 sm:mt-2">
                    Maximum of 5 screenshots allowed
                  </p>
                )}
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Upload screenshots of bugs, issues, or features you'd like to highlight (max 5MB per image)
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={loading || !feedback.trim()}
                className="w-full sm:flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-ccaBlue text-white active:opacity-80 hover:opacity-90 font-semibold text-sm sm:text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-lg touch-manipulation"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/home')}
                disabled={loading}
                className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-900 border border-neutral-800 text-neutral-300 active:bg-neutral-800 hover:bg-neutral-800 transition-all disabled:opacity-50 rounded-lg touch-manipulation text-sm sm:text-base"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 sm:mt-6 text-center text-xs text-neutral-500 px-2">
          Your feedback is confidential and will only be used to improve the platform.
        </p>
      </div>
    </div>
  );
}

