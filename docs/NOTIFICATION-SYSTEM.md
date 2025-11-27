# Notification System Documentation

## Overview

A comprehensive, system-wide notification system for all CCA memberships and Legacy Creators. The system provides real-time in-app notifications for various events across the platform.

## Architecture

### Data Model

**Collection**: `users/{userId}/notifications`

Each notification document contains:
- `type`: NotificationType (see types below)
- `title`: Short notification title
- `message`: Detailed notification message
- `actionUrl`: Optional URL to navigate when clicked
- `actionLabel`: Optional label for the action button
- `read`: Boolean indicating if notification has been read
- `readAt`: Timestamp when notification was marked as read
- `createdAt`: Timestamp when notification was created
- `metadata`: Additional type-specific data

### Notification Types

#### Job-Related
- `job_application_submitted` - Applicant confirmation when they submit an application
- `job_application_received` - Employer notification when they receive a new application
- `job_application_accepted` - Applicant notification when hired
- `job_application_rejected` - Applicant notification when not selected
- `job_deposit_paid` - Contractor notification when deposit is paid
- `job_final_payment_paid` - Contractor notification when final payment is received
- `job_completed` - Employer notification when contractor marks job as complete

#### Order-Related
- `order_placed` - Seller notification when they receive a new order
- `order_delivered` - Buyer notification when order is ready for download
- `order_dispute` - Seller/Buyer notification when dispute is created

#### Payment-Related
- `payout_processed` - Seller notification when payout is processed

#### Message-Related
- `message_received` - User notification when they receive a new message

#### Membership-Related
- `membership_expiring` - Member notification when subscription is expiring soon
- `membership_expired` - Member notification when subscription expires

#### Legacy Creator-Related
- `legacy_subscription_active` - User notification when Legacy+ subscription becomes active
- `legacy_subscription_canceled` - User notification when Legacy+ subscription is canceled

## Components

### 1. NotificationBell (`src/components/NotificationBell.tsx`)
- Bell icon with unread count badge
- Dropdown showing last 10 notifications
- Click to mark as read and navigate
- Real-time updates via Firestore listeners

### 2. NotificationsPage (`src/app/notifications/page.tsx`)
- Full-page notification view
- Filter by type (All, Jobs, Orders, Messages, Payouts, Membership)
- Group notifications by date
- Mark all as read functionality
- Click notification to navigate to related page

### 3. Hooks (`src/hooks/useNotifications.ts`)
- `useNotifications(limitCount)` - Fetch notifications with real-time updates
- `useUnreadNotificationsCount()` - Get unread count only
- `markNotificationAsRead(userId, notificationId)` - Mark single notification as read
- `markAllNotificationsAsRead(userId)` - Mark all notifications as read

### 4. Utility Functions (`src/lib/notifications.ts`)
- `createNotification(userId, data)` - Create a single notification
- `createNotificationsForUsers(userIds, data)` - Create notifications for multiple users
- `createJobNotification(userId, type, jobData)` - Helper for job notifications
- `createOrderNotification(userId, type, orderData)` - Helper for order notifications
- `createPayoutNotification(userId, payoutData)` - Helper for payout notifications
- `createMembershipNotification(userId, type, membershipData)` - Helper for membership notifications

## Integration Points

### Job Applications
**File**: `src/app/api/jobs/apply/route.ts`
- Creates `job_application_submitted` notification for applicant
- Creates `job_application_received` notification for employer

**File**: `src/app/api/jobs/hire/route.ts`
- Creates `job_application_accepted` notification for applicant when hired

### Job Payments
**File**: `src/app/api/webhooks/stripe/route.ts`
- `checkout.session.completed` handler creates `job_deposit_paid` notification
- `payment_intent.succeeded` handler creates `job_final_payment_paid` notification

### Marketplace Orders
**File**: `src/app/api/webhooks/stripe/route.ts`
- `checkout.session.completed` handler creates:
  - `order_placed` notification for seller
  - `order_delivered` notification for buyer

### UI Integration
**File**: `src/components/SiteHeader.tsx`
- NotificationBell component added next to Messages button
- Mobile menu includes Notifications link

## Usage Examples

### Creating a Notification

```typescript
import { createNotification } from '@/lib/notifications';

await createNotification(userId, {
  type: 'job_application_submitted',
  title: 'Application Submitted',
  message: 'Your application has been submitted successfully.',
  actionUrl: '/dashboard',
  actionLabel: 'View Dashboard',
  metadata: { applicationId: '123' }
});
```

### Using Helper Functions

```typescript
import { createJobNotification } from '@/lib/notifications';

await createJobNotification(userId, 'job_deposit_paid', {
  jobTitle: 'Video Editor Position',
  companyName: 'ABC Productions',
  applicationId: '123',
  amount: 50000 // in cents
});
```

### Reading Notifications in Components

```typescript
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const { notifications, unreadCount, loading } = useNotifications(50);
  
  // Use notifications...
}
```

## Features

### Real-Time Updates
- All notification components use Firestore `onSnapshot` listeners
- Notifications appear instantly without page refresh
- Unread count updates automatically

### Notification Preferences
- Users can control notification preferences in dashboard
- Preferences stored in `users/{userId}/notificationPrefs`
- Currently supports: `orderPlaced`, `disputeCreated`, `payoutPaid`

### Account Type Awareness
- Notifications are filtered based on user account type
- CCA Members see membership-related notifications
- Legacy Creators see Legacy+ subscription notifications
- Sellers see order and payout notifications
- Employers see job application notifications

## Future Enhancements

1. **Email Notifications**: Integrate with EmailJS to send email notifications for important events
2. **Push Notifications**: Add browser push notifications for critical events
3. **Notification Preferences UI**: Allow users to customize which notifications they receive
4. **Notification Groups**: Group related notifications (e.g., multiple orders)
5. **Notification Actions**: Add quick actions (e.g., "Accept", "Reject") directly from notifications
6. **Notification History**: Archive old notifications for reference

## Testing

To test notifications:

1. **Job Application**: Submit a job application → Check applicant and employer notifications
2. **Job Deposit**: Pay deposit for a job → Check contractor notification
3. **Order Placement**: Purchase from marketplace → Check buyer and seller notifications
4. **Mark as Read**: Click notification → Verify it's marked as read
5. **Filter**: Use filter buttons on notifications page → Verify filtering works

## Troubleshooting

### Notifications Not Appearing
- Check Firestore security rules allow read/write to `users/{userId}/notifications`
- Verify user is authenticated
- Check browser console for errors

### Real-Time Updates Not Working
- Verify Firestore connection is active
- Check network connectivity
- Ensure `firebaseReady` is true

### Notification Creation Failing
- Check server logs for errors
- Verify `adminDb` is initialized
- Ensure user ID is valid

