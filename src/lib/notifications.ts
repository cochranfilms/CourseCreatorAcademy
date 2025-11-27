import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export type NotificationType = 
  | 'job_application_submitted'      // Applicant: confirmation
  | 'job_application_received'        // Employer: new application
  | 'job_application_accepted'        // Applicant: hired
  | 'job_application_rejected'        // Applicant: not selected
  | 'job_deposit_paid'                // Contractor: deposit received
  | 'job_final_payment_paid'          // Contractor: final payment
  | 'job_completed'                   // Employer: contractor marked complete
  | 'order_placed'                    // Seller: new order
  | 'order_delivered'                 // Buyer: order ready
  | 'order_dispute'                   // Seller/Buyer: dispute created
  | 'payout_processed'                 // Seller: payout sent
  | 'message_received'                // User: new message
  | 'membership_expiring'             // Member: subscription expiring soon
  | 'membership_expired'               // Member: subscription expired
  | 'legacy_subscription_active'       // User: Legacy+ subscription active
  | 'legacy_subscription_canceled';     // User: Legacy+ subscription canceled

export interface NotificationData {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

/**
 * Creates a notification for a user
 * @param userId - The user ID to create the notification for
 * @param data - Notification data
 * @returns The notification document ID
 */
export async function createNotification(
  userId: string,
  data: NotificationData
): Promise<string | null> {
  if (!adminDb || !userId) {
    console.warn('Cannot create notification: adminDb or userId missing');
    return null;
  }

  try {
    const notificationRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc();

    await notificationRef.set({
      type: data.type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl || null,
      actionLabel: data.actionLabel || null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      metadata: data.metadata || {},
    });

    return notificationRef.id;
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Creates multiple notifications for multiple users (batch operation)
 */
export async function createNotificationsForUsers(
  userIds: string[],
  data: NotificationData
): Promise<void> {
  if (!adminDb || userIds.length === 0) return;

  try {
    const batch = adminDb.batch();
    
    userIds.forEach(userId => {
      const notificationRef = adminDb
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .doc();
      
      batch.set(notificationRef, {
        type: data.type,
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl || null,
        actionLabel: data.actionLabel || null,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        metadata: data.metadata || {},
      });
    });

    await batch.commit();
  } catch (error: any) {
    console.error('Error creating batch notifications:', error);
  }
}

/**
 * Helper function to create job-related notifications
 */
export async function createJobNotification(
  userId: string,
  type: 'job_application_submitted' | 'job_application_received' | 'job_application_accepted' | 'job_application_rejected' | 'job_deposit_paid' | 'job_final_payment_paid' | 'job_completed',
  jobData: {
    jobTitle: string;
    companyName?: string;
    applicationId?: string;
    amount?: number;
    employerName?: string;
    applicantName?: string;
  }
): Promise<string | null> {
  const notifications: Record<string, NotificationData> = {
    job_application_submitted: {
      type: 'job_application_submitted',
      title: 'Application Submitted',
      message: `Your application for "${jobData.jobTitle}"${jobData.companyName ? ` at ${jobData.companyName}` : ''} has been submitted successfully.`,
      actionUrl: '/dashboard',
      actionLabel: 'View Dashboard',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle },
    },
    job_application_received: {
      type: 'job_application_received',
      title: 'New Application Received',
      message: `${jobData.applicantName || 'Someone'} applied for "${jobData.jobTitle}".`,
      actionUrl: `/dashboard`,
      actionLabel: 'Review Application',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle },
    },
    job_application_accepted: {
      type: 'job_application_accepted',
      title: 'You\'ve Been Hired!',
      message: `Congratulations! You've been hired for "${jobData.jobTitle}"${jobData.companyName ? ` at ${jobData.companyName}` : ''}.`,
      actionUrl: '/dashboard',
      actionLabel: 'View Job',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle },
    },
    job_application_rejected: {
      type: 'job_application_rejected',
      title: 'Application Update',
      message: `Your application for "${jobData.jobTitle}"${jobData.companyName ? ` at ${jobData.companyName}` : ''} was not selected.`,
      actionUrl: '/dashboard',
      actionLabel: 'View Dashboard',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle },
    },
    job_deposit_paid: {
      type: 'job_deposit_paid',
      title: 'Deposit Payment Received',
      message: `The employer has paid the deposit ($${jobData.amount?.toFixed(2) || '0.00'}) for "${jobData.jobTitle}". You can now begin work!`,
      actionUrl: '/dashboard',
      actionLabel: 'View Job',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle, amount: jobData.amount },
    },
    job_final_payment_paid: {
      type: 'job_final_payment_paid',
      title: 'Final Payment Received',
      message: `Final payment ($${jobData.amount?.toFixed(2) || '0.00'}) has been received for "${jobData.jobTitle}".`,
      actionUrl: '/dashboard',
      actionLabel: 'View Job',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle, amount: jobData.amount },
    },
    job_completed: {
      type: 'job_completed',
      title: 'Job Marked as Complete',
      message: `The contractor has marked "${jobData.jobTitle}" as complete. Please complete the final payment.`,
      actionUrl: '/dashboard',
      actionLabel: 'View Job',
      metadata: { applicationId: jobData.applicationId, jobTitle: jobData.jobTitle },
    },
  };

  const notificationData = notifications[type];
  if (!notificationData) return null;

  return createNotification(userId, notificationData);
}

