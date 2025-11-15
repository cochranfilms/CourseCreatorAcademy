"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider
} from 'firebase/auth';
import { auth, firebaseReady, db } from '@/lib/firebaseClient';
import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signInWithFacebook: async () => {},
  logout: async () => {},
  resetPassword: async () => {}
});

// Helper function to create/update user profile in Firestore
async function ensureUserProfile(user: User) {
  if (!firebaseReady || !db) return;
  
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // Create new profile with data from Firebase Auth
      await setDoc(userDocRef, {
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        photoURL: user.photoURL || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Update existing profile with latest auth data if missing
      const existingData = userDoc.data();
      const updates: any = {};
      
      if (!existingData.displayName && user.displayName) {
        updates.displayName = user.displayName;
      }
      
      // Sync photoURL from Firebase Auth if:
      // 1. Firestore doesn't have one (null, undefined, or empty), OR
      // 2. Firestore has one but it's a Google/OAuth URL (not a custom uploaded Firebase Storage URL)
      // This ensures Google photos are always synced, but custom uploaded photos are preserved
      const existingPhotoURL = existingData.photoURL;
      const hasPhotoURL = existingPhotoURL && typeof existingPhotoURL === 'string' && existingPhotoURL.trim() !== '';
      const isCustomUploadedPhoto = hasPhotoURL && (
        existingPhotoURL.includes('firebasestorage.googleapis.com') ||
        existingPhotoURL.includes('firebase/storage')
      );
      
      if (user.photoURL && (!hasPhotoURL || !isCustomUploadedPhoto)) {
        // Only update if Firebase Auth has a photoURL and Firestore doesn't have a custom uploaded one
        updates.photoURL = user.photoURL;
      }
      
      if (!existingData.email && user.email) {
        updates.email = user.email;
      }
      
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await setDoc(userDocRef, updates, { merge: true });
      }
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      // Ensure user profile exists in Firestore when user signs in
      if (user) {
        await ensureUserProfile(user);
        // Attempt to auto-claim any guest purchases made with this email
        // Wrap in try-catch and handle errors gracefully to prevent app crashes
        try {
          if (firebaseReady && db && user.email) {
            // Normalize email to lowercase for comparison (matching Firestore rules)
            const normalizedEmail = user.email.toLowerCase().trim();
            const claimsQ = query(
              collection(db, 'pendingMemberships'), 
              where('email', '==', normalizedEmail), 
              where('claimed', '==', false)
            );
            
            try {
              const snap = await getDocs(claimsQ);
              if (!snap.empty) {
                const batch = writeBatch(db);
                const userRef = doc(db, 'users', user.uid);
                // If multiple claims, apply the latest plan; record all as claimed
                let latestPlan: string | null = null;
                let latestSub: string | null = null;
                
                // Filter docs to only process those we have permission to update
                const processableDocs = snap.docs.filter((d) => {
                  const data = d.data();
                  // Verify email matches (case-insensitive) before processing
                  const docEmail = (data.email || '').toLowerCase().trim();
                  return docEmail === normalizedEmail;
                });
                
                if (processableDocs.length > 0) {
                  processableDocs.forEach((d) => {
                    const data = d.data() as any;
                    latestPlan = data?.planType || latestPlan;
                    latestSub = data?.subscriptionId || latestSub;
                    batch.update(doc(db, 'pendingMemberships', d.id), {
                      claimed: true,
                      claimedBy: user.uid,
                      claimedAt: new Date()
                    });
                  });
                  
                  if (latestPlan || latestSub) {
                    batch.set(userRef, {
                      membershipActive: true,
                      ...(latestPlan ? { membershipPlan: latestPlan } : {}),
                      ...(latestSub ? { membershipSubscriptionId: latestSub } : {}),
                      updatedAt: new Date()
                    }, { merge: true });
                  }
                  
                  try {
                    await batch.commit();
                  } catch (batchError: any) {
                    // Permission errors on batch commit are non-fatal
                    if (batchError?.code !== 'permission-denied') {
                      console.error('Failed to commit membership claim batch', batchError);
                    }
                  }
                }
              }
            } catch (queryError: any) {
              // Permission errors on query are non-fatal - user may not have any pending memberships
              if (queryError?.code !== 'permission-denied') {
                console.error('Failed to query pending memberships', queryError);
              }
            }
          }
        } catch (e: any) {
          // Catch-all error handler - ensure errors don't crash the app
          // Only log non-permission errors to avoid noise
          if (e?.code !== 'permission-denied') {
            console.error('Failed to claim pending membership for user', e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [firebaseReady, auth]);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    // Direct signup is disabled. Accounts are created after Stripe membership checkout.
    throw new Error('Direct signup is disabled. Start a membership to create your account.');
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Ensure profile is created/updated
    try {
      await ensureUserProfile(result.user);
    } catch (error) {
      // Profile creation failure shouldn't block sign-in
      console.error('Failed to ensure user profile after Google sign-in:', error);
    }
  };

  const signInWithFacebook = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Ensure profile is created/updated
    try {
      await ensureUserProfile(result.user);
    } catch (error) {
      // Profile creation failure shouldn't block sign-in
      console.error('Failed to ensure user profile after Facebook sign-in:', error);
    }
  };

  const logout = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      signInWithGoogle, 
      signInWithFacebook,
      logout, 
      resetPassword 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
