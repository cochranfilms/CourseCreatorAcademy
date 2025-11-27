"use client";
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, addDoc, serverTimestamp, updateDoc, Timestamp, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { UserDirectory } from './UserDirectory';

type Thread = {
  id: string;
  type: 'dm' | 'course' | 'group';
  members: string[];
  createdAt?: Timestamp;
  lastMessageAt?: Timestamp;
  lastMessage?: string;
  lastMessageSenderId?: string;
  otherUser?: {
    displayName: string;
    photoURL?: string;
    handle?: string;
  };
  unreadCount?: number;
};

type DirectoryUser = {
  id: string;
  displayName: string;
  photoURL?: string;
  handle?: string;
  email?: string;
};

type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: Timestamp;
  readBy?: string[];
};

type MessagesProps = {
  isOpen: boolean;
  onClose: () => void;
  // Optional: when provided, open/create a DM with this user immediately
  initialRecipientUserId?: string;
};

export function Messages({ isOpen, onClose, initialRecipientUserId }: MessagesProps) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showUserDirectory, setShowUserDirectory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [threadUnreadCounts, setThreadUnreadCounts] = useState<{ [threadId: string]: number }>({});
  const [allUsers, setAllUsers] = useState<DirectoryUser[]>([]);

  // Track unread counts per thread
  useEffect(() => {
    if (!isOpen || !firebaseReady || !db || !user || threads.length === 0) {
      setThreadUnreadCounts({});
      return;
    }

    const unreadCounts: { [threadId: string]: number } = {};
    const messageUnsubscribes: (() => void)[] = [];

    threads.forEach(thread => {
      const messagesQuery = query(
        collection(db, 'threads', thread.id, 'messages')
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const unread = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.senderId !== user.uid && 
                 (!data.readBy || !data.readBy.includes(user.uid));
        }).length;

        unreadCounts[thread.id] = unread;
        setThreadUnreadCounts(prev => ({ ...prev, ...unreadCounts }));
      });

      messageUnsubscribes.push(unsubscribe);
    });

    return () => {
      messageUnsubscribes.forEach(unsub => unsub());
    };
  }, [threads, isOpen, user]);

  // Load directory users once while Messages is open
  useEffect(() => {
    if (!isOpen || !firebaseReady || !db) {
      setAllUsers([]);
      return;
    }

    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const usersList: DirectoryUser[] = [];
        snapshot.docs.forEach((docSnap) => {
          if (docSnap.id === user?.uid) return;
          const data = docSnap.data();
          usersList.push({
            id: docSnap.id,
            displayName: data.displayName || data.email?.split('@')[0] || 'Unknown User',
            photoURL: data.photoURL,
            handle: data.handle,
            email: data.email,
          });
        });
        usersList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setAllUsers(usersList);
      },
      (error) => {
        console.error('Error loading users:', error);
      }
    );

    return () => unsubscribe();
  }, [isOpen, user]);

  // Fetch threads for current user
  useEffect(() => {
    if (!isOpen || !firebaseReady || !db || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const threadsQuery = query(
      collection(db, 'threads'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      threadsQuery,
      async (snapshot) => {
        const threadsData: Thread[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const thread: Thread = {
            id: docSnap.id,
            type: data.type || 'dm',
            members: data.members || [],
            createdAt: data.createdAt,
            lastMessageAt: data.lastMessageAt || data.createdAt,
            lastMessage: data.lastMessage,
            lastMessageSenderId: data.lastMessageSenderId,
          };

          // Get other user's info for DM threads
          if (thread.type === 'dm' && thread.members.length === 2) {
            const otherUserId = thread.members.find(m => m !== user.uid);
            if (otherUserId) {
              try {
                const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
                if (otherUserDoc.exists()) {
                  const otherUserData = otherUserDoc.data();
                  // Prioritize displayName from Firestore, fallback to email prefix
                  const displayName = otherUserData.displayName || 
                                    otherUserData.email?.split('@')[0] || 
                                    'Unknown User';
                  thread.otherUser = {
                    displayName: displayName,
                    photoURL: otherUserData.photoURL,
                    handle: otherUserData.handle,
                  };
                } else {
                  // No Firestore profile exists - create one with placeholder
                  thread.otherUser = {
                    displayName: 'Unknown User',
                    photoURL: undefined,
                    handle: undefined,
                  };
                }
              } catch (error) {
                console.error('Error fetching user:', error);
                thread.otherUser = {
                  displayName: 'Unknown User',
                };
              }
            }
          }

          threadsData.push(thread);
        }

        // Sort by lastMessageAt descending
        threadsData.sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis() || 0;
          const bTime = b.lastMessageAt?.toMillis() || 0;
          return bTime - aTime;
        });

        setThreads(threadsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching threads:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, user]);

  // Auto-open a DM with a specific user when provided
  useEffect(() => {
    if (!isOpen || !initialRecipientUserId || !user) return;
    if (initialRecipientUserId === user.uid) return;
    // debounce slightly to allow threads to load
    const timeout = setTimeout(() => {
      handleCreateThread(initialRecipientUserId);
    }, 200);
    return () => clearTimeout(timeout);
  }, [isOpen, initialRecipientUserId, user]);

  // Fetch messages for selected thread
  useEffect(() => {
    if (!selectedThreadId || !firebaseReady || !db) return;

    const messagesQuery = query(
      collection(db, 'threads', selectedThreadId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(messagesData);
      
      // Update thread with last message info if it's from someone else
      if (messagesData.length > 0 && user) {
        const lastMessage = messagesData[messagesData.length - 1];
        if (lastMessage.senderId !== user.uid) {
          await updateDoc(doc(db, 'threads', selectedThreadId), {
            lastMessage: lastMessage.text,
            lastMessageSenderId: lastMessage.senderId,
            lastMessageAt: lastMessage.createdAt || serverTimestamp(),
          });
        }
      }
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [selectedThreadId, user]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedThreadId || !firebaseReady || !db || !user) return;

    const threadRef = doc(db, 'threads', selectedThreadId);
    const messagesQuery = query(
      collection(db, 'threads', selectedThreadId, 'messages')
    );

    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      const unreadMessages = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.senderId !== user.uid && (!data.readBy || !data.readBy.includes(user.uid));
        });

      if (unreadMessages.length > 0) {
        const batch = unreadMessages.map(msgDoc => {
          const msgData = msgDoc.data();
          const readBy = msgData.readBy || [];
          if (!readBy.includes(user.uid)) {
            updateDoc(doc(db, 'threads', selectedThreadId, 'messages', msgDoc.id), {
              readBy: [...readBy, user.uid]
            });
          }
        });
        await Promise.all(batch);
      }
    });

    return () => unsubscribe();
  }, [selectedThreadId, user]);

  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !selectedThreadId || !user) return;

    try {
      const idToken = await user.getIdToken();
      if (!idToken) {
        alert('Please sign in');
        return;
      }

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          threadId: selectedThreadId,
          text: newMessageText.trim(),
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setNewMessageText('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message. Please try again.');
    }
  };

  const formatTimestamp = (timestamp?: Timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleCreateThread = async (userId: string) => {
    if (!firebaseReady || !db || !user || userId === user.uid) return;

    try {
      // Check if thread already exists
      const threadsQuery = query(
        collection(db, 'threads'),
        where('type', '==', 'dm'),
        where('members', 'array-contains', user.uid)
      );

      const snapshot = await getDocs(threadsQuery);
      const existingThread = snapshot.docs.find((doc) => {
        const data = doc.data();
        return data.members.includes(userId) && data.members.length === 2;
      });

      if (existingThread) {
        setSelectedThreadId(existingThread.id);
        setShowUserDirectory(false);
        return;
      }

      // Create new thread
      const threadData = {
        type: 'dm',
        members: [user.uid, userId],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      };

      const threadRef = await addDoc(collection(db, 'threads'), threadData);
      setSelectedThreadId(threadRef.id);
      setShowUserDirectory(false);
    } catch (error) {
      console.error('Error creating thread:', error);
      alert('Failed to create conversation. Please try again.');
    }
  };

  if (!isOpen) return null;

  const selectedThread = threads.find(t => t.id === selectedThreadId);
  const filteredUsers: DirectoryUser[] = searchQuery
    ? allUsers.filter((u) => {
        const q = searchQuery.toLowerCase();
        return (
          u.displayName.toLowerCase().includes(q) ||
          (u.handle?.toLowerCase().includes(q) ?? false) ||
          (u.email?.toLowerCase().includes(q) ?? false)
        );
      })
    : [];

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Messages Container */}
        <div className="relative w-full max-w-4xl h-[90vh] sm:h-[80vh] bg-neutral-900 rounded-lg sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 border-b border-neutral-800 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">Messages</h2>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar - Conversations */}
            <div className={`${selectedThreadId ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-neutral-800 flex flex-col`}>
              {/* Search Bar */}
              <div className="p-2 sm:p-3 md:p-4 border-b border-neutral-800 flex-shrink-0">
                <div className="relative">
                  <svg className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue text-sm sm:text-base"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-full px-4">
                    <div className="text-neutral-400 text-sm sm:text-base">Loading conversations...</div>
                  </div>
                ) : searchQuery ? (
                  <div className="divide-y divide-neutral-800">
                    {/* People results (from user directory) */}
                    <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500">People</div>
                    {filteredUsers.length === 0 ? (
                      <div className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-neutral-500 text-sm sm:text-base">No users found</div>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleCreateThread(u.id)}
                          className="w-full p-2 sm:p-3 md:p-4 hover:bg-neutral-800 transition text-left touch-manipulation min-h-[60px] sm:min-h-[70px]"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                                  {u.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white truncate text-sm sm:text-base">{u.displayName}</div>
                              <div className="text-xs sm:text-sm text-neutral-400 truncate">{u.handle ? `@${u.handle}` : u.email || ''}</div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}

                    {/* Conversations that match */}
                    <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500">Conversations</div>
                    {threads
                      .filter((thread) => {
                        const searchLower = searchQuery.toLowerCase();
                        return (
                          thread.otherUser?.displayName.toLowerCase().includes(searchLower) ||
                          thread.otherUser?.handle?.toLowerCase().includes(searchLower)
                        );
                      })
                      .map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full p-2 sm:p-3 md:p-4 hover:bg-neutral-800 transition text-left relative touch-manipulation min-h-[60px] sm:min-h-[70px] ${
                            selectedThreadId === thread.id ? 'bg-neutral-800' : ''
                          }`}
                        >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                          {thread.otherUser?.photoURL ? (
                            <img
                              src={thread.otherUser.photoURL}
                              alt={thread.otherUser.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                              {thread.otherUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          )}
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-neutral-600 rounded-full border-2 border-neutral-900"></div>
                          {threadUnreadCounts[thread.id] > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-neutral-900">
                                  <span className="text-white text-xs font-bold">{threadUnreadCounts[thread.id] > 9 ? '9+' : threadUnreadCounts[thread.id]}</span>
                            </div>
                          )}
                        </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <div className="font-semibold text-white truncate text-sm sm:text-base min-w-0">
                                {thread.otherUser?.displayName || 'Unknown User'}
                                  {threadUnreadCounts[thread.id] > 0 && <span className="ml-1.5 sm:ml-2 inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></span>}
                            </div>
                            {thread.lastMessageAt && (
                              <span className={`text-[10px] sm:text-xs ml-2 flex-shrink-0 whitespace-nowrap ${
                                threadUnreadCounts[thread.id] > 0 ? 'text-white font-semibold' : 'text-neutral-500'
                              }`}>
                                {formatTimestamp(thread.lastMessageAt)}
                              </span>
                            )}
                          </div>
                          <div className={`text-xs sm:text-sm truncate ${
                            threadUnreadCounts[thread.id] > 0 ? 'text-white font-medium' : 'text-neutral-400'
                          }`}>
                                {thread.lastMessage ? (thread.lastMessageSenderId === user?.uid ? `You: ${thread.lastMessage}` : thread.lastMessage) : 'No messages yet'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                ) : threads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-3 sm:px-4">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-600 mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-neutral-400 mb-2 text-sm sm:text-base">No conversations yet</p>
                    <p className="text-xs sm:text-sm text-neutral-500 px-2">Start a new conversation to begin messaging</p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800">
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={`w-full p-2 sm:p-3 md:p-4 hover:bg-neutral-800 transition text-left relative touch-manipulation min-h-[60px] sm:min-h-[70px] ${
                          selectedThreadId === thread.id ? 'bg-neutral-800' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                            {thread.otherUser?.photoURL ? (
                              <img src={thread.otherUser.photoURL} alt={thread.otherUser.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                                {thread.otherUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                              </div>
                            )}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-neutral-600 rounded-full border-2 border-neutral-900"></div>
                            {threadUnreadCounts[thread.id] > 0 && (
                              <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-neutral-900">
                                <span className="text-white text-xs font-bold">{threadUnreadCounts[thread.id] > 9 ? '9+' : threadUnreadCounts[thread.id]}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <div className="font-semibold text-white truncate text-sm sm:text-base min-w-0">
                                {thread.otherUser?.displayName || 'Unknown User'}
                                {threadUnreadCounts[thread.id] > 0 && <span className="ml-1.5 sm:ml-2 inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></span>}
                              </div>
                              {thread.lastMessageAt && (
                                <span className={`text-[10px] sm:text-xs ml-2 flex-shrink-0 whitespace-nowrap ${
                                  threadUnreadCounts[thread.id] > 0 ? 'text-white font-semibold' : 'text-neutral-500'
                                }`}>
                                  {formatTimestamp(thread.lastMessageAt)}
                                </span>
                              )}
                            </div>
                            <div className={`text-xs sm:text-sm truncate ${
                              threadUnreadCounts[thread.id] > 0 ? 'text-white font-medium' : 'text-neutral-400'
                            }`}>
                              {thread.lastMessage ? (thread.lastMessageSenderId === user?.uid ? `You: ${thread.lastMessage}` : thread.lastMessage) : 'No messages yet'}
                          </div>
                        </div>
                      </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* New Message Button */}
              <div className="p-2 sm:p-3 md:p-4 border-t border-neutral-800 flex-shrink-0">
                <button
                  onClick={() => setShowUserDirectory(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 rounded-lg transition flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation min-h-[44px] text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="whitespace-nowrap">New Message</span>
                </button>
              </div>
            </div>

            {/* Right Content Area - Messages */}
            <div className="flex-1 flex flex-col min-w-0">
              {selectedThread ? (
                <>
                  {/* Chat Header */}
                  <div className="p-2 sm:p-3 md:p-4 border-b border-neutral-800 flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {/* Back button for mobile */}
                      <button
                        onClick={() => setSelectedThreadId(null)}
                        className="md:hidden text-neutral-400 hover:text-white transition flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center mr-1"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
                        {selectedThread.otherUser?.photoURL ? (
                          <img
                            src={selectedThread.otherUser.photoURL}
                            alt={selectedThread.otherUser.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                            {selectedThread.otherUser?.displayName.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white truncate text-sm sm:text-base">
                          {selectedThread.otherUser?.displayName || 'Unknown User'}
                        </div>
                        <div className="text-xs sm:text-sm text-neutral-400 truncate">
                          {selectedThread.otherUser?.handle && `@${selectedThread.otherUser.handle}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4 min-h-0">
                    {messages.map((message, index) => {
                      const isOwn = message.senderId === user?.uid;
                      const isRead = message.readBy?.includes(user?.uid || '') || message.senderId === user?.uid;
                      const isUnread = !isRead && !isOwn;
                      
                      // Check if this is the first unread message
                      const previousMessage = index > 0 ? messages[index - 1] : null;
                      const previousIsRead = previousMessage?.readBy?.includes(user?.uid || '') || previousMessage?.senderId === user?.uid;
                      const showUnreadDivider = isUnread && (index === 0 || previousIsRead);

                      return (
                        <div key={message.id}>
                          {/* Unread message divider */}
                          {showUnreadDivider && (
                            <div className="flex items-center gap-2 my-4">
                              <div className="flex-1 h-px bg-red-500/30"></div>
                              <span className="text-xs text-red-400 font-medium px-2">New Messages</span>
                              <div className="flex-1 h-px bg-red-500/30"></div>
                            </div>
                          )}
                          <div
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`relative max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 ${
                              isOwn 
                                ? 'bg-ccaBlue text-white' 
                                : isUnread 
                                  ? 'bg-neutral-800 text-white ring-2 ring-red-500/50' 
                                  : 'bg-neutral-800 text-white'
                            }`}>
                              {/* Unread indicator dot */}
                              {isUnread && (
                                <div className="absolute -left-1.5 sm:-left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full border-2 border-neutral-900"></div>
                              )}
                              <p className="text-xs sm:text-sm break-words">{message.text}</p>
                              <div className="flex items-center justify-end gap-1.5 sm:gap-2 mt-1">
                                {message.createdAt && (
                                  <p className={`text-[10px] sm:text-xs ${
                                    isOwn ? 'text-blue-100' : 'text-neutral-400'
                                  }`}>
                                    {formatTimestamp(message.createdAt)}
                                  </p>
                                )}
                                {/* Read receipt for own messages */}
                                {isOwn && (
                                  <div className="flex items-center flex-shrink-0">
                                    {isRead ? (
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-200/50" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-2 sm:p-3 md:p-4 border-t border-neutral-800 flex-shrink-0">
                    <div className="flex gap-1.5 sm:gap-2">
                      <input
                        type="text"
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue text-sm sm:text-base min-w-0"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessageText.trim()}
                        className="px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 bg-ccaBlue text-white rounded-lg hover:bg-ccaBlue/90 transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] text-sm sm:text-base whitespace-nowrap"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-3 sm:px-4 min-w-0">
                  <svg className="w-16 h-16 sm:w-20 sm:h-20 text-neutral-600 mb-3 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-2 break-words">Your Messages</h3>
                  <p className="text-sm sm:text-base text-neutral-400 mb-4 sm:mb-6 px-2 break-words">
                    Select a conversation from the sidebar or start a new one to begin messaging.
                  </p>
                  <button
                    onClick={() => setShowUserDirectory(true)}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition flex items-center gap-1.5 sm:gap-2 mx-auto touch-manipulation min-h-[44px] text-sm sm:text-base"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="whitespace-nowrap">New Message</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Directory */}
      {showUserDirectory && (
        <UserDirectory
          isOpen={showUserDirectory}
          onClose={() => setShowUserDirectory(false)}
          onSelectUser={handleCreateThread}
        />
      )}
    </>
  );
}

