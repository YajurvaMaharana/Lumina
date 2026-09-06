import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Calendar, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Pause, 
  Play, 
  RefreshCw, 
  Layers, 
  Flame, 
  CheckCircle, 
  ShieldCheck, 
  Lock, 
  HelpCircle,
  TrendingUp,
  MessageSquare,
  Mail,
  Zap,
  Target,
  ChevronRight,
  Eye,
  Sliders,
  BellRing
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { 
  getAgentSettings, 
  saveAgentSettings, 
  getHabitScorecards, 
  saveHabitScorecard,
  getJournals
} from '../lib/db';
import { 
  AutonomousAgentSettings, 
  HabitEvolutionScorecard, 
  Journal,
  CognitiveBottleneck,
  HabitScoreItem
} from '../types';

interface AutonomousAgentSectionProps {
  journalsCount: number;
}

export default function AutonomousAgentSection({ journalsCount }: AutonomousAgentSectionProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'scorecard' | 'settings' | 'bottlenecks' | 'history'>('scorecard');

  // Agent Settings State
  const [agentSettings, setAgentSettings] = useState<AutonomousAgentSettings>({
    enabled: true,
    isPaused: false,
    pauseUntil: null,
    scheduleCron: '0 8 * * 0',
    deliveryChannels: {
      inApp: true,
      discord: true,
      email: false,
      telegram: false
    },
    discordWebhookUrl: '',
    emailRecipient: '',
    telegramChatId: '',
    minEntriesRequired: 1,
    executionHistory: []
  });

  // Scorecards State
  const [scorecards, setScorecards] = useState<HabitEvolutionScorecard[]>([]);
  const [selectedScorecard, setSelectedScorecard] = useState<HabitEvolutionScorecard | null>(null);
  const [isRunningSynthesis, setIsRunningSynthesis] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings form input states
  const [discordInput, setDiscordInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [telegramInput, setTelegramInput] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [settingsData, scorecardsData] = await Promise.all([
        getAgentSettings(user.uid),
        getHabitScorecards(user.uid)
      ]);

      if (settingsData) {
        setAgentSettings(settingsData);
        setDiscordInput(settingsData.discordWebhookUrl || '');
        setEmailInput(settingsData.emailRecipient || user.email || '');
        setTelegramInput(settingsData.telegramChatId || '');
      }

      setScorecards(scorecardsData);
      if (scorecardsData.length > 0) {
        setSelectedScorecard(scorecardsData[0]);
      } else {
        // Generate initial preview scorecard if none exists
        handleSynthesizeScorecard(false);
      }
    } catch (err) {
      console.error("Failed to load autonomous agent data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (override?: Partial<AutonomousAgentSettings>) => {
    if (!user) return;
    setSaveSuccessMsg(null);
    try {
      const updated: AutonomousAgentSettings = {
        ...agentSettings,
        ...(override || {}),
        discordWebhookUrl: discordInput.trim() || undefined,
        emailRecipient: emailInput.trim() || undefined,
        telegramChatId: telegramInput.trim() || undefined
      };
      setAgentSettings(updated);
      await saveAgentSettings(user.uid, updated);
      setSaveSuccessMsg("Autonomous Agent orchestration preferences saved.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error saving agent settings:", err);
      setStatusMessage(`Error saving settings: ${err.message}`);
    }
  };

  const handleTogglePause = async () => {
    if (!user) return;
    const newPaused = !agentSettings.isPaused;
    const updated = { 
      ...agentSettings, 
      isPaused: newPaused,
      pauseUntil: newPaused ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null // default 7 days pause
    };
    setAgentSettings(updated);
    await saveAgentSettings(user.uid, updated);
    setStatusMessage(newPaused ? "⏸️ Autonomous synthesis paused for 7 days." : "▶️ Autonomous synthesis resumed.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSynthesizeScorecard = async (force: boolean = true) => {
    if (!user) return;
    setIsRunningSynthesis(true);
    setStatusMessage(null);
    try {
      // 1. Fetch decrypted journals locally (preserving Zero-Knowledge guarantees)
      const userJournals = await getJournals(user.uid);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentEntries = userJournals.filter(j => (j.updatedAt || 0) >= sevenDaysAgo || userJournals.length <= 3);

      const idToken = await user.getIdToken();
      const res = await fetch('/api/agent/synthesize-scorecard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          entries: recentEntries.map(e => ({
            title: e.title,
            summary: e.summary,
            emotions: e.emotions,
            cbtDistortions: e.cbtDistortions,
            invalidation: e.invalidation
          })),
          forceRun: force,
          deliveryChannels: agentSettings.deliveryChannels,
          discordWebhookUrl: discordInput.trim() || undefined,
          emailRecipient: emailInput.trim() || undefined,
          telegramChatId: telegramInput.trim() || undefined,
          cachedHash: agentSettings.cachedAnalysisHash
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.scorecard) {
        setSelectedScorecard(data.scorecard);
        setScorecards(prev => [data.scorecard, ...prev.filter(s => s.id !== data.scorecard.id)]);
        setStatusMessage(data.message || "Habit Evolution Scorecard generated successfully.");

        // Persist scorecard and execution record to Firestore from client
        try {
          await saveHabitScorecard(user.uid, data.scorecard);
          const executionRecord = {
            timestamp: Date.now(),
            status: 'success' as const,
            summary: data.scorecard.executiveSummary,
            deliveredChannels: data.deliveredChannels || ['in_app']
          };
          const updatedHistory = [executionRecord, ...(agentSettings.executionHistory || [])].slice(0, 15);
          const updatedSettings: AutonomousAgentSettings = {
            ...agentSettings,
            lastExecutedAt: Date.now(),
            lastScorecardId: data.scorecard.id,
            executionHistory: updatedHistory
          };
          setAgentSettings(updatedSettings);
          await saveAgentSettings(user.uid, updatedSettings);
        } catch (saveErr) {
          console.warn("Could not persist scorecard locally:", saveErr);
        }
      } else if (data.skipped) {
        setStatusMessage(`ℹ️ ${data.reason}`);
      } else {
        setStatusMessage(`⚠️ ${data.error || "Failed to synthesize scorecard"}`);
      }
    } catch (err: any) {
      console.error("Scorecard synthesis error:", err);
      setStatusMessage(`⚠️ Error running synthesis: ${err.message}`);
    } finally {
      setIsRunningSynthesis(false);
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  const getSeverityBadge = (severity: CognitiveBottleneck['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getStatusBadge = (status: HabitScoreItem['status']) => {
    switch (status) {
      case 'breakthrough':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'optimal':
        return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
      case 'stable':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'at_risk':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-violet-950/50 border border-indigo-500/20 p-6 sm:p-8 backdrop-blur-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Bot className="w-3.5 h-3.5" />
              <span>Event-Driven Background Intelligence</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Autonomous Agent Orchestrator
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Cloud Scheduler triggers background Gemini synthesis of your reflections on a recurring Sunday schedule. 
              The agent isolates cognitive bottlenecks, computes habit velocity, and delivers a comprehensive 
              <strong> Habit Evolution Scorecard</strong> to your chosen delivery channels.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSynthesizeScorecard(true)}
              disabled={isRunningSynthesis}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-950 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRunningSynthesis ? 'animate-spin' : ''}`} />
              <span>{isRunningSynthesis ? 'Synthesizing...' : 'Run Autonomous Synthesis'}</span>
            </button>

            <button
              onClick={handleTogglePause}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                agentSettings.isPaused 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {agentSettings.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{agentSettings.isPaused ? 'Resume Agent' : 'Pause Agent'}</span>
            </button>
          </div>
        </div>

        {/* Live Status Pill & Multi-channel Indicators */}
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-white/70">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Schedule: <strong>Every Sunday 8:00 AM</strong></span>
            </div>

            <div className="flex items-center gap-2 text-white/50">
              <span>Status:</span>
              <span className={`px-2 py-0.5 rounded-md font-medium ${agentSettings.isPaused ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {agentSettings.isPaused ? 'Paused (Vacation / Sensitive Period)' : 'Active & Watching'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-white/50">
              <span>Delivery Channels:</span>
              <span className="flex items-center gap-1.5 text-white/80">
                {agentSettings.deliveryChannels.inApp && <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">In-App</span>}
                {agentSettings.deliveryChannels.discord && <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">Discord</span>}
                {agentSettings.deliveryChannels.email && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">Email</span>}
                {agentSettings.deliveryChannels.telegram && <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px]">Telegram</span>}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-white/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Knowledge Decrypted in Local Memory</span>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-lg bg-indigo-900/40 border border-indigo-400/30 text-xs text-indigo-200 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('scorecard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'scorecard'
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Habit Evolution Scorecard</span>
          </button>

          <button
            onClick={() => setActiveTab('bottlenecks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'bottlenecks'
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Cognitive Bottlenecks ({selectedScorecard?.cognitiveBottlenecks?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-violet-400" />
            <span>Orchestration Settings & Webhooks</span>
          </button>
        </div>

        <div className="text-xs text-white/40 hidden sm:block">
          {scorecards.length} Historical Scorecards Synthesized
        </div>
      </div>

      {/* TAB 1: Habit Evolution Scorecard */}
      {activeTab === 'scorecard' && (
        <div className="space-y-6">
          {selectedScorecard ? (
            <div className="space-y-6">
              {/* Scorecard Hero Banner */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold tracking-wider uppercase">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Week of {selectedScorecard.weekStartDate} — {selectedScorecard.weekEndDate}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Consistency & Momentum Index
                  </h3>
                  <p className="text-xs text-white/60 max-w-xl">
                    {selectedScorecard.executiveSummary}
                  </p>
                </div>

                <div className="flex items-center gap-6 self-stretch md:self-auto bg-white/5 p-4 rounded-xl border border-white/10 justify-around">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-indigo-400">
                      {selectedScorecard.overallConsistencyScore}
                      <span className="text-xs font-medium text-white/40">/100</span>
                    </div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">
                      Consistency Score
                    </div>
                  </div>

                  <div className="w-[1px] h-10 bg-white/10" />

                  <div className="text-center">
                    <div className="text-base font-bold text-emerald-400">
                      {selectedScorecard.growthVelocity}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">
                      Habit Velocity
                    </div>
                  </div>
                </div>
              </div>

              {/* Habit Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(selectedScorecard.habitScores || []).map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                          {item.category}
                        </span>
                        <h4 className="text-sm font-semibold text-white mt-0.5">
                          {item.habit}
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {/* Progress Bar & Delta */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Execution Score</span>
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span className="text-white">{item.score}/100</span>
                          <span className={`text-[10px] ${item.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ({item.delta >= 0 ? '+' : ''}{item.delta} pts)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-white/50">
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <Flame className="w-3 h-3" />
                        {item.streakDays} Day Streak
                      </span>
                      <span className="italic text-white/60 truncate max-w-[220px]">
                        "{item.insight}"
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Breakthroughs & Recommended Micro-Habits */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Breakthroughs */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900/50 border border-emerald-500/20 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Key Psychological Breakthroughs</span>
                  </div>
                  <ul className="space-y-2.5">
                    {(selectedScorecard.breakthroughs || []).map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-white/80 leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Micro-Habits */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-violet-950/30 to-slate-900/50 border border-violet-500/20 space-y-4">
                  <div className="flex items-center gap-2 text-violet-400 text-sm font-bold">
                    <Target className="w-4 h-4" />
                    <span>Actionable Micro-Habit Adjustments</span>
                  </div>
                  <ul className="space-y-2.5">
                    {(selectedScorecard.recommendedMicroHabits || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-white/80 leading-relaxed">
                        <Zap className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white/[0.02] border border-white/10 rounded-2xl space-y-3">
              <Bot className="w-10 h-10 text-indigo-400 mx-auto opacity-50" />
              <p className="text-sm text-white/70">No scorecard synthesized yet.</p>
              <button
                onClick={() => handleSynthesizeScorecard(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-500"
              >
                Synthesize First Scorecard
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Cognitive Bottlenecks */}
      {activeTab === 'bottlenecks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Isolated Cognitive Bottlenecks & Friction Points</span>
            </h3>
            <span className="text-xs text-white/50">
              Derived automatically via Gemini behavioral pattern analysis
            </span>
          </div>

          <div className="space-y-4">
            {(selectedScorecard?.cognitiveBottlenecks || []).map((b, idx) => (
              <div 
                key={b.id || idx}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4 hover:border-indigo-500/30 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(b.severity)}`}>
                      {b.severity} SEVERITY
                    </span>
                    <h4 className="text-base font-bold text-white">
                      {b.title}
                    </h4>
                  </div>
                  <span className="text-xs text-white/40">
                    Category: <strong className="text-white/70">{b.category}</strong> • Observed {b.frequency}x
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                    <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                      Pattern Description
                    </span>
                    <p className="text-white/80 leading-relaxed">
                      {b.patternDescription}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-1">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                      Root Cause
                    </span>
                    <p className="text-white/80 leading-relaxed">
                      {b.rootCause}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                      Actionable Intervention
                    </span>
                    <p className="text-white/80 leading-relaxed font-medium">
                      {b.actionableIntervention}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {(!selectedScorecard?.cognitiveBottlenecks || selectedScorecard.cognitiveBottlenecks.length === 0) && (
              <div className="text-center py-12 bg-white/[0.02] border border-white/10 rounded-2xl text-xs text-white/50">
                ✅ No acute cognitive bottlenecks detected in current window.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Orchestration Settings & Webhooks */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-6">
            <h3 className="text-base font-bold text-white">
              Autonomous Agent Delivery & Security Controls
            </h3>

            {/* 1. Opt-In Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white block">
                  Enable Weekly Background Insights
                </span>
                <span className="text-xs text-white/50">
                  Allow the Cloud Scheduler agent to periodically synthesize scorecards without requiring manual triggers.
                </span>
              </div>
              <input 
                type="checkbox"
                checked={agentSettings.enabled}
                onChange={(e) => {
                  const updated = { ...agentSettings, enabled: e.target.checked };
                  setAgentSettings(updated);
                  handleSaveSettings({ enabled: e.target.checked });
                }}
                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {/* 2. Pause Insights */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="space-y-1">
                <span className="text-sm font-semibold text-white block">
                  Pause Insights During Sensitive Periods
                </span>
                <span className="text-xs text-white/50">
                  Temporarily suspend automated processing for vacations or high-stress intervals.
                </span>
              </div>
              <button
                onClick={handleTogglePause}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  agentSettings.isPaused
                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                    : 'bg-white/10 border-white/10 text-white/70 hover:text-white'
                }`}
              >
                {agentSettings.isPaused ? 'Paused' : 'Active'}
              </button>
            </div>

            {/* 3. Delivery Channels Configuration */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider">
                Select Delivery Channels
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={agentSettings.deliveryChannels.inApp}
                    onChange={(e) => {
                      const updatedChannels = { ...agentSettings.deliveryChannels, inApp: e.target.checked };
                      setAgentSettings({ ...agentSettings, deliveryChannels: updatedChannels });
                    }}
                    className="accent-indigo-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white block">In-App Notification</span>
                    <span className="text-white/40">Default dashboard view</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={agentSettings.deliveryChannels.discord}
                    onChange={(e) => {
                      const updatedChannels = { ...agentSettings.deliveryChannels, discord: e.target.checked };
                      setAgentSettings({ ...agentSettings, deliveryChannels: updatedChannels });
                    }}
                    className="accent-indigo-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white block">Discord Webhook</span>
                    <span className="text-white/40">Sunday morning push</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={agentSettings.deliveryChannels.email}
                    onChange={(e) => {
                      const updatedChannels = { ...agentSettings.deliveryChannels, email: e.target.checked };
                      setAgentSettings({ ...agentSettings, deliveryChannels: updatedChannels });
                    }}
                    className="accent-indigo-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white block">Email Digest</span>
                    <span className="text-white/40">Markdown scorecard</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={agentSettings.deliveryChannels.telegram}
                    onChange={(e) => {
                      const updatedChannels = { ...agentSettings.deliveryChannels, telegram: e.target.checked };
                      setAgentSettings({ ...agentSettings, deliveryChannels: updatedChannels });
                    }}
                    className="accent-indigo-600 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white block">Telegram Bot</span>
                    <span className="text-white/40">Direct message alert</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Channel Inputs */}
            <div className="space-y-4 pt-4 border-t border-white/10 text-xs">
              <div className="space-y-1.5">
                <label className="text-white/70 font-semibold block">
                  Discord Webhook URL (for Sunday Scorecard Push)
                </label>
                <input 
                  type="url"
                  value={discordInput}
                  onChange={(e) => setDiscordInput(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold block">
                    Email Recipient
                  </label>
                  <input 
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="trader@domain.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/70 font-semibold block">
                    Telegram Chat ID
                  </label>
                  <input 
                    type="text"
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    placeholder="@channel_or_chat_id"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => handleSaveSettings()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold transition-colors"
                >
                  Save Orchestration Configuration
                </button>

                {saveSuccessMsg && (
                  <span className="text-emerald-400 font-semibold animate-fadeIn">
                    ✓ {saveSuccessMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
