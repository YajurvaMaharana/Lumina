/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import JournalView from './components/JournalView';
import AdminDashboard from './components/AdminDashboard';
import PassphrasePrompt from './components/PassphrasePrompt';
import { getPassword, clearPassword } from './lib/crypto';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<'dashboard' | 'admin' | 'journal'>('dashboard');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      clearPassword();
      setHasPassword(false);
    } else {
      setHasPassword(!!getPassword());
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!hasPassword) {
    return <PassphrasePrompt onSet={() => setHasPassword(true)} />;
  }

  if (view === 'admin') {
    return <AdminDashboard onBack={() => setView('dashboard')} />;
  }

  if (view === 'journal' && selectedJournalId) {
    return (
      <JournalView 
        journalId={selectedJournalId} 
        onBack={() => {
          setSelectedJournalId(null);
          setView('dashboard');
        }} 
      />
    );
  }

  return (
    <Dashboard 
      onSelectJournal={(id) => {
        setSelectedJournalId(id);
        setView('journal');
      }} 
      onOpenAdmin={() => setView('admin')}
    />
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