/**
 * Helper function to create order-related notifications
 */
export async function createOrderNotification(
  userId: string,
  type: 'order_placed' | 'order_delivered' | 'order_dispute',
  orderData: {
    orderId: string;
    listingTitle: string;
    amount?: number;
    buyerName?: string;
    sellerName?: string;
  }
): Promise<string | null> {
  const notifications: Record<string, NotificationData> = {
    order_placed: {
      type: 'order_placed',
      title: 'New Order Received',
      message: `${orderData.buyerName || 'A customer'} purchased "${orderData.listingTitle}" for $${orderData.amount ? (orderData.amount / 100).toFixed(2) : '0.00'}.`,
      actionUrl: '/orders',
      actionLabel: 'View Order',
      metadata: { orderId: orderData.orderId, listingTitle: orderData.listingTitle },
    },
    order_delivered: {
      type: 'order_delivered',
      title: 'Order Ready',
      message: `Your order for "${orderData.listingTitle}" is ready for download.`,
      actionUrl: '/orders',
      actionLabel: 'View Order',
      metadata: { orderId: orderData.orderId, listingTitle: orderData.listingTitle },
    },
    order_dispute: {
      type: 'order_dispute',
      title: 'Order Dispute Created',
      message: `A dispute has been created for order "${orderData.listingTitle}".`,
      actionUrl: '/orders',
      actionLabel: 'View Dispute',
      metadata: { orderId: orderData.orderId, listingTitle: orderData.listingTitle },
    },
  };

  const notificationData = notifications[type];
  if (!notificationData) return null;

  return createNotification(userId, notificationData);
}

/**
 * Helper function to create payout notifications
 */
export async function createPayoutNotification(
  userId: string,
  payoutData: {
    amount: number;
    currency?: string;
  }
): Promise<string | null> {
  return createNotification(userId, {
    type: 'payout_processed',
    title: 'Payout Processed',
    message: `Your payout of $${(payoutData.amount / 100).toFixed(2)} ${payoutData.currency || 'USD'} has been processed.`,
    actionUrl: '/dashboard',
    actionLabel: 'View Dashboard',
    metadata: { amount: payoutData.amount, currency: payoutData.currency || 'USD' },
  });
}

/**
 * Helper function to create membership notifications
 */
export async function createMembershipNotification(
  userId: string,
  type: 'membership_expiring' | 'membership_expired',
  membershipData: {
    planName: string;
    expiresAt?: Date;
  }
): Promise<string | null> {
  const notifications: Record<string, NotificationData> = {
    membership_expiring: {
      type: 'membership_expiring',
      title: 'Membership Expiring Soon',
      message: `Your ${membershipData.planName} membership will expire soon. Renew to continue enjoying all benefits.`,
      actionUrl: '/dashboard',
      actionLabel: 'Renew Membership',
      metadata: { planName: membershipData.planName, expiresAt: membershipData.expiresAt },
    },
    membership_expired: {
      type: 'membership_expired',
      title: 'Membership Expired',
      message: `Your ${membershipData.planName} membership has expired. Renew to regain access.`,
      actionUrl: '/dashboard',
      actionLabel: 'Renew Membership',
      metadata: { planName: membershipData.planName },
    },
  };

  const notificationData = notifications[type];
  if (!notificationData) return null;

  return createNotification(userId, notificationData);
}

