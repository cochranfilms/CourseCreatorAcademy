/**
 * Script to extend the Adobe discount expiration date
 * Run with: node scripts/extend-adobe-discount.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../service-account-key.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.error('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or service-account-key.json exists');
  process.exit(1);
}

const db = admin.firestore();

async function extendAdobeDiscount() {
  const discountId = 'hZY3bWLybDWYWo40by1J';
  const newExpirationDate = new Date('2025-12-31T23:59:00Z'); // December 31, 2025 at 11:59 PM UTC

  try {
    const discountRef = db.collection('discounts').doc(discountId);
    const discountDoc = await discountRef.get();

    if (!discountDoc.exists) {
      console.error(`Discount ${discountId} not found!`);
      process.exit(1);
    }

    const currentData = discountDoc.data();
    const currentExpiration = currentData.expirationDate?.toDate?.() || currentData.expirationDate;

    console.log('Current expiration:', currentExpiration);
    console.log('New expiration:', newExpirationDate.toISOString());

    await discountRef.update({
      expirationDate: admin.firestore.Timestamp.fromDate(newExpirationDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Successfully extended Adobe discount expiration to ${newExpirationDate.toISOString()}`);
    console.log('The discount should now appear on the homepage and discounts page.');
  } catch (error) {
    console.error('Error extending discount:', error);
    process.exit(1);
  }
}

extendAdobeDiscount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

