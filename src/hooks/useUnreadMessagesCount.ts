"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

export function useUnreadMessagesCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !firebaseReady || !db) {
      setUnreadCount(0);
      return;
    }

    // Track unread count per thread
    const threadUnreadCounts: { [threadId: string]: number } = {};
    const messageUnsubscribes: (() => void)[] = [];

    const updateTotalUnread = () => {
      const total = Object.values(threadUnreadCounts).reduce((sum, count) => sum + count, 0);
      setUnreadCount(total);
    };

    // Listen to all threads the user is a member of
    const threadsQuery = query(
      collection(db, 'threads'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribeThreads = onSnapshot(threadsQuery, (threadsSnapshot) => {
      const threadIds = threadsSnapshot.docs.map(doc => doc.id);
      
      // Clean up old message listeners
      messageUnsubscribes.forEach(unsub => unsub());
      messageUnsubscribes.length = 0;
      Object.keys(threadUnreadCounts).forEach(key => delete threadUnreadCounts[key]);
      
      if (threadIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      threadIds.forEach((threadId) => {
        const messagesQuery = query(
          collection(db, 'threads', threadId, 'messages')
        );

        const unsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
          const unread = messagesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.senderId !== user.uid && 
                   (!data.readBy || !data.readBy.includes(user.uid));
          }).length;

          threadUnreadCounts[threadId] = unread;
          updateTotalUnread();
        });

        messageUnsubscribes.push(unsubscribe);
      });
    }, (error) => {
      console.error('Error fetching threads for unread count:', error);
      setUnreadCount(0);
    });

    return () => {
      unsubscribeThreads();
      messageUnsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  return unreadCount;
}
