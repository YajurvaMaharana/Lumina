import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getRedirectResult, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isAdmin: boolean;
  redirectError: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false, redirectError: null });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    // Check if returning from a signInWithRedirect flow
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("[Firebase Auth] Redirect sign-in successful for:", result.user.email);
        }
      })
      .catch((error) => {
        console.error("[Firebase Auth] Redirect sign-in error:", {
          code: error?.code,
          message: error?.message,
          domain: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
        });
        setRedirectError(error?.message || error?.code || "Redirect authentication failed");
      });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser?.email) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', currentUser.email));
          setIsAdmin(adminDoc.exists() && adminDoc.data()?.isAdmin === true);
        } catch (error) {
          console.error("[Firebase Auth] Error fetching admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, redirectError }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
