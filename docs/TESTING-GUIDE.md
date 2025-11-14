# Creator Collective Testing Guide

![Creator Collective Logo](../public/CC-Logo-Black.png)

## Welcome, Testers!

Thank you for taking the time to test **Creator Collective**! Your feedback is invaluable as we prepare to launch our platform. This guide will walk you through everything Creator Collective offers and how to test each feature.

---

## What is Creator Collective?

Creator Collective is your all-in-one platform for creators. Whether you're learning new skills, connecting with other creators, finding work opportunities, or buying/selling gear, everything you need is in one place.

### What We Offer:

1. **Learning Hub** - Access hundreds of video courses covering filmmaking, editing, business, and more
2. **Community Messaging** - Connect with other creators through direct messages and course channels
3. **Job Board** - Find paid gigs or post opportunities to hire talent
4. **Marketplace** - Buy and sell gear directly with other creators
5. **Creator Kits** - Exclusive content, assets, and gear recommendations from top creators
6. **Your Dashboard** - Manage your profile, projects, orders, and settings

---

## Getting Started

### ⚠️ Important: This is a Test Environment

**Everything you see is test data!** When testing payments or connecting accounts, you can use completely fake information. This is all happening in Stripe's test mode (sandbox), so no real money will be charged and no real personal information is needed.

---

### Step 1: Create Your Account (Subscribe to Join)

**Important:** To create an account on Creator Collective, you must subscribe to a monthly membership plan. Your account is created automatically when you complete the checkout process.

**How to sign up:**

1. Go to the Creator Collective homepage
2. Click **"Sign Up"** in the top right corner (or click **"Sign Up Now"** on the homepage)
3. You'll see two plan options:
   - **Monthly Plan - $37/month** - Access to all courses, community, and downloads
   - **All-Access Membership - $87/month** - Everything in Monthly plus access to all Legacy Creator profiles
4. Choose a plan and click the button
5. A checkout window will open

**Using Test Payment Information:**

Since this is a test environment, use these fake details:

