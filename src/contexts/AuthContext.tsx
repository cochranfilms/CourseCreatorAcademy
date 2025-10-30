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
import { doc, setDoc, getDoc } from 'firebase/firestore';

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
      if (!existingData.photoURL && user.photoURL) {
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
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Ensure profile is created/updated
    await ensureUserProfile(result.user);
  };

  const signInWithFacebook = async () => {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Ensure profile is created/updated
    await ensureUserProfile(result.user);
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
