import React, { useState, useEffect } from 'react';
import { 
  GitPullRequest, 
  Github, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Send, 
  Sliders, 
  AlertCircle, 
  ExternalLink, 
  Trash2, 
  FileCode, 
  Database, 
  Network, 
  Layers, 
  Plus, 
  RefreshCw, 
  Check, 
  X,
  Code2,
  ListTodo,
  Tag,
  ShieldCheck,
  Zap,
  Bot
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { 
  getProjectManagementSettings, 
  saveProjectManagementSettings, 
  getDevTasks, 
  saveDevTask, 
  deleteDevTask,
  getJournals
} from '../lib/db';
import { DevTask, ProjectManagementSettings, Journal } from '../types';

interface ProjectManagementSectionProps {
  journals: Journal[];
}

export default function ProjectManagementSection({ journals }: ProjectManagementSectionProps) {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'review' | 'extracted' | 'settings'>('review');

  // PM Settings
  const [pmSettings, setPmSettings] = useState<ProjectManagementSettings>({
    enabled: true,
    targetPlatform: 'github',
    github: {
      owner: 'valentinine14feb',
      repo: 'lumina-cognitive-journal',
      defaultLabels: ['dev-task', '🤖 AI-generated', 'brainstorm-extract'],
      useDraftLabel: true
    },
    issueTemplate: 'standard',
    autoExtractOnSave: true,
    requireConfirmation: true
  });

  // Extracted Dev Tasks
  const [devTasks, setDevTasks] = useState<DevTask[]>([]);
  const [selectedJournalId, setSelectedJournalId] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDispatchingId, setIsDispatchingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Custom brainstorming text scratchpad
  const [scratchpadText, setScratchpadText] = useState('');
  const [scratchpadTitle, setScratchpadTitle] = useState('');

  // Settings inputs
  const [githubOwner, setGithubOwner] = useState('valentinine14feb');
  const [githubRepo, setGithubRepo] = useState('lumina-cognitive-journal');
  const [githubToken, setGithubToken] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [settingsData, tasksData] = await Promise.all([
        getProjectManagementSettings(user.uid),
        getDevTasks(user.uid)
      ]);

      if (settingsData) {
        setPmSettings(settingsData);
        setGithubOwner(settingsData.github?.owner || 'valentinine14feb');
        setGithubRepo(settingsData.github?.repo || 'lumina-cognitive-journal');
      }

      setDevTasks(tasksData);
      if (journals.length > 0) {
        setSelectedJournalId(journals[0].id);
      }
    } catch (err) {
      console.error("Failed to load PM Dispatcher data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractFromJournal = async (journalToExtract?: Journal) => {
    if (!user) return;
    const target = journalToExtract || journals.find(j => j.id === selectedJournalId);
    
    let textToParse = scratchpadText;
    let titleToParse = scratchpadTitle || 'Brainstorming Scratchpad';
    let sourceId = undefined;

    if (target) {
      const messagesText = (target.messages || []).map(m => `${m.role}: ${m.content}`).join('\n');
      textToParse = `${target.title}\n${target.summary || ''}\n${messagesText}`;
      titleToParse = target.title;
      sourceId = target.id;
    }

    if (!textToParse.trim()) {
      setStatusMsg("⚠️ Please enter or select unstructured text to parse.");
      return;
    }

    setIsExtracting(true);
    setStatusMsg(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pm/extract-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          text: textToParse,
          journalTitle: titleToParse,
          journalId: sourceId,
          issueTemplate: pmSettings.issueTemplate
        })
      });

      const data = await res.json();
      if (res.ok && data.tasks) {
        // Save extracted draft tasks to Firestore
        await Promise.all(data.tasks.map((t: DevTask) => saveDevTask(user.uid, t)));
        const updatedTasks = await getDevTasks(user.uid);
        setDevTasks(updatedTasks);
        setActiveSubTab('review');
        setStatusMsg(`✨ Gemini extracted ${data.tasks.length} actionable development task(s). Review and confirm before dispatch.`);
      } else {
        setStatusMsg(`⚠️ ${data.error || "Failed to extract dev tasks."}`);
      }
    } catch (err: any) {
      console.error("Task extraction error:", err);
      setStatusMsg(`⚠️ Error extracting tasks: ${err.message}`);
    } finally {
      setIsExtracting(false);
      setTimeout(() => setStatusMsg(null), 6000);
    }
  };

  const handleDispatchTask = async (task: DevTask) => {
    if (!user) return;
    setIsDispatchingId(task.id);
    setStatusMsg(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pm/dispatch-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          task,
          platform: pmSettings.targetPlatform,
          targetConfig: {
            owner: githubOwner.trim(),
            repo: githubRepo.trim(),
            token: githubToken.trim() || undefined,
            defaultLabels: pmSettings.github.defaultLabels,
            useDraftLabel: pmSettings.github.useDraftLabel
          }
        })
      });

      const data = await res.json();
      if (res.ok && (data.issueUrl || data.cardUrl || data.task)) {
        const updatedTask: DevTask = data.task || {
          ...task,
          status: 'dispatched',
          isDraft: false,
          dispatchedTo: {
            platform: pmSettings.targetPlatform,
            issueUrl: data.issueUrl || data.cardUrl,
            issueNumber: data.issueNumber,
            dispatchedAt: Date.now()
          }
        };

        await saveDevTask(user.uid, updatedTask);
        setDevTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
        setStatusMsg(`🚀 Task dispatched! ${data.message || 'Issue created.'}`);
      } else {
        setStatusMsg(`⚠️ ${data.error || "Failed to dispatch ticket."}`);
      }
    } catch (err: any) {
      console.error("Dispatch error:", err);
      setStatusMsg(`⚠️ Dispatch error: ${err.message}`);
    } finally {
      setIsDispatchingId(null);
      setTimeout(() => setStatusMsg(null), 6000);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      await deleteDevTask(user.uid, taskId);
      setDevTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      const updated: ProjectManagementSettings = {
        ...pmSettings,
        github: {
          ...pmSettings.github,
          owner: githubOwner.trim(),
          repo: githubRepo.trim(),
          token: githubToken.trim() || undefined
        }
      };
      setPmSettings(updated);
      await saveProjectManagementSettings(user.uid, updated);
      setStatusMsg("✅ Project management dispatch preferences saved.");
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg(`⚠️ Error saving settings: ${err.message}`);
    }
  };

  const getPriorityBadge = (p: DevTask['priority']) => {
    switch (p) {
      case 'P0':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'P1':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'P2':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const pendingTasks = devTasks.filter(t => t.status === 'pending_review' || t.isDraft);
  const dispatchedTasks = devTasks.filter(t => t.status === 'dispatched');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/70 border border-indigo-500/20 p-6 sm:p-8 backdrop-blur-xl">
        <div className="absolute -right-12 -top-12 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Bot className="w-3.5 h-3.5" />
              <span>Full-Stack Agentic Automation</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Automated Project Management Dispatcher
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Gemini parses unstructured brainstorming text, extracts actionable engineering tasks, 
              proposes data models and API endpoints, and auto-dispatches structured tickets to GitHub Issues 
              with an interactive review step and draft guardrails.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleExtractFromJournal()}
              disabled={isExtracting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-950 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isExtracting ? 'animate-spin' : ''}`} />
              <span>{isExtracting ? 'Extracting Action Items...' : 'Extract Dev Tasks from Log'}</span>
            </button>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-white/70">
              <Github className="w-3.5 h-3.5 text-white" />
              <span>Target Repo: <strong className="text-white font-mono">{githubOwner}/{githubRepo}</strong></span>
            </div>

            <div className="flex items-center gap-2 text-white/50">
              <span>Quality Guardrail:</span>
              <span className="px-2 py-0.5 rounded-md font-medium bg-indigo-500/20 text-indigo-300">
                Review & Confirm Step Active
              </span>
            </div>

            <div className="flex items-center gap-2 text-white/50">
              <span>Draft Mode:</span>
              <span className="px-2 py-0.5 rounded-md font-medium bg-emerald-500/20 text-emerald-300">
                "🤖 AI-generated" Labels Applied
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-white/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Proxy-Protected REST Dispatching</span>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-4 p-3.5 rounded-xl bg-indigo-900/40 border border-indigo-400/30 text-xs text-indigo-200 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('review')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'review'
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Pending Review ({pendingTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('extracted')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'extracted'
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dispatched Issues ({dispatchedTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            <span>Repository & Template Settings</span>
          </button>
        </div>

        <div className="text-xs text-white/40 hidden sm:block">
          {devTasks.length} Total Dev Tasks in Workspace
        </div>
      </div>

      {/* SUB-TAB 1: Pending Review (Interactive Confirmation Step) */}
      {activeSubTab === 'review' && (
        <div className="space-y-6">
          {/* Unstructured Brainstorming Source Selector */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Source Unstructured Reflection / Brainstorm
                </h4>
                <p className="text-xs text-white/50">
                  Select a saved reflection or paste raw brainstorming notes below for task extraction.
                </p>
              </div>

              {journals.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">Log:</span>
                  <select
                    value={selectedJournalId}
                    onChange={(e) => setSelectedJournalId(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    {journals.map(j => (
                      <option key={j.id} value={j.id} className="bg-slate-900 text-white">
                        {j.title || 'Untitled Entry'} ({new Date(j.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Scratchpad Topic (optional)"
                value={scratchpadTitle}
                onChange={(e) => setScratchpadTitle(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Or type quick notes e.g., 'Need to add JWT auth with refresh tokens...'"
                value={scratchpadText}
                onChange={(e) => setScratchpadText(e.target.value)}
                className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Pending Tasks Review Cards */}
          {pendingTasks.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70">
                  Review Extracted Tickets Before Dispatching to GitHub
                </span>
                <span className="text-xs text-indigo-400">
                  {pendingTasks.length} task(s) awaiting confirmation
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 space-y-4 transition-all"
                  >
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/70 border border-white/10">
                          {task.category}
                        </span>
                        <h4 className="text-base font-bold text-white">
                          {task.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDispatchTask(task)}
                          disabled={isDispatchingId === task.id}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <Send className={`w-3.5 h-3.5 ${isDispatchingId === task.id ? 'animate-spin' : ''}`} />
                          <span>{isDispatchingId === task.id ? 'Dispatching...' : 'Create GitHub Issue'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 border border-white/5 transition-colors"
                          title="Dismiss Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed">
                      {task.description}
                    </p>

                    {/* Acceptance Criteria */}
                    <div className="space-y-1.5 p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                        Acceptance Criteria (Testable)
                      </span>
                      <ul className="space-y-1">
                        {(task.acceptanceCriteria || []).map((ac, i) => (
                          <li key={i} className="flex items-start gap-2 text-white/80">
                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>{ac}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Suggested Data Models & API Endpoints */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {task.suggestedDataModels && task.suggestedDataModels.length > 0 && (
                        <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 space-y-1">
                          <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Database className="w-3 h-3" />
                            Suggested Data Models
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {task.suggestedDataModels.map((m, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-200 font-mono text-[11px]">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {task.suggestedApiEndpoints && task.suggestedApiEndpoints.length > 0 && (
                        <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 space-y-1">
                          <span className="text-[10px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Network className="w-3 h-3" />
                            Suggested API Endpoints
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {task.suggestedApiEndpoints.map((ep, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-200 font-mono text-[11px]">
                                {ep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3">
              <ListTodo className="w-10 h-10 text-indigo-400 mx-auto opacity-40" />
              <h4 className="text-sm font-semibold text-white">No Pending Tasks</h4>
              <p className="text-xs text-white/50 max-w-sm mx-auto">
                Click "Extract Dev Tasks from Log" to parse your reflection notes into structured engineering tickets.
              </p>
              <button
                onClick={() => handleExtractFromJournal()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Run Gemini Task Extraction
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: Dispatched Issues */}
      {activeSubTab === 'extracted' && (
        <div className="space-y-4">
          {dispatchedTasks.length > 0 ? (
            <div className="space-y-3">
              {dispatchedTasks.map((task) => (
                <div 
                  key={task.id}
                  className="p-4 rounded-xl bg-white/[0.02] border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                      <h4 className="text-sm font-semibold text-white">
                        {task.title}
                      </h4>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-1">
                      {task.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {task.dispatchedTo?.issueUrl && (
                      <a
                        href={task.dispatchedTo.issueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 text-indigo-200 text-xs font-semibold transition-colors"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>View Issue {task.dispatchedTo.issueNumber ? `#${task.dispatchedTo.issueNumber}` : 'Link'}</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white/50">
              No tickets dispatched yet. Review pending tasks in the "Pending Review" tab.
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: Repository & Template Settings */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
            <h3 className="text-base font-bold text-white">
              GitHub Repository & Issue Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-white/70 font-semibold block">GitHub Owner / Org</label>
                <input
                  type="text"
                  value={githubOwner}
                  onChange={(e) => setGithubOwner(e.target.value)}
                  placeholder="valentinine14feb"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-white/70 font-semibold block">Repository Name</label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="lumina-cognitive-journal"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-white/70 font-semibold block">
                Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (Optional, kept secure in Cloud Run backend)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs"
              />
              <span className="text-[11px] text-white/40 block">
                Required only for direct REST issue creation without web link redirect. Proxied securely through Cloud Run backend.
              </span>
            </div>

            {/* Template Selection */}
            <div className="space-y-2 text-xs">
              <label className="text-white/70 font-semibold block">
                Issue Template Format
              </label>
              <select
                value={pmSettings.issueTemplate}
                onChange={(e) => setPmSettings({ ...pmSettings, issueTemplate: e.target.value as any })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white"
              >
                <option value="standard" className="bg-slate-900">Standard (Title, Description, Acceptance Criteria, Models, APIs)</option>
                <option value="agile_user_story" className="bg-slate-900">Agile User Story ("As a user, I want... So that...")</option>
                <option value="technical_rfc" className="bg-slate-900">Technical RFC (Architecture, Trade-offs, Data Contracts)</option>
              </select>
            </div>

            <div className="pt-3">
              <button
                onClick={handleSaveSettings}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors"
              >
                Save Dispatch Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
