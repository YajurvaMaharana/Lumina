import React, { useEffect, useState } from 'react';
import { Plus, Book, LogOut, ChevronRight, Loader2, Sparkles, ShieldAlert, Brain, LayoutGrid, Activity, Palette, Bot, GitPullRequest } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getJournals } from '../lib/db';
import { Journal } from '../types';
import { logout } from '../lib/firebase';
import PatternInsightsSection from './PatternInsightsSection';
import CognitiveSyncSection from './CognitiveSyncSection';
import ArtworkVisualizerSection from './ArtworkVisualizerSection';
import AutonomousAgentSection from './AutonomousAgentSection';
import ProjectManagementSection from './ProjectManagementSection';

interface DashboardProps {
  onSelectJournal: (journalId: string | 'new') => void;
  onOpenAdmin: () => void;
}

export default function Dashboard({ onSelectJournal, onOpenAdmin }: DashboardProps) {
  const { user, isAdmin } = useAuth();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'agent' | 'pm' | 'visualizer' | 'insights' | 'sync'>('entries');

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

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(ts));
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-[#E0E6ED] font-sans relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-white/5 relative z-10 shrink-0 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-400 shadow-lg shadow-violet-500/20 flex items-center justify-center">
            <Book className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight glow-text text-white">Lumina</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/50 hidden sm:block">{user?.email}</span>
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20"
              title="Admin Dashboard"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Dashboard</span>
            </button>
          )}
          <button
            onClick={() => logout()}
            className="text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 text-sm font-medium p-2 rounded-md hover:bg-white/5"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-10 relative z-10">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Dashboard Header Bar with View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10 self-start">
              <button
                onClick={() => setActiveTab('entries')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'entries'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>My Reflections ({journals.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('agent')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'agent'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-indigo-300" />
                <span>Autonomous Agent</span>
              </button>

              <button
                onClick={() => setActiveTab('pm')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'pm'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5 text-cyan-300" />
                <span>PM & GitHub Dispatcher</span>
              </button>

              <button
                onClick={() => setActiveTab('visualizer')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'visualizer'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-violet-300" />
                <span>Artwork & Visualizations</span>
              </button>
              
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'insights'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Behavioral Patterns & CBT</span>
              </button>

              <button
                onClick={() => setActiveTab('sync')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'sync'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cognitive Sync & Performance</span>
              </button>
            </div>

            <button
              onClick={() => onSelectJournal('new')}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/40 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New Entry</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-white/40">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
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
            <div className="text-center py-20 glass rounded-2xl border border-white/10 shadow-sm">
              <div className="w-12 h-12 bg-white/5 text-white/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Book className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-medium text-white/90 mb-2">No entries yet</h3>
              <p className="text-white/50 mb-6 max-w-sm mx-auto text-sm">
                Start your first journaling session. Lumina analyzes your emotional tone and tracks cognitive patterns over time.
              </p>
              <button
                onClick={() => onSelectJournal('new')}
                className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/90 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Start Journaling
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {journals.map((journal) => (
                <button
                  key={journal.id}
                  onClick={() => onSelectJournal(journal.id)}
                  className="group flex flex-col items-start text-left glass p-6 rounded-2xl hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/40 relative border border-white/10"
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <span className="text-[10px] font-bold text-violet-400/80 uppercase tracking-widest">
                      {formatDate(journal.createdAt)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                  </div>

                  <h3 className="text-base font-semibold text-white/90 mb-2 line-clamp-1 group-hover:text-white">
                    {journal.title || "Untitled Entry"}
                  </h3>

                  <p className="text-white/50 text-xs line-clamp-3 mb-4 flex-grow leading-relaxed">
                    {journal.summary || (journal.messages.length > 0 ? journal.messages[0].content : "Empty entry")}
                  </p>

                  {/* Emotion and Distortion Badges */}
                  {journal.emotions && journal.emotions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3 w-full">
                      {journal.emotions.slice(0, 2).map((emo) => (
                        <span
                          key={emo.id || emo.name}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/20 font-medium"
                        >
                          {emo.name} ({emo.confidence}%)
                        </span>
                      ))}
                      {journal.emotions.length > 2 && (
                        <span className="text-[9px] text-white/40">
                          +{journal.emotions.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {journal.cbtDistortions && journal.cbtDistortions.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/20 font-medium">
                        ⚠️ {journal.cbtDistortions[0].type}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs font-medium text-white/30 mt-auto pt-2 border-t border-white/5 w-full">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    <span>{journal.messages.length} reflections</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

