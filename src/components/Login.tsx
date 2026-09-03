import React from 'react';
import { loginWithGoogle } from '../lib/firebase';
import { BookOpen } from 'lucide-react';

export default function Login() {
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Failed to login. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-[#E0E6ED] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      <div className="w-full max-w-md glass rounded-2xl p-8 text-center relative z-10">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-gradient-to-tr from-violet-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BookOpen size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight glow-text mb-2 text-white">Lumina</h1>
        <p className="text-white/50 mb-8 text-sm">
          A private, secure space for your thoughts, guided by AI.
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-medium transition-colors outline-none focus:ring-2 focus:ring-violet-500/40 text-sm"
        >
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
          Continue with Google
        </button>
      </div>
    </div>
  );
}
