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
};

export function Messages({ isOpen, onClose }: MessagesProps) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showUserDirectory, setShowUserDirectory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!newMessageText.trim() || !selectedThreadId || !firebaseReady || !db || !user) return;

    try {
      const messageData = {
        senderId: user.uid,
        text: newMessageText.trim(),
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      };

      await addDoc(collection(db, 'threads', selectedThreadId, 'messages'), messageData);

      // Update thread's lastMessageAt and lastMessage
      await updateDoc(doc(db, 'threads', selectedThreadId), {
        lastMessageAt: serverTimestamp(),
        lastMessage: newMessageText.trim(),
        lastMessageSenderId: user.uid,
      });

      setNewMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
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

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Messages Container */}
        <div className="relative w-full max-w-4xl h-[80vh] bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h2 className="text-xl font-bold text-white">Messages</h2>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar - Conversations */}
            <div className="w-80 border-r border-neutral-800 flex flex-col">
              {/* Search Bar */}
              <div className="p-4 border-b border-neutral-800">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-neutral-400">Loading conversations...</div>
                  </div>
                ) : threads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <svg className="w-16 h-16 text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-neutral-400 mb-2">No conversations yet</p>
                    <p className="text-sm text-neutral-500">Start a new conversation to begin messaging</p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800">
                    {threads
                      .filter(thread => {
                        if (!searchQuery) return true;
                        const searchLower = searchQuery.toLowerCase();
                        return thread.otherUser?.displayName.toLowerCase().includes(searchLower) ||
                               thread.otherUser?.handle?.toLowerCase().includes(searchLower);
                      })
                      .map(thread => (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full p-4 hover:bg-neutral-800 transition text-left ${
                            selectedThreadId === thread.id ? 'bg-neutral-800' : ''
                          }`}
                        >
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-700 flex-shrink-0">
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
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-white truncate">
                              {thread.otherUser?.displayName || 'Unknown User'}
                            </div>
                            {thread.lastMessageAt && (
                              <span className="text-xs text-neutral-500 ml-2 flex-shrink-0">
                                {formatTimestamp(thread.lastMessageAt)}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-neutral-400 truncate">
                            {thread.lastMessage 
                              ? (thread.lastMessageSenderId === user?.uid 
                                  ? `You: ${thread.lastMessage}` 
                                  : thread.lastMessage)
                              : 'No messages yet'}
                          </div>
                        </div>
                      </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* New Message Button */}
              <div className="p-4 border-t border-neutral-800">
                <button
                  onClick={() => setShowUserDirectory(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Message
                </button>
              </div>
            </div>

            {/* Right Content Area - Messages */}
            <div className="flex-1 flex flex-col">
              {selectedThread ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-700">
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
                      <div>
                        <div className="font-semibold text-white">
                          {selectedThread.otherUser?.displayName || 'Unknown User'}
                        </div>
                        <div className="text-sm text-neutral-400">
                          {selectedThread.otherUser?.handle && `@${selectedThread.otherUser.handle}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(message => {
                      const isOwn = message.senderId === user?.uid;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            isOwn ? 'bg-ccaBlue text-white' : 'bg-neutral-800 text-white'
                          }`}>
                            <p className="text-sm">{message.text}</p>
                            {message.createdAt && (
                              <p className={`text-xs mt-1 ${
                                isOwn ? 'text-blue-100' : 'text-neutral-400'
                              }`}>
                                {formatTimestamp(message.createdAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-neutral-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessageText.trim()}
                        className="px-6 py-2 bg-ccaBlue text-white rounded-lg hover:bg-ccaBlue/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                  <svg className="w-20 h-20 text-neutral-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="text-xl font-bold text-white mb-2">Your Messages</h3>
                  <p className="text-neutral-400 mb-6">
                    Select a conversation from the sidebar or start a new one to begin messaging.
                  </p>
                  <button
                    onClick={() => setShowUserDirectory(true)}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center gap-2 mx-auto"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Message
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

