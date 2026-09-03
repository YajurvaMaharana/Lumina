/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import JournalView from './components/JournalView';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#05070A] text-[#E0E6ED]">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (selectedJournalId) {
    return (
      <JournalView 
        journalId={selectedJournalId} 
        onBack={() => setSelectedJournalId(null)} 
      />
    );
  }

  return (
    <Dashboard onSelectJournal={setSelectedJournalId} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

