import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Clock, Activity, Compass, AlertCircle, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Lightbulb } from 'lucide-react';
import { Journal, PatternInsight } from '../types';
import { useAuth } from '../lib/AuthContext';

interface PatternInsightsSectionProps {
  journals: Journal[];
}

export default function PatternInsightsSection({ journals }: PatternInsightsSectionProps) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [trajectory, setTrajectory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'temporal' | 'behavioral' | 'cognitive' | 'emotional'>('all');
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);

  const fetchPatternInsights = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/journal/pattern-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          entries: journals.map(j => ({
            id: j.id,
            createdAt: j.createdAt,
            title: j.title,
            summary: j.summary || (j.messages && j.messages[0] ? j.messages[0].content : ''),
            emotions: j.emotions || [],
            cbtDistortions: j.cbtDistortions || []
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
        setTrajectory(data.overallEmotionalTrajectory || '');
        if (data.insights && data.insights.length > 0) {
          setExpandedInsightId(data.insights[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pattern insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (journals.length > 0) {
      fetchPatternInsights();
    }
  }, [journals.length]);

  const filteredInsights = activeCategory === 'all'
    ? insights
    : insights.filter(i => i.category === activeCategory);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'temporal':
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Temporal Rhythm',
          classes: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        };
      case 'behavioral':
        return {
          icon: <Activity className="w-3.5 h-3.5" />,
          label: 'Behavioral Habit',
          classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        };
      case 'cognitive':
        return {
          icon: <Brain className="w-3.5 h-3.5" />,
          label: 'Cognitive Filter',
          classes: 'bg-violet-500/20 text-violet-300 border-violet-500/30'
        };
      case 'emotional':
      default:
        return {
          icon: <Compass className="w-3.5 h-3.5" />,
          label: 'Emotional Trend',
          classes: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
        };
    }
  };

  return (
    <div className="w-full space-y-6 pt-4 text-left">
      {/* Header with Title and Scan Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass p-6 rounded-2xl border border-white/10 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-serif font-bold text-white tracking-tight">
              Behavioral Patterns & CBT Insights
            </h3>
          </div>
          <p className="text-sm text-white/50 max-w-2xl">
            Cross-entry pattern analyzer scanning weekly reflections to detect recurring emotional triggers and cognitive habits.
          </p>
        </div>

        <button
          onClick={fetchPatternInsights}
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 px-4 py-2.5 rounded-xl text-xs font-semibold border border-white/10 transition-all hover:border-violet-500/40 disabled:opacity-50 self-start sm:self-auto shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-400' : ''}`} />
          <span>{loading ? 'Scanning Entries...' : 'Deep Pattern Scan'}</span>
        </button>
      </div>

      {/* Trajectory Banner */}
      {trajectory && (
        <div className="flex items-center gap-3 bg-violet-950/30 border border-violet-500/20 px-5 py-3.5 rounded-xl text-xs text-violet-200">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <div>
            <span className="font-semibold text-violet-300 mr-1.5">Weekly Trajectory:</span>
            {trajectory}
          </div>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'temporal', 'behavioral', 'cognitive', 'emotional'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all border ${
              activeCategory === cat
                ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-950'
                : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            {cat === 'all' ? 'All Patterns' : `${cat} Insights`}
          </button>
        ))}
      </div>

      {/* Pattern Cards List */}
      {loading ? (
        <div className="p-12 text-center text-white/40 glass rounded-2xl border border-white/10 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-violet-400" />
          <p className="text-sm">Analyzing cross-entry trends and cognitive behavioral patterns...</p>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="p-8 text-center text-white/40 glass rounded-2xl border border-white/10 space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-white/20" />
          <p className="text-sm font-medium text-white/70">No cross-entry patterns surfaced yet</p>
          <p className="text-xs text-white/40 max-w-md mx-auto">
            Log a few reflections across different days. As you journal, Lumina surfaces recurring temporal triggers and cognitive patterns.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-1">
          {filteredInsights.map((insight) => {
            const isExpanded = expandedInsightId === insight.id;
            const badge = getCategoryBadge(insight.category);

            return (
              <div
                key={insight.id}
                className="glass rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4 hover:border-white/20 transition-all shadow-md"
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${badge.classes}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                      {insight.frequency && (
                        <span className="text-[11px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                          {insight.frequency}
                        </span>
                      )}
                      {insight.timeframe && (
                        <span className="text-[10px] text-white/40">
                          ({insight.timeframe})
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-white/95 pt-1">
                      {insight.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedInsightId(isExpanded ? null : insight.id)}
                    className="text-xs text-white/40 hover:text-white/90 p-1 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Less' : 'Details'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Description */}
                <p className="text-sm text-white/70 leading-relaxed">
                  {insight.description}
                </p>

                {/* Related Emotion Pills */}
                {insight.relatedEmotions && insight.relatedEmotions.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Associated:</span>
                    {insight.relatedEmotions.map((emo, idx) => (
                      <span key={idx} className="text-[11px] bg-white/5 border border-white/10 text-white/70 px-2 py-0.5 rounded-md">
                        {emo}
                      </span>
                    ))}
                  </div>
                )}

                {/* WHY THIS MATTERS Explanatory Note (Grounded in CBT Principles) */}
                <div className="bg-violet-950/30 border border-violet-500/25 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-violet-300 font-bold text-xs uppercase tracking-wider">
                    <Lightbulb className="w-3.5 h-3.5 text-violet-400" />
                    <span>Why This Matters (Cognitive Behavioral Principle)</span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                    {insight.whyThisMatters}
                  </p>
                </div>

                {/* Actionable CBT Tip */}
                {insight.actionableCbtTip && (
                  <div className="bg-emerald-950/25 border border-emerald-500/20 rounded-xl p-3.5 text-xs text-emerald-200/90 flex items-start gap-2.5">
                    <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-300 font-semibold block mb-0.5">Recommended CBT Action:</strong>
                      {insight.actionableCbtTip}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
