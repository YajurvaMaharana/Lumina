import React, { useState } from 'react';
import { loginWithGoogle, firebaseConfig } from '../lib/firebase';
import { BookOpen, AlertTriangle, Loader2, RefreshCw, HelpCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import NeuralOrbit from './NeuralOrbit';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { redirectError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ code: string; message: string; hint?: string } | null>(
    redirectError ? { code: 'redirect-error', message: redirectError } : null
  );

  const getHelpfulErrorMessage = (err: any) => {
    const code = err?.code || 'auth/unknown';
    const rawMessage = err?.message || 'Authentication failed.';
    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    switch (code) {
      case 'auth/unauthorized-domain':
        return {
          code,
          message: `The domain '${currentDomain}' is not authorized in Firebase Console.`,
          hint: `To fix: Go to Firebase Console > Authentication > Settings > Authorized domains, and add '${currentDomain}'.`
        };
      case 'auth/operation-not-allowed':
        return {
          code,
          message: "Google Sign-In is disabled in Firebase Console.",
          hint: "To fix: Go to Firebase Console > Authentication > Sign-in method > Enable Google provider."
        };
      case 'auth/popup-blocked':
        return {
          code,
          message: "Sign-in popup was blocked by your browser.",
          hint: "Please allow popups for this site or use the 'Sign in via full page redirect' option below."
        };
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return {
          code,
          message: "Sign-in popup was closed before completing authentication.",
          hint: "Click Continue with Google to try again."
        };
      case 'auth/network-request-failed':
        return {
          code,
          message: "Network request failed while contacting Firebase Authentication.",
          hint: "Check your internet connection and ensure your ad-blocker or firewall is not blocking Firebase endpoints."
        };
      case 'auth/invalid-api-key':
        return {
          code,
          message: "The Firebase API key is invalid or restricted.",
          hint: `Verify your apiKey in firebase-applet-config.json for project '${firebaseConfig.projectId}'.`
        };
      default:
        return {
          code,
          message: rawMessage,
          hint: "Inspect the browser developer tools console (F12) for the complete error stack trace."
        };
    }
  };

  const handleLogin = async (useRedirect = false) => {
    setLoading(true);
    setErrorInfo(null);
    try {
      await loginWithGoogle(useRedirect);
    } catch (error: any) {
      console.error("[Login Component Error]:", {
        code: error?.code,
        message: error?.message,
        domain: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
        fullError: error
      });
      const parsed = getHelpfulErrorMessage(error);
      setErrorInfo(parsed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-200">
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      
      <div className="w-full max-w-md glass bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 text-center relative z-10 shadow-xl">
        <div className="flex justify-center mb-6">
          <NeuralOrbit size={64} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight glow-text mb-2 text-[var(--text-primary)]">Lumina</h1>
        <p className="text-[var(--text-muted)] mb-6 text-sm">
          A private, secure space for your thoughts, guided by AI.
        </p>

        {errorInfo && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-left space-y-2 animate-in fade-in duration-300">
            <div className="flex items-start gap-2.5 text-red-500 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold font-mono">{errorInfo.code}</p>
                <p className="text-xs font-medium mt-0.5 text-[var(--text-primary)]">{errorInfo.message}</p>
              </div>
            </div>
            {errorInfo.hint && (
              <div className="pt-2 border-t border-red-500/15 flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
                <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p>{errorInfo.hint}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            id="google-login-btn"
            onClick={() => handleLogin(false)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:opacity-90 text-[var(--text-primary)] px-6 py-3 rounded-xl font-medium transition-all outline-none focus:ring-2 focus:ring-violet-500/40 text-sm shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {loading ? "Authenticating..." : "Continue with Google"}
          </button>

          {errorInfo && (
            <button
              onClick={() => handleLogin(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-xs text-violet-600 dark:text-violet-400 hover:underline py-1.5 cursor-pointer font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              Try signing in via full page redirect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
