import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace with actual config from firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0576077491",
  appId: "1:423204194228:web:4401da3cfce16ca19d14e1",
  apiKey: "AIzaSyB097PRp8jIgkaI7Mcy1AaRXOKYO20M-jA",
  authDomain: "gen-lang-client-0576077491.firebaseapp.com",
  storageBucket: "gen-lang-client-0576077491.firebasestorage.app",
  messagingSenderId: "423204194228"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-7c3fd21d-d7a4-4494-b572-5a5a5902d114");

const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
