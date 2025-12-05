import { adminDb } from './firebaseAdmin';
import { FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export interface Strike {
  id: string;
  userId: string;
  reportId: string;
  reason: string;
  details?: string;
  issuedBy: string;
  issuedAt: Date;
  strikeNumber: number;
}

/**
 * Gets all strikes for a user
 */
export async function getUserStrikes(userId: string): Promise<Strike[]> {
  if (!adminDb) return [];

  try {
    const strikesSnap = await adminDb
      .collection('userStrikes')
      .where('userId', '==', userId)
      .orderBy('issuedAt', 'desc')
      .get();

    return strikesSnap.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        reportId: data.reportId,
        reason: data.reason,
        details: data.details,
        issuedBy: data.issuedBy,
        issuedAt: data.issuedAt?.toDate ? data.issuedAt.toDate() : new Date(data.issuedAt),
        strikeNumber: data.strikeNumber,
      };
    });
  } catch (error) {
    console.error(`Error fetching strikes for user ${userId}:`, error);
    return [];
  }
}

/**
 * Gets current strike count for a user
 */
export async function getUserStrikeCount(userId: string): Promise<number> {
  if (!adminDb) return 0;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return 0;
    
    const userData = userDoc.data();
    return userData?.strikes || 0;
  } catch (error) {
    console.error(`Error fetching strike count for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Issues a strike to a user
 */
export async function issueStrike(
  userId: string,
  reportId: string,
  reason: string,
  issuedBy: string,
  details?: string
): Promise<{ success: boolean; strikeId?: string; strikeCount?: number; shouldRemove?: boolean }> {
  if (!adminDb) {
    return { success: false };
  }

  try {
    // Get current strike count
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { success: false };
    }

    const userData = userDoc.data();
    const currentStrikes = userData?.strikes || 0;

    // Don't allow more than 3 strikes
    if (currentStrikes >= 3) {
      return { success: false };
    }

    const newStrikeCount = currentStrikes + 1;

    // Create strike document
    const strikeRef = await adminDb.collection('userStrikes').add({
      userId,
      reportId,
      reason,
      details: details || null,
      issuedBy,
      issuedAt: FieldValue.serverTimestamp(),
      strikeNumber: newStrikeCount,
    });

    // Update user strike count
    await adminDb.collection('users').doc(userId).update({
      strikes: newStrikeCount,
    });

    // If this is the 3rd strike, flag for removal
    const shouldRemove = newStrikeCount >= 3;

    if (shouldRemove) {
      await removeUserProfile(userId, issuedBy, `Automatic removal after 3rd strike. Reason: ${reason}`);
    }

    return {
      success: true,
      strikeId: strikeRef.id,
      strikeCount: newStrikeCount,
      shouldRemove,
    };
  } catch (error) {
    console.error(`Error issuing strike to user ${userId}:`, error);
    return { success: false };
  }
}

/**
 * Removes a strike from a user
 */
export async function removeStrike(strikeId: string, adminId: string): Promise<boolean> {
  if (!adminDb) return false;

  try {
    const strikeDoc = await adminDb.collection('userStrikes').doc(strikeId).get();
    if (!strikeDoc.exists) return false;

    const strikeData = strikeDoc.data();
    const userId = strikeData?.userId;
    const strikeNumber = strikeData?.strikeNumber;

    if (!userId) return false;

    // Delete strike
    await adminDb.collection('userStrikes').doc(strikeId).delete();

    // Update user strike count
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentStrikes = userData?.strikes || 0;
      const newStrikeCount = Math.max(0, currentStrikes - 1);

      await adminDb.collection('users').doc(userId).update({
        strikes: newStrikeCount,
      });

      // If profile was removed and strikes are now below 3, restore it
      if (userData?.profileRemoved && newStrikeCount < 3) {
        await restoreUserProfile(userId, adminId);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error removing strike ${strikeId}:`, error);
    return false;
  }
}

/**
 * Removes a user's profile
 */
export async function removeUserProfile(
  userId: string,
  removedBy: string,
  reason: string
): Promise<boolean> {
  if (!adminDb) return false;

  try {
    await adminDb.collection('users').doc(userId).update({
      profileRemoved: true,
      profileRemovedAt: FieldValue.serverTimestamp(),
      profileRemovedBy: removedBy,
      profileRemovalReason: reason,
    });

    return true;
  } catch (error) {
    console.error(`Error removing profile for user ${userId}:`, error);
    return false;
  }
}

/**
 * Restores a user's profile
 */
export async function restoreUserProfile(userId: string, restoredBy: string): Promise<boolean> {
  if (!adminDb) return false;

  try {
    await adminDb.collection('users').doc(userId).update({
      profileRemoved: false,
      profileRemovedAt: null,
      profileRemovedBy: null,
      profileRemovalReason: null,
    });

    return true;
  } catch (error) {
    console.error(`Error restoring profile for user ${userId}:`, error);
    return false;
  }
}

/**
 * Checks if a user is blocked by another user
 */
export async function isUserBlocked(blockerId: string, blockedUserId: string): Promise<boolean> {
  if (!adminDb) return false;

  try {
    const blockDoc = await adminDb
      .collection('users')
      .doc(blockerId)
      .collection('blocked')
      .doc(blockedUserId)
      .get();

    return blockDoc.exists;
  } catch (error) {
    console.error(`Error checking block status:`, error);
    return false;
  }
}

