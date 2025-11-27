# Job Application Notifications Setup

## Overview
This document explains the notification system for job applications and how to configure EmailJS templates.

## Current Implementation

### 1. Application Success Modal ✅
- **Component**: `src/components/JobApplicationSuccessModal.tsx`
- **Trigger**: After successful application submission
- **Location**: Shown immediately after user submits application
- **Message**: Confirms application submission and instructs user to watch for notifications

### 2. Deposit Payment Email Notification ✅
- **Template**: `src/emails/templates/job-deposit-paid.html`
- **Trigger**: When employer pays deposit via Stripe webhook
- **Recipient**: Contractor (applicant)
- **Webhook Handler**: `src/app/api/webhooks/stripe/route.ts` (line ~884-930)
- **Email Service**: EmailJS

## EmailJS Template Setup

### Template: Job Deposit Paid Notification

**Template File**: `src/emails/templates/job-deposit-paid.html`

**Template Variables Used**:
- `{{contractor_name}}` - Name of the contractor/applicant
- `{{job_title}}` - Title of the job opportunity
- `{{company_name}}` - Company name
- `{{employer_name}}` - Name of the employer
- `{{deposit_amount}}` - Deposit amount in dollars (e.g., "500.00")
- `{{dashboard_url}}` - URL to dashboard (e.g., "https://coursecreatoracademy.com/dashboard")
- `{{to_email}}` - Recipient email address
- `{{year}}` - Current year

**Steps to Create Template in EmailJS**:

1. Log into EmailJS Dashboard (https://dashboard.emailjs.com)
2. Go to **Email Templates** → **Create New Template**
3. Copy the HTML content from `src/emails/templates/job-deposit-paid.html`
4. Paste into the EmailJS template editor
5. Replace the template variables with EmailJS variable syntax:
   - `{{contractor_name}}` → `{{contractor_name}}`
   - `{{job_title}}` → `{{job_title}}`
   - `{{company_name}}` → `{{company_name}}`
   - `{{employer_name}}` → `{{employer_name}}`
   - `{{deposit_amount}}` → `{{deposit_amount}}`
   - `{{dashboard_url}}` → `{{dashboard_url}}`
   - `{{to_email}}` → `{{to_email}}`
   - `{{year}}` → `{{year}}`
6. Set the **Subject** line (e.g., "Deposit Payment Received - You're Hired!")
7. Save the template and copy the **Template ID**
8. Add the Template ID to your environment variables:
   ```
   EMAILJS_TEMPLATE_ID_DEPOSIT_PAID=your_template_id_here
   ```

## Application Submission Notifications

### Current Status: ❌ Not Implemented

**Question**: Should we send an email notification when a user submits an application?

**Current Behavior**:
- Application is saved to Firestore
- Success modal is shown to user
- No email notification is sent

**Recommendation**: 
- **Optional**: Send confirmation email to applicant (low priority, since they see success modal)
- **Recommended**: Send notification email to employer when they receive a new application

**To Add Application Submission Email**:

1. Create email template in `src/emails/templates/job-application-submitted.html`
2. Add EmailJS call in `src/app/api/jobs/apply/route.ts` after line 89
3. Send to:
   - Applicant (confirmation): Optional
   - Employer (new application alert): Recommended

**Example Code for Employer Notification**:
```typescript
// In src/app/api/jobs/apply/route.ts after application is created
try {
  // Get employer email
  const employerDoc = await adminDb.collection('users').doc(opportunityData?.posterId).get();
  const employerData = employerDoc.exists ? employerDoc.data() : null;
  
  if (employerData?.email) {
    const templateId = process.env.EMAILJS_TEMPLATE_ID_NEW_APPLICATION;
    if (templateId) {
      await sendEmailJS(templateId, {
        employer_name: employerData.displayName || 'Employer',
        job_title: opportunityData?.title || 'Job Opportunity',
        applicant_name: name,
        applicant_email: email,
        application_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
        to_email: employerData.email,
        year: new Date().getFullYear().toString(),
      });
    }
  }
} catch (emailErr) {
  console.error('Failed to send application notification:', emailErr);
  // Don't fail the request if email fails
}
```

## Environment Variables Required

Add these to your `.env.local` and production environment:

```bash
# EmailJS Configuration (already configured)
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_PUBLIC_KEY=your_public_key

# New Template IDs
EMAILJS_TEMPLATE_ID_DEPOSIT_PAID=your_template_id_here
# Optional: EMAILJS_TEMPLATE_ID_NEW_APPLICATION=your_template_id_here
```

## Testing

### Test Deposit Payment Email:
1. Complete a job application
2. Employer hires applicant and pays deposit
3. Check contractor's email inbox for notification
4. Verify all template variables are populated correctly

### Test Application Success Modal:
1. Submit a job application
2. Verify success modal appears
3. Verify modal shows correct job title and company
4. Verify "Got it!" button closes modal

## Notes

- Email sending is idempotent (won't send duplicate emails)
- Email failures don't break the application flow
- All email templates use EmailJS service
- Template variables are automatically populated from application data

