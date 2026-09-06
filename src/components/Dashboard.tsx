import React, { useEffect, useState } from 'react';
import { Plus, Book, LogOut, ChevronRight, Loader2, Sparkles, ShieldAlert, Brain, LayoutGrid, Activity, Palette, Bot, GitPullRequest, Trash2, AlertTriangle, Search } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getJournals } from '../lib/db';
import { db } from '../lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { Journal } from '../types';
import { logout } from '../lib/firebase';
import PatternInsightsSection from './PatternInsightsSection';
import CognitiveSyncSection from './CognitiveSyncSection';
import ArtworkVisualizerSection from './ArtworkVisualizerSection';
import AutonomousAgentSection from './AutonomousAgentSection';
import ProjectManagementSection from './ProjectManagementSection';
import AskJournalSection from './AskJournalSection';
import ThemeToggle from './ThemeToggle';
import ProfileDropdown from './ProfileDropdown';

interface DashboardProps {
  onSelectJournal: (journalId: string | 'new') => void;
  onOpenAdmin: () => void;
  onLockVault?: () => void;
}

export default function Dashboard({ onSelectJournal, onOpenAdmin, onLockVault }: DashboardProps) {
  const { user, isAdmin } = useAuth();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'ask' | 'agent' | 'pm' | 'visualizer' | 'insights' | 'sync'>('entries');
  const [deletingJournalId, setDeletingJournalId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadJournals();
    }
  }, [user]);

  const loadJournals = async () => {
    try {
      const data = await getJournals(user!.uid);
      setJournals(data);
    } catch (error) {
      console.error("Failed to load journals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJournal = async () => {
    if (!deletingJournalId || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'journals', deletingJournalId));
      setJournals((prev) => prev.filter((j) => j.id !== deletingJournalId));
      setDeletingJournalId(null);
    } catch (error) {
      console.error("Failed to delete journal:", error);
      alert("Failed to delete the entry. Please try again.");
    }
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(ts));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-secondary)] font-sans relative overflow-hidden flex flex-col transition-colors duration-200">
      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--border-color)] relative z-20 shrink-0 glass bg-[var(--header-glass-bg)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-400 shadow-lg shadow-violet-500/20 flex items-center justify-center">
            <Book className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight glow-text text-[var(--text-primary)]">Lumina</h1>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Ask Journal Quick Action */}
          <button
            onClick={() => setActiveTab('ask')}
            className={`flex items-center justify-center p-2 rounded-xl transition-all border ${
              activeTab === 'ask'
                ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-900/20'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] hover:text-violet-500 dark:hover:text-violet-400'
            }`}
            title="Ask Your Journal"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Theme Toggle Component */}
          <ThemeToggle />

          {/* Profile Dropdown Component */}
          <ProfileDropdown onOpenAdmin={onOpenAdmin} onLockVault={onLockVault} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-10 relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Dashboard Header Bar with View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-color)] self-start shadow-sm">
              <button
                onClick={() => setActiveTab('entries')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'entries'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>My Reflections ({journals.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('agent')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'agent'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                <span>Autonomous Agent</span>
              </button>

              <button
                onClick={() => setActiveTab('pm')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'pm'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-300" />
                <span>PM & GitHub Dispatcher</span>
              </button>

              <button
                onClick={() => setActiveTab('visualizer')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'visualizer'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-violet-400" />
                <span>Artwork & Visualizations</span>
              </button>
              
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'insights'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Behavioral Patterns & CBT</span>
              </button>

              <button
                onClick={() => setActiveTab('sync')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'sync'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Cognitive Sync & Performance</span>
              </button>
            </div>

            <button
              onClick={() => onSelectJournal('new')}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/30 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New Entry</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : activeTab === 'ask' ? (
            <AskJournalSection journals={journals} onSelectJournal={(id) => onSelectJournal(id)} />
          ) : activeTab === 'agent' ? (
            <AutonomousAgentSection journalsCount={journals.length} />
          ) : activeTab === 'pm' ? (
            <ProjectManagementSection journals={journals} />
          ) : activeTab === 'visualizer' ? (
            <ArtworkVisualizerSection journals={journals} onSelectJournal={(id) => onSelectJournal(id)} />
          ) : activeTab === 'sync' ? (
            <CognitiveSyncSection journalsCount={journals.length} />
          ) : activeTab === 'insights' ? (
            <PatternInsightsSection journals={journals} />
          ) : journals.length === 0 ? (
            <div className="text-center py-20 glass rounded-2xl border border-[var(--border-color)] shadow-sm bg-[var(--bg-card)]">
              <div className="w-12 h-12 bg-white/5 dark:bg-white/5 text-[var(--text-muted)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-color)]">
                <Book className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No entries yet</h3>
              <p className="text-[var(--text-muted)] mb-6 max-w-sm mx-auto text-sm">
                Start your first journaling session. Lumina analyzes your emotional tone and tracks cognitive patterns over time.
              </p>
              <button
                onClick={() => onSelectJournal('new')}
                className="inline-flex items-center gap-2 bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
              >
                Start Journaling
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {journals.map((journal) => (
                <div key={journal.id} className="relative group">
                  <button
                    onClick={() => onSelectJournal(journal.id)}
                    className="w-full h-full flex flex-col items-start text-left glass p-6 rounded-2xl hover:bg-[var(--bg-card-hover)] transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/40 border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm"
                  >
                    <div className="flex items-center justify-between w-full mb-3 pr-6">
                      <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400/80 uppercase tracking-widest">
                        {formatDate(journal.createdAt)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--text-muted)] transition-colors" />
                    </div>

                    <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2 line-clamp-1 group-hover:text-violet-500 dark:group-hover:text-white transition-colors">
                      {journal.title || "Untitled Entry"}
                    </h3>

                    <p className="text-[var(--text-muted)] text-xs line-clamp-3 mb-4 flex-grow leading-relaxed">
                      {journal.summary || (journal.messages.length > 0 ? journal.messages[0].content : "Empty entry")}
                    </p>

                    {/* Emotion and Distortion Badges */}
                    {journal.emotions && journal.emotions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 w-full">
                        {journal.emotions.slice(0, 2).map((emo) => (
                          <span
                            key={emo.id || emo.name}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20 font-medium"
                          >
                            {emo.name} ({emo.confidence}%)
                          </span>
                        ))}
                        {journal.emotions.length > 2 && (
                          <span className="text-[9px] text-[var(--text-faint)]">
                            +{journal.emotions.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {journal.cbtDistortions && journal.cbtDistortions.length > 0 && (
                      <div className="mb-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium">
                          ⚠️ {journal.cbtDistortions[0].type}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-faint)] mt-auto pt-2 border-t border-[var(--border-subtle)] w-full">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                      <span>{journal.messages.length} reflections</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingJournalId(journal.id);
                    }}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-faint)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 z-10"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deletingJournalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-600" />
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Delete Entry?</h3>
            </div>
            <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
              This will permanently remove this reflection and its chat history from your encrypted vault. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingJournalId(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteJournal}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-sm shadow-red-900/20"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
