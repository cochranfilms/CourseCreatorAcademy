"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/firebaseClient';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'fake_account', label: 'Fake Account' },
  { value: 'other', label: 'Other' },
] as const;

export function ReportUserModal({ isOpen, onClose, userId, userName, onSuccess }: ReportUserModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isFirstReport, setIsFirstReport] = useState<boolean | null>(null);
  const [checkingFirstReport, setCheckingFirstReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];

    files.forEach((file) => {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        setError(`${file.name} is not a valid file type. Please upload PNG, JPG, WEBP, or PDF.`);
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`);
        return;
      }

      validFiles.push(file);
    });

    if (validFiles.length === 0) return;

    // Create previews for images
    const previewPromises = validFiles.map((file) => {
      if (file.type.startsWith('image/')) {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target?.result as string || '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      } else {
        return Promise.resolve(''); // PDF doesn't have preview
      }
    });

    const newPreviews = await Promise.all(previewPromises);
    setSelectedFiles([...selectedFiles, ...validFiles]);
    setFilePreviews([...filePreviews, ...newPreviews]);
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  // Check if this is the first report when modal opens
  useEffect(() => {
    if (!isOpen || !user || !userId) {
      setIsFirstReport(null);
      return;
    }

    const checkFirstReport = async () => {
      setCheckingFirstReport(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/users/${userId}/report/check-first`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsFirstReport(data.isFirstReport === true);
        } else {
          // Default to allowing uploads if check fails
          setIsFirstReport(true);
        }
      } catch (error) {
        console.error('Error checking first report:', error);
        // Default to allowing uploads if check fails
        setIsFirstReport(true);
      } finally {
        setCheckingFirstReport(false);
      }
    };

    checkFirstReport();
  }, [isOpen, user, userId]);

  const uploadFiles = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];

    setUploadingFiles(true);
    setUploadProgress({});

    const uploadPromises = selectedFiles.map(async (file, index) => {
      const fileId = `file_${index}`;
      const timestamp = Date.now();
      const storageRef = ref(storage, `user-reports/${user?.uid}/${timestamp}_${index}_${file.name.replace(/\s+/g, '_')}`);

      return new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress((prev) => ({ ...prev, [fileId]: percent }));
          },
          (error) => {
            console.error('Upload error:', error);
            setUploadProgress((prev) => {
              const newProgress = { ...prev };
              delete newProgress[fileId];
              return newProgress;
            });
            reject(new Error(`Failed to upload ${file.name}`));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress((prev) => {
                const newProgress = { ...prev };
                delete newProgress[fileId];
                return newProgress;
              });
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });

    try {
      const urls = await Promise.all(uploadPromises);
      setUploadingFiles(false);
      return urls;
    } catch (error: any) {
      setUploadingFiles(false);
      throw error;
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason) return;

    setSubmitting(true);
    setError(null);

    try {
      // Upload files first
      let fileUrls: string[] = [];
      if (selectedFiles.length > 0) {
        try {
          fileUrls = await uploadFiles();
        } catch (uploadError: any) {
          setError(uploadError.message || 'Failed to upload files. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const token = await user.getIdToken();
      const response = await fetch(`/api/users/${userId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
          attachments: fileUrls.length > 0 ? fileUrls : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to report user');
      }

      onSuccess?.();
      onClose();
      setReason('');
      setDetails('');
      setSelectedFiles([]);
      setFilePreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to report user. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingFiles(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border-2 border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Report User</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-neutral-300 mb-6">
          Reporting <span className="font-semibold">{userName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-ccaBlue"
            >
              <option value="">Select a reason</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Additional Details (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-ccaBlue resize-none"
              placeholder="Provide any additional information..."
            />
          </div>

          {isFirstReport !== false && (
            <div>
              <label className="block text-sm font-semibold text-neutral-300 mb-2">
                Attach Screenshot/Evidence {isFirstReport === true ? '(Optional - First Report Only)' : ''}
              </label>
              <p className="text-xs text-neutral-400 mb-2">
                Upload PNG, JPG, WEBP, or PDF files (max 10MB each)
                {isFirstReport !== null && !isFirstReport && ' - Attachments only allowed on first report'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                multiple
                onChange={handleFileSelect}
                disabled={submitting || uploadingFiles || checkingFirstReport || (isFirstReport !== null && !isFirstReport)}
                className="hidden"
                id="report-file-input"
              />
              <label
                htmlFor="report-file-input"
                className={`block w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center cursor-pointer hover:bg-neutral-700 transition-colors ${
                  submitting || uploadingFiles || checkingFirstReport || (isFirstReport !== null && !isFirstReport) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {checkingFirstReport ? 'Checking...' : uploadingFiles ? 'Uploading...' : (isFirstReport !== null && !isFirstReport) ? 'Attachments Only on First Report' : 'Choose Files'}
              </label>

            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-neutral-800/50 border border-neutral-700 rounded-lg"
                  >
                    {filePreviews[index] && (
                      <img
                        src={filePreviews[index]}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    {!filePreviews[index] && file.type === 'application/pdf' && (
                      <div className="w-12 h-12 bg-red-600 rounded flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.name}</p>
                      <p className="text-xs text-neutral-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {uploadProgress[`file_${index}`] !== undefined && (
                          <span className="ml-2">
                            ({Math.round(uploadProgress[`file_${index}`] || 0)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      disabled={submitting || uploadingFiles}
                      className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingFiles || !reason}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {uploadingFiles ? 'Uploading Files...' : submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

