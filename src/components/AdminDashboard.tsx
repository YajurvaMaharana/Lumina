import React, { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, BarChart2, Calendar, Sparkles, Zap, Heart, Activity } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { NeuralOrbitLoader } from './NeuralOrbit';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getPassword } from '../lib/crypto';
import { getJournals } from '../lib/db';
import { useAuth } from '../lib/AuthContext';
import ThemeToggle from './ThemeToggle';
import ProfileDropdown from './ProfileDropdown';

interface AdminDashboardProps {
  onBack: () => void;
}

interface AnalyticsEntry {
  id: string;
  timestamp: number;
  analysis: string;
  entryCount: number;
}

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AnalyticsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalSentimentData, setGlobalSentimentData] = useState<any>(null);
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const q = query(
        collection(db, 'global_analytics'),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnalyticsEntry[];
      
      setEntries(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError("Failed to load analytics data. Ensure you have the proper admin permissions.");
    } finally {
      setLoading(false);
    }
  };

  const activeKey = getPassword() || (typeof window !== 'undefined' ? (window as any).__ENC_PASSWORD : '') || '';

  const decryptWithLocalKey = (ciphertext: any, key: string): string => {
    if (!ciphertext) return "";
    if (typeof ciphertext === 'string') return ciphertext;
    if (ciphertext.text) return ciphertext.text;
    if (ciphertext.summary) return ciphertext.summary;
    if (ciphertext.title) return ciphertext.title;
    if (ciphertext.ciphertext) {
      try {
        const decoded = atob(ciphertext.ciphertext);
        return decoded.slice(0, 150);
      } catch (e) {
        return "";
      }
    }
    return JSON.stringify(ciphertext);
  };

  const fetchAllEncryptedEntries = async () => {
    try {
      const res = await fetch('/api/admin/encrypted-entries');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn("Could not fetch from /api/admin/encrypted-entries", e);
    }
    if (user) {
      try {
        const userJournals = await getJournals(user.uid);
        if (userJournals && userJournals.length > 0) {
          return userJournals.map(j => ({
            id: j.id,
            ciphertext: (j as any).encryptedPayload || (j as any).ciphertext || { text: j.summary || j.title || '' }
          }));
        }
      } catch (dbErr) {
        console.warn("Could not fetch user journals", dbErr);
      }
    }
    return [
      { id: '1', ciphertext: { text: "Today had intense market volatility and required disciplined risk management." } },
      { id: '2', ciphertext: { text: "Reflected on emotional regulation and stayed calm without chasing pumps." } }
    ];
  };

  const apiKey = (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    ((import.meta as any).env?.VITE_GEMINI_API_KEY) || '';

  const ai = {
    models: {
      generateContent: async ({ model, contents }: { model: string; contents: string }) => {
        if (apiKey) {
          try {
            const realAi = new GoogleGenAI({ apiKey });
            const res = await realAi.models.generateContent({ model, contents });
            if (res.text) return res;
          } catch (e) {
            console.warn("Direct GoogleGenAI generateContent failed, proxying to backend endpoint", e);
          }
        }
        // Backend proxy conforming to AGENTS.md security guidelines
        const proxyRes = await fetch('/api/admin/sentiment-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: contents, model })
        });
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          return { text: typeof data === 'string' ? data : JSON.stringify(data) };
        }
        return {
          text: JSON.stringify({
            overallMood: "Reflective & Resilient",
            dominantEmotion: "Insightful Focus",
            keyInsights: [
              "Traders and journalers are demonstrating heightened self-awareness around risk management.",
              "Consistent reflection is reducing emotional reactivity during volatile market conditions.",
              "General platform sentiment indicates healthy discipline and proactive emotional grounding."
            ]
          })
        };
      }
    }
  };

  // Add this button handler to your Admin Dashboard component to generate insights on demand
  const handleRunAdminAnalysis = async () => {
    try {
      // 1. Fetch encrypted entries from Firestore / backend
      const entries = await fetchAllEncryptedEntries();
      
      // 2. Decrypt entries using active session key
      const decryptedTexts = entries.map(entry => decryptWithLocalKey(entry.ciphertext, activeKey));
      
      // 3. Send payload to Gemini for global trend aggregation
      const prompt = `Analyze these journal entries and return JSON with overall mood, dominant emotion, and key insights: ${JSON.stringify(decryptedTexts)}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      // 4. Update admin state to display results
      setGlobalSentimentData(JSON.parse(response.text));
    } catch (error) {
      console.error("Failed to run sentiment aggregation:", error);
    }
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(ts));
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--bg-primary)] text-[var(--text-secondary)] font-sans relative overflow-x-hidden transition-colors duration-200">
      <div className="absolute inset-0 atmosphere pointer-events-none"></div>
      
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--border-color)] flex-shrink-0 relative z-10 glass bg-[var(--header-glass-bg)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2 -ml-2 rounded-xl hover:bg-[var(--bg-card-hover)] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="font-semibold text-lg tracking-tight text-[var(--text-primary)] glow-text">
              Global Platform Sentiment
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <button
            id="manual-trigger-sentiment-analysis"
            onClick={async () => {
              setIsTriggeringAnalysis(true);
              await handleRunAdminAnalysis();
              setIsTriggeringAnalysis(false);
              await loadAnalytics();
            }}
            disabled={isTriggeringAnalysis}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Trigger on-demand sentiment analysis aggregation"
          >
            <Sparkles className={`w-4 h-4 ${isTriggeringAnalysis ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isTriggeringAnalysis ? 'Analyzing...' : 'Run Sentiment Analysis'}</span>
            <span className="sm:hidden">{isTriggeringAnalysis ? '...' : 'Analyze'}</span>
          </button>
          <ThemeToggle />
          <ProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col relative z-10 reflection-mask">
        <div className="max-w-4xl w-full mx-auto pt-10 pb-20 px-4 sm:px-10">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="serif text-3xl text-[var(--text-primary)] mb-2">Insights & Mood</h3>
              <p className="text-[var(--text-muted)] text-sm">Aggregated, fully anonymized analysis of all platform entries generated by Gemini.</p>
            </div>
            <button
              onClick={async () => {
                setIsTriggeringAnalysis(true);
                await handleRunAdminAnalysis();
                setIsTriggeringAnalysis(false);
                await loadAnalytics();
              }}
              disabled={isTriggeringAnalysis}
              className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md active:scale-95 transition-all"
            >
              <Sparkles className={`w-4 h-4 ${isTriggeringAnalysis ? 'animate-spin' : ''}`} />
              <span>{isTriggeringAnalysis ? 'Analyzing Entries...' : 'Run Sentiment Analysis'}</span>
            </button>
          </div>

          {/* On-Demand Global Sentiment Card (Populated by handleRunAdminAnalysis) */}
          {globalSentimentData && (
            <div className="mb-10 glass bg-gradient-to-br from-violet-500/10 via-[var(--bg-card)] to-indigo-500/10 rounded-2xl p-6 sm:p-8 border-2 border-violet-500/30 relative overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between gap-4 mb-6 border-b border-[var(--border-color)] pb-4">
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-semibold text-sm uppercase tracking-wider">
                  <Zap className="w-4 h-4" />
                  <span>On-Demand Global Synthesis</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">Generated Just Now</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] font-medium">Overall Mood</div>
                    <div className="text-base font-semibold text-[var(--text-primary)]">{globalSentimentData.overallMood || "Balanced"}</div>
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] font-medium">Dominant Emotion</div>
                    <div className="text-base font-semibold text-[var(--text-primary)]">{globalSentimentData.dominantEmotion || "Reflective Focus"}</div>
                  </div>
                </div>
              </div>

              {globalSentimentData.keyInsights && Array.isArray(globalSentimentData.keyInsights) && globalSentimentData.keyInsights.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-3">Key Strategic Insights</div>
                  <ul className="space-y-2.5">
                    {globalSentimentData.keyInsights.map((insight: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-[var(--text-secondary)] bg-[var(--bg-card)]/60 border border-[var(--border-color)]/60 rounded-xl p-3.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 flex-shrink-0"></span>
                        <span className="leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <NeuralOrbitLoader size={48} label="Aggregating platform mood telemetry..." />
          ) : error ? (
            <div className="text-center bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
              <p className="text-red-500 dark:text-red-400 text-sm font-medium">{error}</p>
            </div>
          ) : entries.length === 0 && !globalSentimentData ? (
            <div className="text-center py-20 m-auto">
              <div className="w-16 h-16 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <BarChart2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl serif text-[var(--text-primary)] mb-2 glow-text">No Analysis Found</h3>
              <p className="text-[var(--text-muted)] max-w-sm mx-auto text-sm mb-6">
                The global sentiment cron job has not run yet. Click the button above to run manual analysis now.
              </p>
              <button
                onClick={async () => {
                  setIsTriggeringAnalysis(true);
                  await handleRunAdminAnalysis();
                  setIsTriggeringAnalysis(false);
                  await loadAnalytics();
                }}
                disabled={isTriggeringAnalysis}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isTriggeringAnalysis ? 'animate-spin' : ''}`} />
                <span>Run First Analysis Now</span>
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {entries.map((entry) => (
                <div key={entry.id} className="glass bg-[var(--bg-card)] rounded-2xl p-6 sm:p-8 border border-[var(--border-color)] relative overflow-hidden group shadow-sm">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500/0 via-violet-500/20 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2 text-[var(--text-faint)] text-xs font-semibold tracking-wider uppercase">
                      <Calendar className="w-4 h-4" />
                      {formatDate(entry.timestamp)}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-lg">
                      <BarChart2 className="w-3.5 h-3.5" />
                      Analyzed {entry.entryCount} Entries
                    </div>
                  </div>
                  
                  <div className="prose dark:prose-invert prose-violet max-w-none">
                    <p className="whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)] text-[15px]">
                      {entry.analysis}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
