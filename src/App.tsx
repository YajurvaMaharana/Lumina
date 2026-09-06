/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import JournalView from './components/JournalView';
import AdminDashboard from './components/AdminDashboard';
import PassphrasePrompt from './components/PassphrasePrompt';
import { getPassword, clearPassword } from './lib/crypto';
import { NeuralOrbitLoader } from './components/NeuralOrbit';
import Aurora from './components/Aurora';
import StartupIntro from './components/StartupIntro';

function AppContent() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [view, setView] = useState<'dashboard' | 'admin' | 'journal'>('dashboard');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  useEffect(() => {
    if (!user) {
      clearPassword();
      setHasPassword(false);
      setJustUnlocked(false);
    } else {
      setHasPassword(!!getPassword());
    }
  }, [user]);

  const isDevPreview = typeof window !== 'undefined' && window.location.search.includes('preview=dashboard');

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] overflow-x-hidden">
      {/* Full-viewport Aurora WebGL Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <Aurora
          colorStops={
            theme === 'light'
              ? ['#9D7BE8', '#5CD6A6', '#E87BAE']
              : ['#7c3aed', '#06b6d4', '#4338ca']
          }
          blend={theme === 'light' ? 0.5 : 0.6}
          amplitude={theme === 'light' ? 0.9 : 1.0}
          speed={theme === 'light' ? 0.5 : 0.4}
          lightMode={theme === 'light'}
        />
      </div>

      {/* Main Interactive Views Layer */}
      <div className="relative z-10">
        {isDevPreview ? (
          <Dashboard 
            onSelectJournal={() => {}} 
            onOpenAdmin={() => {}} 
            onLockVault={() => {}} 
            playEntranceAnimation={true}
          />
        ) : loading ? (
          <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">
            <NeuralOrbitLoader size={54} label="Initializing Lumina..." />
          </div>
        ) : !user ? (
          <Login />
        ) : !hasPassword ? (
          <PassphrasePrompt 
            onSet={() => {
              setHasPassword(true);
              setJustUnlocked(true);
            }} 
          />
        ) : view === 'admin' ? (
          <AdminDashboard onBack={() => setView('dashboard')} />
        ) : view === 'journal' && selectedJournalId ? (
          <JournalView 
            journalId={selectedJournalId} 
            onBack={() => {
              setSelectedJournalId(null);
              setView('dashboard');
            }} 
          />
        ) : (
          <Dashboard 
            onSelectJournal={(id) => {
              setSelectedJournalId(id);
              setView('journal');
            }} 
            onOpenAdmin={() => setView('admin')}
            onLockVault={() => {
              setHasPassword(false);
              setJustUnlocked(false);
            }}
            playEntranceAnimation={justUnlocked}
            onEntranceAnimationComplete={() => setJustUnlocked(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

