import React, { useEffect, useState, useRef } from 'react';
import { Plus, Book, LogOut, ChevronRight, Loader2, Sparkles, ShieldAlert, Brain, LayoutGrid, Activity, Palette, Bot, GitPullRequest, Trash2, AlertTriangle, Search, Calendar, Users, Share2, Lock, X, KeyRound, Bell, Download } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getJournals, fetchSharedEntries } from '../lib/db';
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
import CalendarIntegrationSection from './CalendarIntegrationSection';
import CollaborativeSection from './CollaborativeSection';
import ShareEntryModal from './ShareEntryModal';
import ExportAuditTrailModal from './ExportAuditTrailModal';
import ThemeToggle from './ThemeToggle';
import ProfileDropdown from './ProfileDropdown';
import NeuralOrbit from './NeuralOrbit';

interface DashboardProps {
  onSelectJournal: (journalId: string | 'new') => void;
  onOpenAdmin: () => void;
  onLockVault?: () => void;
}

interface SharedEntryNotification {
  entryId: string;
  connectionId: string;
  authorName: string;
  topicPreview: string;
  createdAt: number;
}

export default function Dashboard({ onSelectJournal, onOpenAdmin, onLockVault }: DashboardProps) {
  const { user, isAdmin } = useAuth();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'ask' | 'agent' | 'pm' | 'visualizer' | 'insights' | 'sync' | 'calendar' | 'collaborative'>('entries');
  const [deletingJournalId, setDeletingJournalId] = useState<string | null>(null);
  const [sharingJournal, setSharingJournal] = useState<Journal | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Real-time collaborative shared entry notification state
  const [sharedEntryToast, setSharedEntryToast] = useState<SharedEntryNotification | null>(null);
  const [collabTargetEntryId, setCollabTargetEntryId] = useState<string | null>(null);
  const knownEntryIdsRef = useRef<Set<string>>(new Set());
  const isInitialPollRef = useRef<boolean>(true);

  useEffect(() => {
    if (user) {
      loadJournals();
    }
  }, [user]);

  // Real-time listener & polling for incoming shared reflections from partners
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const checkForNewSharedEntries = async () => {
      try {
        const idToken = await user.getIdToken();
        const entries = await fetchSharedEntries(idToken);
        if (!isMounted || !entries) return;

        if (isInitialPollRef.current) {
          // Initialize baseline of existing entry IDs
          entries.forEach((e: any) => knownEntryIdsRef.current.add(e.id));
          isInitialPollRef.current = false;
          return;
        }

        // Detect newly arrived partner entries
        for (const entry of entries) {
          if (!knownEntryIdsRef.current.has(entry.id)) {
            knownEntryIdsRef.current.add(entry.id);
            if (entry.authorUid !== user.uid) {
              setSharedEntryToast({
                entryId: entry.id,
                connectionId: entry.connectionId,
                authorName: entry.authorName || 'Partner',
                topicPreview: entry.topicPreview || 'Shared Reflection',
                createdAt: entry.createdAt || Date.now()
              });
              break;
            }
          }
        }
      } catch (err) {
        // Silently skip transient polling errors
      }
    };

    checkForNewSharedEntries();
    const pollInterval = setInterval(checkForNewSharedEntries, 7000);

    // Also listen for same-session shared reflection events
    const handleLocalShared = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      knownEntryIdsRef.current.add(detail.entryId);
      setSharedEntryToast({
        entryId: detail.entryId,
        connectionId: detail.connectionId,
        authorName: detail.authorName || 'Partner',
        topicPreview: detail.topicPreview || 'Shared Reflection',
        createdAt: detail.createdAt || Date.now()
      });
    };

    window.addEventListener('lumina:shared-entry-created', handleLocalShared);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('lumina:shared-entry-created', handleLocalShared);
    };
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
          <NeuralOrbit size={38} />
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

          {/* Export Audit Trail Quick Action */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all border bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] hover:text-violet-500 dark:hover:text-violet-400 text-xs font-semibold shadow-sm"
            title="Export Audit Trail (PDF, Markdown, JSON)"
          >
            <Download className="w-4 h-4 text-violet-500" />
            <span className="hidden sm:inline">Export Audit Trail</span>
          </button>

          {/* Theme Toggle Component */}
          <ThemeToggle />

          {/* Profile Dropdown Component */}
          <ProfileDropdown
            onOpenAdmin={onOpenAdmin}
            onLockVault={onLockVault}
            onOpenExportAuditTrail={() => setShowExportModal(true)}
          />
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

              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'calendar'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Calendar</span>
              </button>

              <button
                onClick={() => setActiveTab('collaborative')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'collaborative'
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>Collaboration</span>
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
          ) : activeTab === 'calendar' ? (
            <CalendarIntegrationSection onSelectJournal={(id, meta) => {
              if (meta) {
                sessionStorage.setItem('lumina_calendar_event', JSON.stringify(meta));
              }
              onSelectJournal(id);
            }} />
          ) : activeTab === 'collaborative' ? (
            <CollaborativeSection
              onSelectJournal={(id) => onSelectJournal(id)}
              targetEntryId={collabTargetEntryId}
              onClearTargetEntry={() => setCollabTargetEntryId(null)}
            />
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
                      setSharingJournal(journal);
                    }}
                    className="absolute top-4 right-11 p-1.5 rounded-lg text-[var(--text-faint)] hover:text-violet-500 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 z-10"
                    title="Share Entry (E2EE)"
                  >
                    <Share2 className="w-4 h-4" />
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

      {/* Share Entry Modal */}
      {sharingJournal && (
        <ShareEntryModal
          journal={sharingJournal}
          isOpen={!!sharingJournal}
          onClose={() => setSharingJournal(null)}
          onShareUpdated={(updatedConns) => {
            setJournals(prev =>
              prev.map(j => (j.id === sharingJournal.id ? { ...j, sharedConnections: updatedConns } : j))
            );
          }}
        />
      )}

      {/* Floating Real-Time Collaborative Reflection Notification Toast */}
      {sharedEntryToast && (
        <div className="fixed top-24 right-6 z-50 max-w-sm w-full animate-fade-in">
          <div
            onClick={() => {
              setActiveTab('collaborative');
              setCollabTargetEntryId(sharedEntryToast.entryId);
              setSharedEntryToast(null);
            }}
            className="glass rounded-2xl border border-violet-500/50 bg-[var(--bg-card)]/95 backdrop-blur-xl shadow-2xl p-4 cursor-pointer hover:border-violet-400 hover:shadow-violet-500/20 transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              {/* Indicator icon with ping badge */}
              <div className="relative shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-500 text-white flex items-center justify-center shadow-md shadow-violet-600/30">
                  <Lock className="w-5 h-5" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>

              {/* Toast content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> New Shared Reflection
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharedEntryToast(null);
                    }}
                    className="p-1 rounded-lg text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h4 className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">
                  {sharedEntryToast.authorName} shared an entry with you
                </h4>

                <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                  "{sharedEntryToast.topicPreview}"
                </p>

                <div className="mt-2.5 pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-faint)] flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-amber-500" /> Password Protected
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 group-hover:translate-x-1 transition-transform">
                    Unlock Reflection &rarr;
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Audit Trail Modal */}
      {showExportModal && (
        <ExportAuditTrailModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          journals={journals}
        />
      )}
    </div>
  );
}
