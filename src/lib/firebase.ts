import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

// Safely access Vite environment variables or fallback to firebase-applet-config.json
const env = typeof import.meta !== 'undefined' ? (import.meta as any).env || {} : {};

export const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId || "gen-lang-client-0576077491",
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId || "1:423204194228:web:4401da3cfce16ca19d14e1",
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey || "AIzaSyB097PRp8jIgkaI7Mcy1AaRXOKYO20M-jA",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain || "gen-lang-client-0576077491.firebaseapp.com",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket || "gen-lang-client-0576077491.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId || "423204194228"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfigData.firestoreDatabaseId || "ai-studio-7c3fd21d-d7a4-4494-b572-5a5a5902d114");

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const loginWithGoogle = async (useRedirect = false) => {
  try {
    if (useRedirect) {
      console.log("[Firebase Auth] Initiating Google login with Redirect...");
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    console.log("[Firebase Auth] Initiating Google login with Popup...");
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const errorDetails = {
      code: error?.code,
      message: error?.message,
      email: error?.customData?.email,
      domain: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId
    };
    console.error("[Firebase Auth Error Details]:", errorDetails, error);

    // Auto-fallback to redirect if popup is blocked
    if (error?.code === 'auth/popup-blocked') {
      console.warn("[Firebase Auth] Popup blocked by browser policy. Falling back to signInWithRedirect...");
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("[Firebase Auth Error signing out]:", error);
    throw error;
  }
};
