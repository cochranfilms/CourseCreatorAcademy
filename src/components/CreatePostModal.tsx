"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc, orderBy } from 'firebase/firestore';
import { db, firebaseReady, storage, auth } from '@/lib/firebaseClient';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { extractHashtags, extractMentions, POST_CATEGORIES, POST_TEMPLATES, detectMediaEmbeds, type PostCategory } from '@/lib/messageBoardUtils';
import { htmlToMarkdown, markdownToHtml, applyFormatting } from '@/lib/richTextUtils';

type Project = {
  id: string;
  title: string;
  imageUrl?: string;
};

type CreatePostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type Opportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  amount?: number;
};

type Listing = {
  id: string;
  title: string;
  price: number;
  condition: string;
  images?: string[];
};

type MediaFile = {
  file: File;
  preview: string;
  type: 'image' | 'video';
  uploadProgress?: number;
  url?: string;
};

export function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | ''>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<{ id: string; displayName: string; handle?: string; photoURL?: string }>>([]);
  const [mentionStartPosition, setMentionStartPosition] = useState<{ node: Node; offset: number } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachType, setAttachType] = useState<'opportunity' | 'listing' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    if (isOpen && firebaseReady && db) {
      if (user) {
        loadProjects();
      }
      loadOpportunities();
      loadListings();
    } else if (!isOpen) {
      // Reset form when modal closes
      setContent('');
      setHtmlContent('');
      setSelectedProjectId('');
      setSelectedCategory('');
      setSelectedTemplate('');
      setSelectedOpportunityId('');
      setSelectedListingId('');
      setMediaFiles([]);
      setError(null);
      setShowAttachModal(false);
      setAttachType(null);
      setShowMentionSuggestions(false);
      setMentionQuery('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }
  }, [isOpen, user]);

  // Sync htmlContent with editor innerHTML when htmlContent changes externally (e.g., from templates)
  useEffect(() => {
    if (editorRef.current && htmlContent && htmlContent !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  // Load all opportunities (not just user's own)
  const loadOpportunities = async () => {
    if (!firebaseReady || !db) return;
    setLoadingOpportunities(true);
    try {
      // Try with orderBy first, fallback to simple query if index doesn't exist
      let snapshot;
      try {
        const opportunitiesQuery = query(
          collection(db, 'opportunities'),
          orderBy('createdAt', 'desc')
        );
        snapshot = await getDocs(opportunitiesQuery);
      } catch (orderError) {
        // Fallback to simple query if orderBy fails (index might not exist)
        snapshot = await getDocs(collection(db, 'opportunities'));
      }
      const opportunitiesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Opportunity[];
      // Sort manually if orderBy didn't work
      opportunitiesData.sort((a, b) => {
        const aDate = (a as any).createdAt?.toDate?.() || new Date(0);
        const bDate = (b as any).createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      setOpportunities(opportunitiesData);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  // Load all listings (not just user's own)
  const loadListings = async () => {
    if (!firebaseReady || !db) return;
    setLoadingListings(true);
    try {
      // Try with orderBy first, fallback to simple query if index doesn't exist
      let snapshot;
      try {
        const listingsQuery = query(
          collection(db, 'listings'),
          orderBy('createdAt', 'desc')
        );
        snapshot = await getDocs(listingsQuery);
      } catch (orderError) {
        // Fallback to simple query if orderBy fails (index might not exist)
        snapshot = await getDocs(collection(db, 'listings'));
      }
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Listing[];
      // Sort manually if orderBy didn't work
      listingsData.sort((a, b) => {
        const aDate = (a as any).createdAt?.toDate?.() || new Date(0);
        const bDate = (b as any).createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      setListings(listingsData);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoadingListings(false);
    }
  };

  // Handle mention autocomplete - show ALL users when @ is pressed
  useEffect(() => {
    if (!db || !firebaseReady || !user) {
      setShowMentionSuggestions(false);
      return;
    }

    // Show suggestions when mentionQuery is set (even if empty, meaning just "@" was pressed)
    if (mentionQuery === null || mentionQuery === undefined) {
      setShowMentionSuggestions(false);
      return;
    }

    const searchUsers = async () => {
      try {
        // Get ALL users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let allUsers = usersSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              displayName: data.displayName || data.handle || 'Unknown User',
              handle: data.handle,
              photoURL: data.photoURL,
            };
          })
          .filter((u) => u.id !== user.uid); // Exclude current user
        
        // If there's a query, filter users; otherwise show all
        if (mentionQuery.trim()) {
          const query = mentionQuery.toLowerCase();
          allUsers = allUsers.filter((u) => {
            const handle = (u.handle || '').toLowerCase();
            const displayName = (u.displayName || '').toLowerCase();
            return handle.includes(query) || displayName.includes(query);
          });
        }
        
        // Limit to 20 users max for performance
        const matches = allUsers.slice(0, 20);
        
        setMentionSuggestions(matches);
        setShowMentionSuggestions(matches.length > 0);
      } catch (error) {
        console.error('Error searching users:', error);
      }
    };

    const timeoutId = setTimeout(searchUsers, mentionQuery.trim() ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [mentionQuery, user]);

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = POST_TEMPLATES.find(t => t.id === templateId);
    if (template && editorRef.current) {
      const html = markdownToHtml(template.content);
      setHtmlContent(html);
      setContent(template.content);
      setSelectedTemplate(templateId);
      
      // Clear and set HTML content
      editorRef.current.innerHTML = html;
      
      // Move cursor to end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      editorRef.current.focus();
      
      // Trigger input event to sync state
      editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  // Handle mention insertion
  const insertMention = (userId: string, displayName: string, handle?: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const currentRange = selection.getRangeAt(0);
    const cursorNode = currentRange.startContainer;
    const cursorOffset = currentRange.startOffset;
    
    // Get all text nodes and their positions
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    const textNodes: Array<{ node: Text; text: string; startPos: number }> = [];
    let totalPos = 0;
    let node = walker.nextNode();
    
    while (node) {
      const text = node.textContent || '';
      textNodes.push({ node: node as Text, text, startPos: totalPos });
      totalPos += text.length;
      node = walker.nextNode();
    }
    
    // Find cursor position in flat text
    let cursorPos = 0;
    for (const tn of textNodes) {
      if (tn.node === cursorNode) {
        cursorPos = tn.startPos + cursorOffset;
        break;
      }
    }
    
    // Find @ symbol before cursor
    let atNode: Text | null = null;
    let atOffset = 0;
    
    for (const tn of textNodes) {
      const nodeEnd = tn.startPos + tn.text.length;
      if (nodeEnd <= cursorPos) {
        // Check if @ is in this node
        const relativeCursorPos = cursorPos - tn.startPos;
        for (let i = relativeCursorPos - 1; i >= 0; i--) {
          if (tn.text[i] === '@') {
            atNode = tn.node;
            atOffset = i;
            break;
          }
          // Stop if we hit whitespace or another @
          if (tn.text[i] === ' ' || tn.text[i] === '\n' || tn.text[i] === '@') {
            break;
          }
        }
        if (atNode) break;
      }
    }
    
    if (atNode) {
      // Create range from @ to cursor
      const deleteRange = document.createRange();
      deleteRange.setStart(atNode, atOffset);
      deleteRange.setEnd(cursorNode, cursorOffset);
      
      // Delete the @query text
      deleteRange.deleteContents();
      
      // Insert mention - prefer handle, otherwise use lowercase displayName
      // This matches how the notification API looks up users (by handle or displayName lowercase)
      const mentionValue = handle || displayName.toLowerCase();
      const mentionText = `@${mentionValue} `;
      const mentionNode = document.createTextNode(mentionText);
      deleteRange.insertNode(mentionNode);
      
      // Set cursor after mention
      const newRange = document.createRange();
      newRange.setStartAfter(mentionNode);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      // Fallback: insert at cursor
      // Prefer handle, otherwise use lowercase displayName (matches notification API lookup)
      const mentionValue = handle || displayName.toLowerCase();
      const mentionText = `@${mentionValue} `;
      const mentionNode = document.createTextNode(mentionText);
      currentRange.deleteContents();
      currentRange.insertNode(mentionNode);
      currentRange.setStartAfter(mentionNode);
      currentRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(currentRange);
    }
    
    // Update content
    const html = editor.innerHTML;
    setHtmlContent(html);
    const markdown = htmlToMarkdown(html);
    setContent(markdown);
    
    setShowMentionSuggestions(false);
    setMentionQuery('');
    setMentionStartPosition(null);
    editor.focus();
  };

  // Handle editor input
  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setHtmlContent(html);
    const markdown = htmlToMarkdown(html);
    setContent(markdown);
    
    // Check for @ mentions
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const cursorNode = range.startContainer;
      const cursorOffset = range.startOffset;
      
      // Get text before cursor position
      let textBeforeCursor = '';
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let currentPos = 0;
      let node;
      let atNode: Node | null = null;
      let atOffset = 0;
      
      while ((node = walker.nextNode())) {
        const nodeText = node.textContent || '';
        const nodeLength = nodeText.length;
        
        if (node === cursorNode) {
          // Cursor is in this node
          const textUpToCursor = nodeText.substring(0, cursorOffset);
          textBeforeCursor += textUpToCursor;
          
          // Check for @ in this text
          const lastAtIndex = textBeforeCursor.lastIndexOf('@');
          if (lastAtIndex !== -1) {
            // Find which node contains the @
            let checkPos = 0;
            walker.currentNode = editorRef.current;
            let checkNode = walker.nextNode();
            while (checkNode) {
              const checkText = checkNode.textContent || '';
              const checkLength = checkText.length;
              
              if (lastAtIndex >= checkPos && lastAtIndex < checkPos + checkLength) {
                atNode = checkNode;
                atOffset = lastAtIndex - checkPos;
                break;
              }
              
              checkPos += checkLength;
              checkNode = walker.nextNode();
            }
          }
          
          break;
        } else {
          textBeforeCursor += nodeText;
          currentPos += nodeLength;
        }
      }
      
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Check if we're typing a mention (no space, newline, or @)
        // Show suggestions even if just "@" is pressed (empty textAfterAt)
        if (!textAfterAt.match(/[\s\n@]/)) {
          setMentionQuery(textAfterAt || ''); // Empty string if just "@"
          if (atNode) {
            setMentionStartPosition({ node: atNode, offset: atOffset });
          }
          return;
        }
      }
    }
    
    setShowMentionSuggestions(false);
    setMentionQuery('');
    setMentionStartPosition(null);
  };

  const loadProjects = async () => {
    if (!user || !firebaseReady || !db) return;
    
    setLoadingProjects(true);
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('creatorId', '==', user.uid)
      );
      const snapshot = await getDocs(projectsQuery);
      const projectsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!user || !firebaseReady || !storage) {
      setError('Please sign in to upload media');
      return;
    }

    // Validate files
    const validFiles: MediaFile[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        setError(`${file.name} is not an image or video file`);
        continue;
      }

      const maxSize = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 10MB for images, 100MB for videos
      if (file.size > maxSize) {
        setError(`${file.name} is too large (max ${isImage ? '10MB' : '100MB'})`);
        continue;
      }

      // Create preview
      const preview = isImage 
        ? URL.createObjectURL(file)
        : URL.createObjectURL(file);

      validFiles.push({
        file,
        preview,
        type: isImage ? 'image' : 'video',
      });
    }

    if (validFiles.length > 0) {
      setMediaFiles(prev => [...prev, ...validFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    const file = mediaFiles[index];
    if (file.preview && file.preview.startsWith('blob:')) {
      URL.revokeObjectURL(file.preview);
    }
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadMediaFiles = async (): Promise<Array<{ url: string; type: 'image' | 'video' }>> => {
    if (mediaFiles.length === 0) return [];

    if (!user || !firebaseReady || !storage) {
      throw new Error('Firebase is not configured');
    }

    setUploadingMedia(true);
    const uploadPromises = mediaFiles.map(async (mediaFile, index) => {
      // If already uploaded, return the URL and type
      if (mediaFile.url) {
        return { url: mediaFile.url, type: mediaFile.type };
      }

      const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storagePath = `message-board-media/${user.uid}/${fileId}_${mediaFile.file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);

      return new Promise<{ url: string; type: 'image' | 'video' }>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, mediaFile.file, {
          contentType: mediaFile.file.type,
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setMediaFiles(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], uploadProgress: percent };
              return updated;
            });
          },
          (error) => {
            console.error('Upload error:', error);
            reject(new Error(`Failed to upload ${mediaFile.file.name}`));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setMediaFiles(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], url: downloadURL };
                return updated;
              });
              resolve({ url: downloadURL, type: mediaFile.type });
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });

    try {
      const media = await Promise.all(uploadPromises);
      setUploadingMedia(false);
      return media;
    } catch (error) {
      setUploadingMedia(false);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !firebaseReady || !db) {
      setError('Please sign in to create a post');
      return;
    }

    // Check if editor has content
    const hasContent = editorRef.current ? 
      (editorRef.current.textContent?.trim() || editorRef.current.innerHTML.trim() !== '<br>') : 
      content.trim();
    
    if (!hasContent && mediaFiles.length === 0) {
      setError('Please enter some content or upload media for your post');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Convert HTML to markdown before submitting
      let finalContent = content;
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        finalContent = htmlToMarkdown(html);
      }

      // Upload media files first
      let media: Array<{ url: string; type: 'image' | 'video' }> = [];
      if (mediaFiles.length > 0) {
        media = await uploadMediaFiles();
      }

      // Extract hashtags and mentions
      const hashtags = extractHashtags(finalContent);
      const mentions = extractMentions(finalContent);
      const mediaEmbeds = detectMediaEmbeds(finalContent);

      // Get auth token for API call
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Create post
      const postData: any = {
        authorId: user.uid,
        content: finalContent.trim() || '',
        projectId: selectedProjectId || null,
        category: selectedCategory || null,
        hashtags: hashtags.length > 0 ? hashtags : null,
        mentions: mentions.length > 0 ? mentions : null,
        mediaEmbeds: mediaEmbeds.length > 0 ? mediaEmbeds : null,
        attachedOpportunityId: selectedOpportunityId || null,
        attachedListingId: selectedListingId || null,
        media: media.length > 0 ? media : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editHistory: [],
      };

      const postRef = await addDoc(collection(db, 'messageBoardPosts'), postData);
      const postId = postRef.id;

      // Send notifications for mentions (via API)
      if (mentions.length > 0) {
        try {
          const response = await fetch('/api/message-board/notify-mentions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              postId,
              mentions,
              authorName: user.displayName || user.email?.split('@')[0] || 'Someone',
            }),
          });
          if (!response.ok) {
            console.error('Failed to send mention notifications');
          }
        } catch (err) {
          console.error('Error sending mention notifications:', err);
        }
      }

      // Clean up preview URLs
      mediaFiles.forEach(file => {
        if (file.preview && file.preview.startsWith('blob:')) {
          URL.revokeObjectURL(file.preview);
        }
      });

      // Reset form
      setContent('');
      setHtmlContent('');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      setSelectedProjectId('');
      setSelectedCategory('');
      setSelectedTemplate('');
      setSelectedOpportunityId('');
      setSelectedListingId('');
      setMediaFiles([]);
      setShowMentionSuggestions(false);
      setMentionQuery('');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message || 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingMedia(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Create New Post</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition p-2 hover:bg-neutral-800 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Post Templates */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Choose a Template (Optional)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {POST_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`px-3 py-2 rounded-lg border transition ${
                    selectedTemplate === template.id
                      ? 'bg-ccaBlue/20 border-ccaBlue text-white'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600'
                  }`}
                >
                  <span className="text-lg mr-1">{template.icon}</span>
                  <span className="text-xs font-medium">{template.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Category (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {POST_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
                  className={`px-3 py-1.5 rounded-lg border transition text-sm ${
                    selectedCategory === category.id
                      ? 'bg-ccaBlue/20 border-ccaBlue text-white'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-600'
                  }`}
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project Selection */}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Link a Project (Optional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              >
                <option value="">No project linked</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Attach Opportunity or Marketplace Item */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Attach Opportunity and/or Marketplace Item (Optional)
            </label>
            <div className="flex gap-2">
              {opportunities.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAttachType('opportunity');
                    setShowAttachModal(true);
                  }}
                  className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition text-sm"
                >
                  {selectedOpportunityId ? 'Change Opportunity' : 'Attach Opportunity'}
                </button>
              )}
              {listings.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAttachType('listing');
                    setShowAttachModal(true);
                  }}
                  className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 transition text-sm"
                >
                  {selectedListingId ? 'Change Marketplace Item' : 'Attach Marketplace Item'}
                </button>
              )}
            </div>
            {selectedOpportunityId && (
              <div className="mt-2 p-3 bg-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-white text-sm">
                  {opportunities.find(o => o.id === selectedOpportunityId)?.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOpportunityId('')}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}
            {selectedListingId && (
              <div className="mt-2 p-3 bg-neutral-800 rounded-lg flex items-center justify-between">
                <span className="text-white text-sm">
                  {listings.find(l => l.id === selectedListingId)?.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedListingId('')}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Add Photos or Videos (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="media-upload"
            />
            <label
              htmlFor="media-upload"
              className="block w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 cursor-pointer transition text-center"
            >
              <svg className="w-6 h-6 mx-auto mb-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Click to upload photos or videos</span>
              <span className="text-xs text-neutral-500 block mt-1">Images: max 10MB • Videos: max 100MB</span>
            </label>

            {/* Media Previews */}
            {mediaFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mediaFiles.map((mediaFile, index) => (
                  <div key={index} className="relative group">
                    {mediaFile.type === 'image' ? (
                      <img
                        src={mediaFile.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-neutral-700"
                      />
                    ) : (
                      <video
                        src={mediaFile.preview}
                        className="w-full h-32 object-cover rounded-lg border border-neutral-700"
                        controls={false}
                      />
                    )}
                    {mediaFile.uploadProgress !== undefined && mediaFile.uploadProgress < 100 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="text-white text-xs font-semibold">
                          {Math.round(mediaFile.uploadProgress)}%
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rich Text Formatting Toolbar */}
          <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-lg border border-neutral-700">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                applyFormatting('bold', editorRef);
              }}
              className="p-2 hover:bg-neutral-700 rounded transition group relative"
              title="Bold (Ctrl+B)"
            >
              <svg className="w-4 h-4 text-neutral-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
              </svg>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Bold
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                applyFormatting('italic', editorRef);
              }}
              className="p-2 hover:bg-neutral-700 rounded transition group relative"
              title="Italic (Ctrl+I)"
            >
              <svg className="w-4 h-4 text-neutral-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Italic
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                applyFormatting('code', editorRef);
              }}
              className="p-2 hover:bg-neutral-700 rounded transition group relative"
              title="Inline Code"
            >
              <svg className="w-4 h-4 text-neutral-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-neutral-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                Code
              </span>
            </button>
            <div className="flex-1" />
            <span className="text-xs text-neutral-500">Use @ to mention users, # for hashtags</span>
          </div>

          {/* Content */}
          <div className="relative">
            <label className="block text-sm font-semibold text-white mb-2">
              What's on your mind?
            </label>
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onKeyDown={(e) => {
                  if (showMentionSuggestions && e.key === 'ArrowDown') {
                    e.preventDefault();
                  } else if (showMentionSuggestions && e.key === 'Enter') {
                    e.preventDefault();
                    if (mentionSuggestions.length > 0) {
                      insertMention(mentionSuggestions[0].id, mentionSuggestions[0].displayName, mentionSuggestions[0].handle);
                    }
                  } else if (showMentionSuggestions && e.key === 'Escape') {
                    e.preventDefault();
                    setShowMentionSuggestions(false);
                    setMentionQuery('');
                    setMentionStartPosition(null);
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    // Allow Enter to create new line
                    document.execCommand('insertLineBreak', false);
                    e.preventDefault();
                  }
                }}
                data-placeholder="Share your project, discuss your onset experience, ask questions, or start a conversation... Use @ to mention users, # for hashtags"
                className="w-full min-h-[200px] px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                suppressContentEditableWarning={true}
              />
              {!htmlContent && (
                <div className="absolute top-3 left-4 text-neutral-500 pointer-events-none">
                  Share your project, discuss your onset experience, ask questions, or start a conversation... Use @ to mention users, # for hashtags
                </div>
              )}
              
              {/* Mention Suggestions - Appears directly below text box */}
              {showMentionSuggestions && mentionSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-neutral-800">
                    <div className="text-xs text-neutral-400 font-medium">
                      {mentionQuery.trim() ? `Searching for "${mentionQuery}"...` : 'All users - Select to mention'}
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {mentionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => insertMention(suggestion.id, suggestion.displayName, suggestion.handle)}
                        className="w-full px-4 py-2.5 text-left hover:bg-neutral-800 transition flex items-center gap-3 border-b border-neutral-800/50 last:border-b-0"
                      >
                        {suggestion.photoURL ? (
                          <img
                            src={suggestion.photoURL}
                            alt={suggestion.displayName}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-neutral-700"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-10 h-10 rounded-full bg-ccaBlue flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 border border-neutral-700 ${suggestion.photoURL ? 'hidden' : ''}`}
                        >
                          {suggestion.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{suggestion.displayName}</div>
                          {suggestion.handle && (
                            <div className="text-neutral-400 text-xs truncate">@{suggestion.handle}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-sm text-neutral-400">
              <div>
                {extractHashtags(content).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {extractHashtags(content).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-ccaBlue/20 text-ccaBlue rounded text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>{content.length} characters</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-neutral-300 hover:text-white transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingMedia || (!content.trim() && mediaFiles.length === 0)}
              className="px-6 py-2.5 bg-ccaBlue hover:bg-ccaBlue/90 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting || uploadingMedia ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {uploadingMedia ? 'Uploading...' : 'Posting...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Post
                </>
              )}
            </button>
          </div>
        </form>

        {/* Attach Opportunity/Listing Modal */}
        {showAttachModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  Select {attachType === 'opportunity' ? 'Opportunity' : 'Marketplace Item'}
                </h3>
                <button
                  onClick={() => {
                    setShowAttachModal(false);
                    setAttachType(null);
                  }}
                  className="text-neutral-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-3">
                {attachType === 'opportunity' && (
                  <>
                    {loadingOpportunities ? (
                      <div className="text-neutral-400 text-center py-8">Loading...</div>
                    ) : opportunities.length === 0 ? (
                      <div className="text-neutral-400 text-center py-8">No opportunities found</div>
                    ) : (
                      opportunities.map((opp) => (
                        <button
                          key={opp.id}
                          type="button"
                          onClick={() => {
                            setSelectedOpportunityId(opp.id);
                            setShowAttachModal(false);
                            setAttachType(null);
                          }}
                          className={`w-full p-4 rounded-lg border text-left transition ${
                            selectedOpportunityId === opp.id
                              ? 'bg-ccaBlue/20 border-ccaBlue'
                              : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                          }`}
                        >
                          <div className="font-semibold text-white">{opp.title}</div>
                          <div className="text-sm text-neutral-400 mt-1">
                            {opp.company} • {opp.location} • {opp.type}
                            {opp.amount && ` • $${(opp.amount / 100).toFixed(2)}`}
                          </div>
                        </button>
                      ))
                    )}
                  </>
                )}
                {attachType === 'listing' && (
                  <>
                    {loadingListings ? (
                      <div className="text-neutral-400 text-center py-8">Loading...</div>
                    ) : listings.length === 0 ? (
                      <div className="text-neutral-400 text-center py-8">No listings found</div>
                    ) : (
                      listings.map((listing) => (
                        <button
                          key={listing.id}
                          type="button"
                          onClick={() => {
                            setSelectedListingId(listing.id);
                            setShowAttachModal(false);
                            setAttachType(null);
                          }}
                          className={`w-full p-4 rounded-lg border text-left transition ${
                            selectedListingId === listing.id
                              ? 'bg-ccaBlue/20 border-ccaBlue'
                              : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {listing.images && listing.images.length > 0 && (
                              <img
                                src={listing.images[0]}
                                alt={listing.title}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-semibold text-white">{listing.title}</div>
                              <div className="text-sm text-neutral-400 mt-1">
                                ${listing.price.toFixed(2)} • {listing.condition}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

