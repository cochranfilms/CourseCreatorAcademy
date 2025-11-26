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
  signInWithRedirect,
  getRedirectResult,
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

// Helper function to check if user has active membership or pending membership to claim
// Uses server-side API route to bypass Firestore permission issues
async function checkMembershipStatus(user: User): Promise<boolean | null> {
  if (!firebaseReady || !user) return null; // null = couldn't check, allow access
  
  try {
    // Wait a bit for token to be ready
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Get Firebase ID token for server-side verification
    const idToken = await user.getIdToken(true); // Force refresh
    if (!idToken) {
      console.warn('[Membership Check] No ID token available, allowing access to avoid blocking legitimate users');
      return null; // Allow access if we can't check
    }

    // Call server-side API route that uses admin SDK
    const response = await fetch('/api/auth/check-membership', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      // If API fails, log but allow access to avoid blocking legitimate users
      console.warn('[Membership Check] API error:', response.status, response.statusText, '- Allowing access to avoid blocking legitimate users');
      return null; // Allow access if API fails
    }

    const data = await response.json();
    
    // Handle null (couldn't verify) vs false (no membership) vs true (has membership)
    if (data.hasMembership === null || data.hasMembership === undefined) {
      // Silently allow access if we can't verify (server may not be configured in dev)
      return null; // Couldn't verify - allow access
    }
    
    const hasMembership = Boolean(data.hasMembership);
    console.log('[Membership Check] Result:', { userId: user.uid, email: user.email, hasMembership });
    return hasMembership;
  } catch (error) {
    console.error('[Membership Check] Error checking membership status:', error);
    // On error, allow access to avoid blocking legitimate users
    // We only block if we can definitively confirm NO membership
    return null; // null = couldn't verify, allow access
  }
}

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
      if (user) {
        // Check membership status before allowing sign-in
        // Wait a moment for the user to be fully authenticated
        await new Promise(resolve => setTimeout(resolve, 200));
        const membershipCheck = await checkMembershipStatus(user);
        
        // Only block if we definitively confirmed NO membership
        // null = couldn't verify (allow access), true = has membership (allow), false = no membership (block)
        if (membershipCheck === false) {
          // Don't sign out if user is in signup checkout flow (they're trying to purchase membership)
          const isInCheckoutFlow = typeof window !== 'undefined' && sessionStorage.getItem('signup_checkout_flow') === 'true';
          const isOnSignupPage = typeof window !== 'undefined' && window.location.pathname === '/signup';
          
          if (isInCheckoutFlow || isOnSignupPage) {
            console.log('[Auth] User in signup checkout flow without membership - allowing to proceed with checkout');
            setUser(user);
            setLoading(false);
            await ensureUserProfile(user);
            return;
          }
          
          // Sign out user immediately if we confirmed they don't have membership
          console.log('[Auth] User does not have active membership, signing out...');
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error('Error signing out user:', signOutError);
          }
          setUser(null);
          setLoading(false);
          return;
        }
        
        // User has membership OR we couldn't verify (allow access to avoid blocking legitimate users)
        setUser(user);
        setLoading(false);
        
        // Ensure user profile exists in Firestore when user signs in
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
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [firebaseReady, auth]);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Wait a moment for auth state to fully propagate
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check membership immediately after sign-in using server-side API
      // Wrap in try-catch so membership check failures don't block valid logins
      try {
        const membershipCheck = await checkMembershipStatus(result.user);
        
        // Only block if we definitively confirmed NO membership
        if (membershipCheck === false) {
          // Sign out immediately if we confirmed no membership
          await signOut(auth);
          throw new Error('Membership required. Please purchase a membership to access your account.');
        }
        
        // If membershipCheck is null (couldn't verify), allow access to avoid blocking legitimate users
      } catch (membershipError: any) {
        // If membership check fails, log but don't block the login
        // Only block if it's a definitive "no membership" error
        if (membershipError.message?.includes('Membership required')) {
          throw membershipError;
        }
        // Otherwise, log the error but allow login to proceed
        console.warn('[Sign In] Membership check failed, allowing login:', membershipError);
      }
    } catch (error: any) {
      // Log Firebase Auth errors for debugging
      if (error.code) {
        console.error('[Sign In] Firebase Auth error:', {
          code: error.code,
          message: error.message,
          email: email
        });
      }
      
      // Re-throw all errors (Firebase Auth errors and membership errors)
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    // Direct signup is disabled. Accounts are created after Stripe membership checkout.
    throw new Error('Direct signup is disabled. Start a membership to create your account.');
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const provider = new GoogleAuthProvider();
    
    // Add prompt to force account selection
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      console.log('[Google Sign-In] Starting popup sign-in...');
      console.log('[Google Sign-In] Current origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
      
      // Try popup first (better UX)
      const result = await signInWithPopup(auth, provider);
      
      console.log('[Google Sign-In] Popup successful, user:', result.user.email);
      
      // Wait a moment for auth state to fully propagate
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check membership immediately after sign-in using server-side API
      const membershipCheck = await checkMembershipStatus(result.user);
      
      // Only block if we definitively confirmed NO membership
      if (membershipCheck === false) {
        // Don't sign out if user is in signup checkout flow (they're trying to purchase membership)
        const isInCheckoutFlow = typeof window !== 'undefined' && sessionStorage.getItem('signup_checkout_flow') === 'true';
        const isOnSignupPage = typeof window !== 'undefined' && window.location.pathname === '/signup';
        
        if (isInCheckoutFlow || isOnSignupPage) {
          console.log('[Google Sign-In] User in signup checkout flow without membership - allowing to proceed with checkout');
          await ensureUserProfile(result.user);
          return; // Don't throw error, allow checkout to proceed
        }
        
        console.log('[Google Sign-In] User does not have membership, signing out...');
        // Sign out immediately if we confirmed no membership
        await signOut(auth);
        throw new Error('Membership required. Please purchase a membership to access your account.');
      }
      
      // If membershipCheck is null (couldn't verify), allow access to avoid blocking legitimate users
      
      console.log('[Google Sign-In] Membership verified, ensuring profile...');
      // Ensure profile is created/updated
      await ensureUserProfile(result.user);
    } catch (error: any) {
      console.error('[Google Sign-In] Error details:', {
        code: error.code,
        message: error.message,
        email: error.email,
        credential: error.credential
      });
      
      // Re-throw membership errors
      if (error.message?.includes('Membership required')) {
        throw error;
      }
      
      // If popup was closed unexpectedly, provide helpful error
      if (error.code === 'auth/popup-closed-by-user') {
        // This usually means the popup closed due to configuration issues
        // Provide detailed error message with troubleshooting steps
        const troubleshootingSteps = `
Troubleshooting steps:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Find your OAuth 2.0 Client ID (used by Firebase)
3. Under "Authorized JavaScript origins", ensure you have:
   - https://coursecreatoracademy.vercel.app
   - https://course-creator-academy-866d6.firebaseapp.com
4. Save and wait 2-3 minutes for changes to propagate
5. Clear browser cache and try again

If the issue persists, try using email/password sign-in instead.`;
        
        throw new Error(
          'Google sign-in popup closed unexpectedly. ' +
          'This is usually due to OAuth configuration. ' +
          troubleshootingSteps
        );
      }
      
      // If popup was blocked
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup blocked. Please allow popups for this site or use email/password sign-in.');
      }
      
      // Re-throw other errors with more context
      throw error;
    }
  };

  const signInWithFacebook = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Wait a moment for auth state to fully propagate
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check membership immediately after sign-in using server-side API
      const membershipCheck = await checkMembershipStatus(result.user);
      
      // Only block if we definitively confirmed NO membership
      if (membershipCheck === false) {
        // Sign out immediately if we confirmed no membership
        await signOut(auth);
        throw new Error('Membership required. Please purchase a membership to access your account.');
      }
      
      // If membershipCheck is null (couldn't verify), allow access to avoid blocking legitimate users
      
      // Ensure profile is created/updated
      await ensureUserProfile(result.user);
    } catch (error: any) {
      // Re-throw membership errors
      if (error.message?.includes('Membership required')) {
        throw error;
      }
      
      // If popup was blocked or failed, provide helpful error
      if (error.code === 'auth/popup-blocked' || 
          error.code === 'auth/popup-closed-by-user' ||
          error.message?.includes('popup') ||
          error.message?.includes('blocked')) {
        throw new Error('Popup blocked. Please allow popups for this site or use email/password sign-in.');
      }
      
      // Re-throw other errors
      throw error;
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
