"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

export type NotificationType = 
  | 'job_application_submitted'
  | 'job_application_received'
  | 'job_application_accepted'
  | 'job_application_rejected'
  | 'job_deposit_paid'
  | 'job_final_payment_paid'
  | 'job_completed'
  | 'order_placed'
  | 'order_delivered'
  | 'order_dispute'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'payout_processed'
  | 'message_received'
  | 'membership_expiring'
  | 'membership_expired'
  | 'legacy_subscription_active'
  | 'legacy_subscription_canceled';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  readAt?: any;
  createdAt: any;
  metadata?: Record<string, any>;
}

export function useNotifications(limitCount: number = 50) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !firebaseReady || !db) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(limitCount));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      let unread = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        notifs.push({
          id: doc.id,
          ...data,
        } as Notification);
        
        if (!data.read) {
          unread++;
        }
      });

      setNotifications(notifs);
      setUnreadCount(unread);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, limitCount]);

  return { notifications, unreadCount, loading };
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !firebaseReady || !db) {
      setUnreadCount(0);
      return;
    }

    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notificationsRef, where('read', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error('Error fetching unread count:', error);
    });

    return () => unsubscribe();
  }, [user]);

  return unreadCount;
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  if (!db || !userId || !notificationId) return;

  try {
    const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: new Date(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!db || !userId || !firebaseReady) return;

  try {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, where('read', '==', false));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        read: true,
        readAt: new Date(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