- **Card Number:** `4242 4242 4242 4242`
- **Expiry Date:** Any future date (e.g., `12/25`)
- **CVC:** Any 3 digits (e.g., `123`)
- **ZIP Code:** Any 5 digits (e.g., `12345`)
- **Email:** Use any email address (doesn't need to be real)
- **Name:** Use any name

6. Complete the checkout form with the test information above
7. Click **"Subscribe"** or **"Complete Payment"**
8. After successful checkout, you'll be automatically signed in and redirected to your dashboard
9. Your account is now created!

**What to test:**
- Can you see the subscription plans?
- Does the checkout window open correctly?
- Can you complete checkout with the test card number?
- Are you automatically signed in after checkout?
- Can you access your dashboard?

**Already have an account?**
- Click **"Sign In"** or **"Login"** in the top right
- Enter your email and password (or use Google/Facebook login)
- You'll be taken to your dashboard

---

## Pre-Populated Test Data

**Good news!** The platform comes with pre-populated test data to help you test:

- **10+ Job Opportunities** - Various job types (Full Time, Part Time, Contract, Freelance, Internship) across different locations
- **12+ Marketplace Listings** - Camera gear, lenses, lighting equipment, and accessories with realistic prices and descriptions

If you need to add more test data or reset the data, you can run the seed script:
```bash
node scripts/seed-test-data.js
```

This will populate the Opportunities and Marketplace collections with realistic test listings.

---

## Testing Each Feature

### 1. Learning Hub

**What it is:** Browse and watch video courses on filmmaking, editing, business, and more.

**How to test:**

1. Click **"Learn"** in the navigation menu
2. Browse the course catalog
3. Click on any course card to open it
4. Watch a video lesson
5. Navigate between lessons using the sidebar
6. Check your progress - you should see a progress bar showing how much of the course you've completed
7. Try saving a course by clicking the heart icon on a course card

**What to check:**
- Do videos play smoothly?
- Can you navigate between lessons easily?
- Does your progress save correctly?
- Are course thumbnails loading properly?

---

### 2. Community Messaging

**What it is:** Send direct messages to other creators or chat in course-specific channels.

**How to test:**

1. Click the **Messages** icon (usually in the header or navigation)
2. Start a new conversation:
   - Click "New Message" or the "+" button
   - Search for another user by name
   - Select them and start typing
3. Send a few messages back and forth
4. Check if read receipts appear (when the other person sees your message)
5. Try messaging someone from a course page or marketplace listing

**What to check:**
- Do messages send instantly?
- Do you see when messages are read?
- Can you find other users easily?
- Do notifications work (if enabled)?

---

### 3. Job Board (Opportunities)

**What it is:** Browse job listings or post opportunities to hire creators.

**How to test:**

**Browsing Jobs:**
1. Click **"Opportunities"** or **"Job Board"** in the navigation
2. Use the search bar to find specific jobs
3. Filter by job type (Full Time, Part Time, Contract, etc.)
4. Click on a job to see details
5. Click "Apply Now" to go to the application link

**Posting a Job:**
1. Click **"Post an Opportunity"** button
2. Fill in the form:
   - Job Title (e.g., "Travel Videographer Needed")
   - Company/Your Name
   - Location (or "Remote")
   - Job Type
   - **Amount** (e.g., $1000 for a $1,000 job - this is the total payment amount)
   - Application URL (link to where people apply)
   - Description (optional)
3. Click **"Post Opportunity"**
4. View your posted jobs by clicking **"My Listings"**

**What to check:**
- Can you search and filter jobs easily?
- Do job listings display correctly?
- Can you post a job successfully?
- Can you delete your own job posts?

---

### 3a. Job Payment System (Escrow Deposit)

**What it is:** A secure two-payment system for hiring creators. When you hire someone, you pay a 25% deposit upfront (with a 3% platform fee), and then pay the remaining 75% when the job is completed.

**How the Payment System Works:**

1. **Deposit Payment (25% of total):**
   - When you hire an applicant, you pay 25% of the total job amount upfront
   - A 3% platform fee is taken from the deposit amount
   - Example: For a $1,000 job:
     - Deposit: $250 (25%)
     - Platform fee: $7.50 (3% of $250)
     - Net to creator: $242.50

2. **Final Payment (75% of total):**
   - When the job is marked as complete, you pay the remaining 75%
   - No platform fee is charged on the final payment
   - Example: For a $1,000 job:
     - Final payment: $750 (75%)
     - Platform fee: $0
     - Net to creator: $750

**Total Platform Fee:** Only 3% of the deposit (not the full amount)

**How to test the complete payment flow:**

**As a Job Poster (Hiring Someone):**

1. **Post a job opportunity** with an amount (e.g., $1,000)
2. **Wait for applications** or have a test account apply
3. **Go to your Dashboard** → **Jobs** tab
4. **Click "Hire"** on an application
   - You'll see a message that the applicant needs a Stripe Connect account
   - Both you and the applicant need Stripe Connect accounts set up
5. **After hiring**, you'll see a **"Pay Deposit"** button
6. **Click "Pay Deposit"**:
   - A Stripe checkout window will open
   - Use test card: `4242 4242 4242 4242`
   - Complete the payment
   - You'll be redirected back to your dashboard
7. **Once payment is complete**, the application status changes to "hired"
8. **When the job is done**, the applicant marks it as "complete"
9. **You'll see a "Pay Final Amount"** button
10. **Click "Pay Final Amount"**:
    - Another Stripe checkout window opens
    - Use the same test card: `4242 4242 4242 4242`
    - Complete the payment
    - The job is now fully paid

**As an Applicant (Being Hired):**

1. **Apply to a job opportunity**
2. **Set up your Stripe Connect account** (see "Stripe Connect Setup" below)
3. **Wait for the poster to hire you**
4. **Once hired**, you'll see the job status change to "hired"
5. **After the poster pays the deposit**, you'll see payment information
6. **Complete the work** and mark the job as "complete"
7. **Wait for the poster to pay the final amount**
8. **Once fully paid**, you'll see "Payment Complete" status

**Important Notes:**
- **Both parties need Stripe Connect accounts** to use the payment system
- The deposit (25%) is held as escrow - it shows commitment from both parties
- The platform fee (3%) is only charged on the deposit, not the full amount
- Payments are processed through Stripe (test mode)
- You can use fake test data for all Stripe Connect onboarding

**What to check:**
- Can you hire an applicant successfully?
- Does the deposit payment checkout work?
- Is the correct amount calculated (25% of total)?
- Does the final payment checkout work?
- Is the correct amount calculated (75% of total)?
- Do payment statuses update correctly?
- Can you see payment history?

---

### 4. Marketplace

**What it is:** Buy and sell gear, equipment, and other items with other creators.

**How to test:**

**Browsing Listings:**
1. Click **"Marketplace"** in the navigation
2. Browse the gear listings
3. Use the search bar to find specific items
4. Filter by condition (New, Like New, Excellent, etc.) and location
5. Click on a listing to see full details and images
6. Try viewing multiple images if a listing has them

**Selling an Item:**
1. **First:** You need to connect your Stripe account to sell items (see "Stripe Connect Setup" below)
2. Once connected, click **"Sell Item"** button
3. Fill in the listing form:
   - Upload images (first image is the main one)
   - Title (e.g., "Canon 6D Mark II Body")
   - Price
   - Shipping cost (or $0 for free shipping)
   - Condition
   - Location
   - Description
4. Click **"Post Listing"**
5. View your listings by clicking **"My Listings"**
6. Edit or delete listings as needed

**Stripe Connect Setup (Required to Sell Items AND Receive Job Payments):**

**When do you need Stripe Connect?**
- **Selling items** in the Marketplace
- **Receiving payments** as a hired applicant (for jobs)
- **Hiring applicants** (you need it to pay them)

**How to set it up:**
1. Go to your **Dashboard** → **Onboarding** tab
2. Click **"Connect Stripe"** button
3. You'll be redirected to Stripe's onboarding form
4. **Use fake test data:**
   - Business type: Choose "Individual" or "Company" (either works)
   - Business name: Any name (e.g., "Test Business")
   - Email: Any email
   - Phone: Any phone number (e.g., `555-123-4567`)
   - Address: Any address
   - Social Security Number (SSN) or EIN: Use `000-00-0000` or any fake number
   - Bank account: Use test account `000123456789` (routing) and `000987654321` (account)
   - Any other required fields: Use fake information
5. Complete all steps in the Stripe form
6. You'll be redirected back to Creator Collective
7. Your Stripe account is now connected!

**Note:** You only need to do this once. After connecting, you can both sell items and receive job payments.

**What to check:**
- Can you browse listings easily?
- Do images load properly?
- Can you filter and search effectively?
- Can you complete Stripe Connect onboarding with fake data?
- Can you create a listing successfully after connecting Stripe?
- Can you edit or delete your listings?

**Buying an Item (Test Purchase):**
- When you click **"Buy Now"** on a listing, you'll go through Stripe checkout
- Use the same test card: `4242 4242 4242 4242`
- Use any fake billing information
- Complete the purchase to test the buying flow

---

### 5. Creator Kits

**What it is:** Exclusive content, assets (LUTs, presets, SFX), and gear recommendations from top creators.

**How to test:**

1. Go to the homepage or **"Learn"** page
2. Scroll to the **"Creator Kits"** section
3. Browse through different creator profiles
4. Click on a creator kit to see:
   - Their exclusive content
   - Available assets (if you have access)
   - Gear recommendations
5. If you're subscribed to a creator, check that you can access their exclusive content

**What to check:**
- Do creator kits display correctly?
- Can you navigate between different creators?
- Is the content organized clearly?

---

### 6. Your Dashboard

**What it is:** Manage your profile, projects, orders, and account settings.

**How to test:**

1. Click your profile icon or **"Dashboard"** in the navigation
2. Explore the different tabs:

**Profile Tab:**
- Edit your display name, handle, title, bio
- Add your location and specialties
- Upload a profile picture and banner image
- Add social media links (LinkedIn, Instagram, YouTube)
- Set privacy preferences

**Projects Tab:**
- Add a project:
  - Title and description
  - Upload a project image
  - Add skills/tags
  - Add a project URL
- View your saved projects
- Edit or delete projects

**Orders Tab:**
- View your purchase history
- See order details and receipts

**Onboarding Tab (for Creators Who Want to Sell or Receive Job Payments):**
- Connect your Stripe account to:
  - Sell items in the marketplace
  - Receive payments when hired for jobs
  - Hire applicants (you need it to pay them)
- Click **"Connect Stripe"** to start the onboarding process
- **Use fake test data** in Stripe's form:
  - Business information: Any fake business name
  - Personal information: Any fake name, email, phone
  - Tax ID/SSN: Use `000-00-0000` or any fake number
  - Bank account: Use test numbers `000123456789` (routing) and `000987654321` (account)
  - Address: Any fake address
- Complete all required steps
- Once connected, you can:
  - Post marketplace listings
  - Receive job payments when hired
  - Hire applicants and pay them

**What to check:**
- Can you update your profile successfully?
- Do images upload correctly?
- Can you add and manage projects?
- Can you view your orders?
- Does Stripe Connect onboarding work with fake test data?
- Can you complete the full Stripe onboarding flow?

---

### 7. Authentication & Account Management

**How to test:**

1. **Sign Up:** Subscribe to a plan to create your account (see Getting Started section)
2. **Log In:** Log out and log back in using your email/password or social login
3. **Password Reset:** Try the "Forgot Password" feature
4. **Profile Updates:** Change your name, email, or password in Dashboard settings
5. **Log Out:** Make sure you can log out successfully

**What to check:**
- Does the subscription checkout process work smoothly?
- Are you automatically signed in after checkout?
- Can you log in reliably after creating an account?
- Do password resets work?
- Are your changes saved correctly?

---

## Important Testing Notes

### Using Test Data

**Remember:** This entire platform is running in test mode. You can and should use fake information for:

- **Payment Cards:** Always use `4242 4242 4242 4242` for any purchase
- **Stripe Connect Onboarding:** Use fake business info, SSN (`000-00-0000`), bank accounts, addresses, etc.
- **Email Addresses:** Any email works (doesn't need to be real)
- **Personal Information:** Use any fake names, addresses, phone numbers

**No real money will be charged and no real personal information is required!**

### Test Card Numbers

For different payment scenarios, you can use these Stripe test cards:

- **Successful payment:** `4242 4242 4242 4242`
- **Declined payment:** `4000 0000 0000 0002`
- **Requires authentication:** `4000 0025 0000 3155`
- **Insufficient funds:** `4000 0000 0000 9995`

Use any future expiry date (e.g., `12/25`), any 3-digit CVC (e.g., `123`), and any ZIP code (e.g., `12345`).

### Testing with Multiple Accounts

**Tip:** To test features that require two users (like messaging, job applications, or marketplace transactions), you can:

1. **Use incognito/private browsing** to create a second account
2. **Use a different browser** (e.g., Chrome for one account, Firefox for another)
3. **Use different email addresses** (they don't need to be real)

This lets you test interactions between users without needing another person.

### Common Testing Scenarios

**Testing Job Payments:**
1. Create two accounts (poster and applicant)
2. Both accounts need Stripe Connect set up
3. Poster creates a job with an amount
4. Applicant applies
5. Poster hires applicant
6. Poster pays deposit (25%)
7. Applicant marks job as complete
8. Poster pays final amount (75%)

**Testing Marketplace:**
1. Create two accounts (seller and buyer)
2. Seller needs Stripe Connect set up
3. Seller creates a listing
4. Buyer purchases the item
5. Check that payment flows correctly

**Testing Messaging:**
1. Create two accounts
2. One user sends a message to the other
3. Check that messages appear in real-time
4. Test read receipts

---

## Things to Pay Attention To

As you test, please note:

1. **Speed & Performance**
   - Do pages load quickly?
   - Do videos start playing without long delays?
   - Are images loading properly?
   - Do payment flows complete without hanging?

2. **Ease of Use**
   - Is it clear how to use each feature?
   - Are buttons and links easy to find?
   - Is the navigation intuitive?
   - Are error messages helpful and clear?
   - Do payment amounts display correctly?

3. **Visual Design**
   - Does everything look good?
   - Are there any broken layouts on your screen size?
   - Do colors and fonts look professional?
   - Are payment amounts and fees clearly displayed?

4. **Bugs & Errors**
   - Do you encounter any error messages?
   - Does anything break or stop working?
   - Are there any features that don't work as expected?
   - Do payment calculations seem correct?
   - Do status updates happen in real-time?

5. **Mobile Experience** (if testing on phone/tablet)
   - Does everything work on mobile?
   - Is it easy to use on a smaller screen?
   - Are buttons and text readable?
   - Can you complete payments on mobile?

6. **Payment System**
   - Are deposit amounts calculated correctly (25% of total)?
   - Are final payment amounts calculated correctly (75% of total)?
   - Is the platform fee only charged on the deposit (3%)?
   - Do payment statuses update correctly after checkout?
   - Can you see payment history?

---

## Reporting Issues

If you find something that doesn't work or seems confusing:

1. **Take a screenshot** (if possible)
2. **Note what you were doing** when the issue occurred
3. **Describe what happened** vs. what you expected
4. **Share your feedback** with the team

---

## Thank You!

Your testing helps us make Creator Collective the best platform possible for creators. We appreciate your time and feedback!

**Happy Testing! 🎬**

---

*Questions? Reach out to the Creator Collective team.*

