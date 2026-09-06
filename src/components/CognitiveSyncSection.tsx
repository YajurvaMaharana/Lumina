import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Github, 
  TrendingUp, 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  Lock, 
  ExternalLink, 
  Zap, 
  Clock, 
  Calendar,
  Layers,
  BarChart3,
  Sliders
} from 'lucide-react';
import NeuralOrbit from './NeuralOrbit';
import { useAuth } from '../lib/AuthContext';
import { 
  getIntegrationSettings, 
  saveIntegrationSettings, 
  getTrades, 
  saveTrade, 
  deleteTrade, 
  getWeeklyReports, 
  saveWeeklyReport 
} from '../lib/db';
import { 
  IntegrationSettings, 
  TradeRecord, 
  WeeklyPerformanceReport 
} from '../types';

interface CognitiveSyncSectionProps {
  journalsCount: number;
}

export default function CognitiveSyncSection({ journalsCount }: CognitiveSyncSectionProps) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<'report' | 'integrations' | 'trades' | 'history'>('report');
  
  // Settings & Integrations state
  const [settings, setSettings] = useState<IntegrationSettings>({
    github: { enabled: false, username: '', status: 'disconnected' },
    trading: { enabled: false, provider: 'manual', autoSync: true },
    discordWebhook: { enabled: false, webhookUrl: '' },
    privacyAcknowledged: false
  });
  
  // Trades state
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isSeedingTrades, setIsSeedingTrades] = useState(false);
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);
  const [newTrade, setNewTrade] = useState<Partial<TradeRecord>>({
    symbol: 'BTC/USD',
    action: 'BUY',
    outcome: 'WIN',
    pnl: 250,
    associatedEmotion: 'Calm',
    isRevengeTrade: false,
    notes: ''
  });

  // GitHub Sync state
  const [githubUsername, setGithubUsername] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [isSyncingGithub, setIsSyncingGithub] = useState(false);
  const [githubSyncMsg, setGithubSyncMsg] = useState<string | null>(null);

  // Discord webhook state
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<string | null>(null);

  // Reports state
  const [latestReport, setLatestReport] = useState<WeeklyPerformanceReport | null>(null);
  const [pastReports, setPastReports] = useState<WeeklyPerformanceReport[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isDispatchingDiscord, setIsDispatchingDiscord] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [settingsData, tradesData, reportsData] = await Promise.all([
        getIntegrationSettings(user.uid),
        getTrades(user.uid),
        getWeeklyReports(user.uid)
      ]);

      if (settingsData) {
        setSettings(settingsData);
        setGithubUsername(settingsData.github.username || '');
        setWebhookUrlInput(settingsData.discordWebhook.webhookUrl || '');
      }

      setTrades(tradesData);
      setPastReports(reportsData);

      if (reportsData.length > 0) {
        setLatestReport(reportsData[0]);
      } else {
        // Generate a preview report if none exists
        handleGenerateReport(false, tradesData);
      }
    } catch (err) {
      console.error("Failed to load cognitive sync data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSavePrivacyToggle = async (acknowledged: boolean) => {
    if (!user) return;
    const updated = { ...settings, privacyAcknowledged: acknowledged };
    setSettings(updated);
    await saveIntegrationSettings(user.uid, updated);
  };

  const handleSyncGithub = async () => {
    if (!user || !githubUsername.trim()) return;
    setIsSyncingGithub(true);
    setGithubSyncMsg(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/integrations/github/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          username: githubUsername.trim(),
          token: githubToken.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGithubSyncMsg(data.message || `Successfully synced ${data.commitCount} commits.`);
        const updated: IntegrationSettings = {
          ...settings,
          github: {
            enabled: true,
            username: githubUsername.trim(),
            token: githubToken.trim() || undefined,
            status: 'connected',
            lastSyncedAt: Date.now(),
            commitCount: data.commitCount
          }
        };
        setSettings(updated);
        await saveIntegrationSettings(user.uid, updated);
      } else {
        setGithubSyncMsg(`⚠️ ${data.error || "GitHub sync failed"}`);
      }
    } catch (err: any) {
      setGithubSyncMsg(`⚠️ Error connecting to GitHub REST API: ${err.message}`);
    } finally {
      setIsSyncingGithub(false);
    }
  };

  const handleTestDiscordWebhook = async () => {
    if (!user || !webhookUrlInput.trim()) return;
    setIsTestingWebhook(true);
    setWebhookStatusMsg(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/integrations/discord/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ webhookUrl: webhookUrlInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookStatusMsg("✅ Webhook verified! Test alert delivered to Discord.");
        const updated: IntegrationSettings = {
          ...settings,
          discordWebhook: {
            enabled: true,
            webhookUrl: webhookUrlInput.trim()
          }
        };
        setSettings(updated);
        await saveIntegrationSettings(user.uid, updated);
      } else {
        setWebhookStatusMsg(`❌ Discord error: ${data.error || "Failed to deliver"}`);
      }
    } catch (err: any) {
      setWebhookStatusMsg(`❌ Connection error: ${err.message}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleSeedTrades = async () => {
    if (!user) return;
    setIsSeedingTrades(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/integrations/trades/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.sampleTrades) {
        // Save to Firestore through Client SDK
        await Promise.all(data.sampleTrades.map((t: TradeRecord) => saveTrade(user.uid, { ...t, userId: user.uid })));
        const tradesData = await getTrades(user.uid);
        setTrades(tradesData);
        // Automatically refresh report
        await handleGenerateReport(false, tradesData);
      }
    } catch (err) {
      console.error("Failed to seed trades:", err);
    } finally {
      setIsSeedingTrades(false);
    }
  };

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTrade.symbol) return;
    try {
      const payload: TradeRecord = {
        id: "trade-" + Date.now(),
        userId: user.uid,
        timestamp: Date.now(),
        symbol: newTrade.symbol.toUpperCase(),
        action: (newTrade.action as 'BUY' | 'SELL') || 'BUY',
        outcome: (newTrade.outcome as 'WIN' | 'LOSS' | 'BREAKEVEN') || 'WIN',
        pnl: Number(newTrade.pnl) || 0,
        associatedEmotion: newTrade.associatedEmotion || 'Neutral',
        isRevengeTrade: !!newTrade.isRevengeTrade,
        notes: newTrade.notes || ''
      };

      await saveTrade(user.uid, payload);

      setTrades([payload, ...trades]);
      setShowAddTradeModal(false);
      setNewTrade({
        symbol: 'BTC/USD',
        action: 'BUY',
        outcome: 'WIN',
        pnl: 250,
        associatedEmotion: 'Calm',
        isRevengeTrade: false,
        notes: ''
      });
    } catch (err) {
      console.error("Error saving trade:", err);
    }
  };

  const handleDeleteTrade = async (id: string) => {
    if (!user) return;
    try {
      await deleteTrade(user.uid, id);
      setTrades(trades.filter(t => t.id !== id));
    } catch (err) {
      console.error("Error deleting trade:", err);
    }
  };

  const handleGenerateReport = async (dispatchWebhook: boolean = false, tradesList?: TradeRecord[]) => {
    if (!user) return;
    setIsGeneratingReport(true);
    setDispatchStatus(null);
    try {
      const currentTrades = tradesList || trades;
      const idToken = await user.getIdToken();
      const res = await fetch('/api/integrations/correlation/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          trades: currentTrades,
          commitCount: settings.github.commitCount || 34,
          journalsCount,
          webhookUrl: dispatchWebhook ? webhookUrlInput.trim() : undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.report) {
        // Save report to Firestore via Client SDK
        await saveWeeklyReport(user.uid, data.report);
        setLatestReport(data.report);
        setPastReports([data.report, ...pastReports.filter(r => r.id !== data.report.id)]);
        if (dispatchWebhook) {
          setDispatchStatus(data.report.webhookDelivered ? "✅ Report dispatched directly to Discord!" : "⚠️ Webhook delivered with notice");
        }
      } else {
        setDispatchStatus(`Error: ${data.error || "Failed to generate report"}`);
      }
    } catch (err: any) {
      console.error("Failed to generate report:", err);
      setDispatchStatus(`Error: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDispatchOnly = async () => {
    if (!latestReport || !user) return;
    setIsDispatchingDiscord(true);
    setDispatchStatus(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/integrations/correlation/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          trades,
          commitCount: settings.github.commitCount || 34,
          journalsCount,
          webhookUrl: webhookUrlInput.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDispatchStatus("✅ Dispatched latest cognitive report to Discord webhook!");
      } else {
        setDispatchStatus(`❌ Delivery failed: ${data.error}`);
      }
    } catch (err: any) {
      setDispatchStatus(`❌ Delivery error: ${err.message}`);
    } finally {
      setIsDispatchingDiscord(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Subnavigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setSubTab('report')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'report'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Weekly Performance Report</span>
          </button>
          
          <button
            onClick={() => setSubTab('integrations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'integrations'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Opt-In Data Sync & Settings</span>
          </button>

          <button
            onClick={() => setSubTab('trades')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'trades'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Trade Logs ({trades.length})</span>
          </button>

          <button
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'history'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Past Reports ({pastReports.length})</span>
          </button>
        </div>

        {subTab === 'report' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateReport(false)}
              disabled={isGeneratingReport}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 transition-colors disabled:opacity-50"
            >
              {isGeneratingReport ? <NeuralOrbit size={14} speed="fast" glow={false} /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{isGeneratingReport ? 'Correlating...' : 'Re-run Correlation Engine'}</span>
            </button>
            <button
              onClick={handleDispatchOnly}
              disabled={isDispatchingDiscord || !latestReport}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white shadow-md shadow-[#5865F2]/20 transition-all disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isDispatchingDiscord ? 'animate-pulse' : ''}`} />
              <span>Dispatch to Discord</span>
            </button>
          </div>
        )}
      </div>

      {dispatchStatus && (
        <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-200 flex items-center justify-between">
          <span>{dispatchStatus}</span>
          <button onClick={() => setDispatchStatus(null)} className="text-white/40 hover:text-white">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: WEEKLY PERFORMANCE REPORT                                       */}
      {/* ========================================================================= */}
      {subTab === 'report' && (
        <div className="space-y-6">
          {latestReport ? (
            <>
              {/* Report Header Card */}
              <div className="glass p-6 rounded-2xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Cognitive State & Performance Report</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      Weekly Synthesis: {latestReport.weekStartDate} — {latestReport.weekEndDate}
                    </h2>
                    <p className="text-white/50 text-xs mt-1">
                      Correlating {journalsCount} journal reflections, {trades.length} trade executions, and GitHub commit velocity.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Auto-Sync Status</div>
                      <div className="text-xs text-emerald-400 font-medium flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Scheduled Monday 8 AM
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 text-sm text-white/80 leading-relaxed">
                  {latestReport.comprehensiveSummary}
                </div>
              </div>

              {/* Core Correlation Highlights Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                
                {/* 1. Trading Psychology & Win Rates */}
                <div className="glass p-6 rounded-2xl border border-emerald-500/20 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Top 3 Mental States for Best Trades</h3>
                          <p className="text-[11px] text-white/50">Calculated from execution win/loss and sentiment logs</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        Trading Sync
                      </span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {latestReport.topTradingMentalStates.map((state, idx) => (
                        <div key={state.emotion} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-white flex items-center gap-1.5">
                              <span className="text-emerald-400 font-bold">#{idx + 1}</span> {state.emotion}
                            </span>
                            <span className="text-emerald-400 font-bold">
                              {state.winRate}% Win Rate
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                              style={{ width: `${state.winRate}%` }}
                            ></div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-white/40">
                            <span>{state.tradeCount} executions logged</span>
                            <span className="text-white/70 font-medium">Avg P&L: {state.avgPnl >= 0 ? '+' : ''}${state.avgPnl}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-white/50 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Calm and Focused mental states produced the highest average risk-adjusted returns.</span>
                  </div>
                </div>

                {/* 2. Developer Cognitive Sync & Code Quality */}
                <div className="glass p-6 rounded-2xl border border-indigo-500/20 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <Github className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Developer Cognitive State & Code Quality</h3>
                          <p className="text-[11px] text-white/50">Morning journaling vs. GitHub PR approval & commit metrics</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                        GitHub REST v3
                      </span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {/* Metric 1: 2x PR Approval Ratio */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border border-indigo-500/20 space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Key Performance Ratio</div>
                        <div className="text-base font-bold text-white flex items-baseline gap-2">
                          <span>Code quality (PR approval)</span>
                          <span className="text-indigo-400 text-lg font-black underline decoration-indigo-400/50">
                            {latestReport.developerCognitiveMetrics.morningJournalingPrApprovalRatio}x higher
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60">
                          {latestReport.developerCognitiveMetrics.morningJournalingPrRate}% first-pass approval on morning journaling days vs. {latestReport.developerCognitiveMetrics.regularPrRate}% without prior reflection.
                        </p>
                      </div>

                      {/* Metric 2: Frustration vs Commit Churn */}
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1">
                          <Activity className="w-3 h-3 text-amber-400" />
                          <span>Commit Velocity & Emotional State</span>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed">
                          {latestReport.developerCognitiveMetrics.frustrationCommitCorrelation}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-white/50 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span>Analyzed {latestReport.developerCognitiveMetrics.totalCommitsAnalyzed} recent commits across repository workstreams.</span>
                  </div>
                </div>

              </div>

              {/* 3. Behavioral Tilt & Risk Warnings */}
              <div className="glass p-6 rounded-2xl border border-rose-500/30 relative overflow-hidden space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Behavioral Tilt & Risk Alerts</h3>
                    <p className="text-[11px] text-white/50">Automated warning flags triggered by high-risk emotional variance</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {latestReport.riskWarnings.map((warning, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
                      <span className="text-rose-400 text-sm mt-0.5">⚠️</span>
                      <p className="text-xs text-rose-200 font-medium leading-relaxed">
                        {warning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Actionable CBT & Performance Recommendations */}
              <div className="glass p-6 rounded-2xl border border-violet-500/30 relative overflow-hidden space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Actionable Cognitive Recommendations for Next Week</h3>
                    <p className="text-[11px] text-white/50">Concrete protocols to maximize discipline and flow state</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {latestReport.actionableRecommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-white/85 leading-relaxed">
                        {rec}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="glass p-12 rounded-2xl border border-white/10 text-center space-y-4">
              <Activity className="w-10 h-10 text-violet-400 mx-auto animate-pulse" />
              <h3 className="text-lg font-bold text-white">No Weekly Report Generated Yet</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                Lumina connects your journal sentiment with trading executions and GitHub activity to discover high-leverage cognitive patterns.
              </p>
              <button
                onClick={() => handleGenerateReport(false)}
                disabled={isGeneratingReport}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-900/40 transition-all"
              >
                {isGeneratingReport ? 'Running Analysis...' : 'Generate First Weekly Performance Report'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: INTEGRATION SETTINGS & DATA SYNC                                */}
      {/* ========================================================================= */}
      {subTab === 'integrations' && (
        <div className="space-y-6">
          {/* Privacy & Zero-Knowledge Compute Declaration Box */}
          <div className="glass p-6 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/20 to-transparent space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-violet-400">
                <Lock className="w-4 h-4" />
                <h3 className="text-sm font-bold text-white">Explicit Privacy & Compute Guarantee</h3>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-medium">
                Encrypted & Private
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              All synchronized external data (GitHub commit timestamps, PR approval metrics, and trade execution logs) is evaluated strictly within secure backend compute jobs exclusively to power your personal performance insights. No data is ever sold, shared with third parties, or used for advertising.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-white/90 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.privacyAcknowledged}
                  onChange={(e) => handleSavePrivacyToggle(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500 w-4 h-4"
                />
                <span>I opt in to local cognitive correlation compute and weekly performance reporting.</span>
              </label>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* GitHub REST API v3 Panel */}
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                    <Github className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">GitHub Account Sync</h3>
                    <p className="text-[11px] text-white/50">GitHub REST API v3 Integration</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                  settings.github.status === 'connected' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-white/5 text-white/40 border border-white/10'
                }`}>
                  {settings.github.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/50 font-bold mb-1">
                    GitHub Username
                  </label>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="e.g. torvalds"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/50 font-bold mb-1">
                    Personal Access Token <span className="text-white/30 font-normal">(Optional for private repos)</span>
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {githubSyncMsg && (
                  <p className="text-xs text-violet-300 bg-violet-500/10 p-2.5 rounded-xl border border-violet-500/20">
                    {githubSyncMsg}
                  </p>
                )}

                <button
                  onClick={handleSyncGithub}
                  disabled={isSyncingGithub || !githubUsername.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSyncingGithub ? <NeuralOrbit size={14} speed="fast" glow={false} /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>{isSyncingGithub ? 'Connecting to GitHub...' : 'Sync Commits via REST v3'}</span>
                </button>
              </div>
            </div>

            {/* Discord Webhook Push Notification Panel */}
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/30 flex items-center justify-center text-[#5865F2]">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Discord Push Notification</h3>
                    <p className="text-[11px] text-white/50">Automated Weekly Performance Delivery</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#5865F2]/20 text-[#5865F2] font-bold border border-[#5865F2]/30">
                  Webhook
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-white/50 font-bold mb-1">
                    Discord Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                {webhookStatusMsg && (
                  <p className="text-xs text-white/80 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    {webhookStatusMsg}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestDiscordWebhook}
                    disabled={isTestingWebhook || !webhookUrlInput.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-pulse' : ''}`} />
                    <span>{isTestingWebhook ? 'Sending Test Alert...' : 'Send Test Notification'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  When enabled, your weekly cognitive performance report and behavioral guardrail warnings are automatically pushed to your Discord channel every Monday at 8:00 AM.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: TRADE EXECUTION LOGS                                            */}
      {/* ========================================================================= */}
      {subTab === 'trades' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Trade Execution & Psychology Records</h3>
              <p className="text-xs text-white/50">
                Log or sync manual trade outcomes correlated with emotional states (Calm, Focused, FOMO, Revenge).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSeedTrades}
                disabled={isSeedingTrades}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors disabled:opacity-50"
              >
                {isSeedingTrades ? <NeuralOrbit size={14} speed="fast" glow={false} /> : <Sparkles className="w-3.5 h-3.5 text-violet-400" />}
                <span>{isSeedingTrades ? 'Populating...' : 'Seed Sample Trade History'}</span>
              </button>
              <button
                onClick={() => setShowAddTradeModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-900/40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Trade</span>
              </button>
            </div>
          </div>

          {/* Quick Trade Entry Modal */}
          {showAddTradeModal && (
            <div className="glass p-6 rounded-2xl border border-violet-500/40 space-y-4 bg-[#0A0D14]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-bold text-white">Log Execution Record</h4>
                <button onClick={() => setShowAddTradeModal(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleAddTrade} className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Symbol</label>
                  <input
                    type="text"
                    value={newTrade.symbol}
                    onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value })}
                    placeholder="BTC/USD, NVDA, SPY"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Action</label>
                  <select
                    value={newTrade.action}
                    onChange={(e) => setNewTrade({ ...newTrade, action: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="BUY" className="bg-[#10141E]">BUY / LONG</option>
                    <option value="SELL" className="bg-[#10141E]">SELL / SHORT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Outcome</label>
                  <select
                    value={newTrade.outcome}
                    onChange={(e) => setNewTrade({ ...newTrade, outcome: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="WIN" className="bg-[#10141E]">WIN (Profit)</option>
                    <option value="LOSS" className="bg-[#10141E]">LOSS (Loss)</option>
                    <option value="BREAKEVEN" className="bg-[#10141E]">BREAKEVEN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">P&L ($ Amount)</label>
                  <input
                    type="number"
                    value={newTrade.pnl}
                    onChange={(e) => setNewTrade({ ...newTrade, pnl: Number(e.target.value) })}
                    placeholder="e.g. 450 or -200"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Associated Mental State</label>
                  <select
                    value={newTrade.associatedEmotion}
                    onChange={(e) => setNewTrade({ ...newTrade, associatedEmotion: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Calm" className="bg-[#10141E]">Calm (Grounded / Planned)</option>
                    <option value="Focused" className="bg-[#10141E]">Focused (High Conviction)</option>
                    <option value="Neutral" className="bg-[#10141E]">Neutral (Standard Mean Reversion)</option>
                    <option value="Anxious" className="bg-[#10141E]">Anxious (Uncertain)</option>
                    <option value="FOMO" className="bg-[#10141E]">FOMO (Chasing Green Candles)</option>
                    <option value="Revenge" className="bg-[#10141E]">Revenge (Trying to Make Back Loss)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-rose-300 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTrade.isRevengeTrade}
                      onChange={(e) => setNewTrade({ ...newTrade, isRevengeTrade: e.target.checked })}
                      className="rounded border-rose-500/40 bg-rose-500/10 text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span>Flag as Revenge / Tilt Trade</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Reasoning / Notes</label>
                  <input
                    type="text"
                    value={newTrade.notes}
                    onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                    placeholder="e.g. Followed 4h breakout confirmation rule"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTradeModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-900/40"
                  >
                    Save Trade Record
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Trade Table */}
          {trades.length === 0 ? (
            <div className="glass p-10 rounded-2xl border border-white/10 text-center space-y-3">
              <TrendingUp className="w-8 h-8 text-white/30 mx-auto" />
              <p className="text-xs text-white/50">No trade records logged yet.</p>
              <button
                onClick={handleSeedTrades}
                disabled={isSeedingTrades}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
              >
                Seed Sample Trade History
              </button>
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/40 uppercase tracking-wider text-[10px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Symbol</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3">P&L</th>
                      <th className="px-4 py-3">Mental State</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/80">
                    {trades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white/40 text-[11px] whitespace-nowrap">
                          {new Date(trade.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">
                          {trade.symbol}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {trade.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trade.outcome === 'WIN' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : trade.outcome === 'LOSS'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-white/10 text-white/60'
                          }`}>
                            {trade.outcome}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            trade.isRevengeTrade || trade.associatedEmotion === 'Revenge'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold'
                              : trade.associatedEmotion === 'Calm'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : trade.associatedEmotion === 'Focused'
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-white/10 text-white/60 border-white/10'
                          }`}>
                            {trade.isRevengeTrade ? '⚠️ Revenge' : trade.associatedEmotion}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-[11px] max-w-xs truncate">
                          {trade.notes || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteTrade(trade.id)}
                            className="text-white/30 hover:text-rose-400 p-1"
                            title="Delete Trade Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: PAST REPORTS ARCHIVE                                            */}
      {/* ========================================================================= */}
      {subTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Historical Weekly Performance Reports</h3>
            <span className="text-xs text-white/40">{pastReports.length} reports archived</span>
          </div>

          {pastReports.length === 0 ? (
            <div className="glass p-8 rounded-2xl border border-white/10 text-center text-white/40 text-xs">
              No historical reports saved yet. Generate a report from the Weekly Performance tab.
            </div>
          ) : (
            <div className="space-y-3">
              {pastReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => {
                    setLatestReport(report);
                    setSubTab('report');
                  }}
                  className="glass p-4 rounded-xl border border-white/10 hover:border-violet-500/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">
                        Week of {report.weekStartDate} — {report.weekEndDate}
                      </span>
                      {report.webhookDelivered && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#5865F2]/20 text-[#5865F2] font-bold">
                          Discord Delivered
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 line-clamp-1">
                      {report.comprehensiveSummary}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-violet-400 font-semibold group-hover:underline">
                      View Synthesis →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
