import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Palette,
  TrendingUp,
  Cloud,
  Layers,
  Share2,
  Download,
  Filter,
  Eye,
  RefreshCw,
  Zap,
  BookOpen,
  Calendar,
  Smile,
  Activity,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { toPng } from 'html-to-image';
import { Journal, JournalArtwork } from '../types';
import {
  synthesizeLocalArtwork,
  buildMoodTimeline,
  extractWordCloud,
  analyzeThemeEvolution,
  WordCloudItem,
  MOOD_PALETTES
} from '../lib/artworkEngine';
import AbstractArtworkCanvas from './AbstractArtworkCanvas';
import QuoteCardStudio from './QuoteCardStudio';
import { useAuth } from '../lib/AuthContext';

interface ArtworkVisualizerSectionProps {
  journals: Journal[];
  onSelectJournal: (journalId: string) => void;
}

export default function ArtworkVisualizerSection({
  journals,
  onSelectJournal
}: ArtworkVisualizerSectionProps) {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'gallery' | 'timeline' | 'wordcloud' | 'themes'>('gallery');
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>('all');
  const [selectedJournalForCard, setSelectedJournalForCard] = useState<Journal | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordCloudItem | null>(null);
  const [timelineRange, setTimelineRange] = useState<'7d' | '30d' | 'all'>('30d');
  
  // Pro AI Artwork Generator State
  const [isSynthesizingPro, setIsSynthesizingPro] = useState<string | null>(null);
  const [proArtworkResults, setProArtworkResults] = useState<Record<string, any>>({});
  const [isExportingTimeline, setIsExportingTimeline] = useState(false);

  const timelineChartRef = useRef<HTMLDivElement>(null);

  // Synthesize artworks for journals that don't have stored artwork
  const journalsWithArtwork = useMemo(() => {
    return journals.map(j => ({
      ...j,
      artwork: proArtworkResults[j.id] || j.artwork || synthesizeLocalArtwork(j)
    }));
  }, [journals, proArtworkResults]);

  // Timeline points calculation
  const allTimelinePoints = useMemo(() => {
    return buildMoodTimeline(journalsWithArtwork);
  }, [journalsWithArtwork]);

  const filteredTimelinePoints = useMemo(() => {
    if (timelineRange === 'all') return allTimelinePoints;
    const now = Date.now();
    const days = timelineRange === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const filtered = allTimelinePoints.filter(p => p.timestamp >= cutoff);
    return filtered.length > 0 ? filtered : allTimelinePoints;
  }, [allTimelinePoints, timelineRange]);

  // Word cloud extraction
  const wordCloudData = useMemo(() => {
    return extractWordCloud(journals);
  }, [journals]);

  // Theme Evolution
  const themeEvolutionData = useMemo(() => {
    return analyzeThemeEvolution(journals);
  }, [journals]);

  // Filtered Gallery Artworks
  const filteredGallery = useMemo(() => {
    if (selectedStyleFilter === 'all') return journalsWithArtwork;
    return journalsWithArtwork.filter(j => j.artwork.style === selectedStyleFilter);
  }, [journalsWithArtwork, selectedStyleFilter]);

  // Pro AI Artwork Generator Endpoint Handler
  const handleSynthesizeProArtwork = async (journal: Journal) => {
    setIsSynthesizingPro(journal.id);
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch('/api/artwork/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          journalId: journal.id,
          title: journal.title,
          content: journal.messages.map(m => m.content).join(' '),
          emotions: journal.emotions
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.artwork) {
          setProArtworkResults(prev => ({
            ...prev,
            [journal.id]: data.artwork
          }));
        }
      } else {
        // Local synthesis fallback
        const local = synthesizeLocalArtwork(journal);
        local.style = 'cyberpunk_glass';
        setProArtworkResults(prev => ({
          ...prev,
          [journal.id]: local
        }));
      }
    } catch (err) {
      console.error('Failed to generate Pro AI artwork:', err);
    } finally {
      setIsSynthesizingPro(null);
    }
  };

  const handleExportTimelinePng = async () => {
    if (!timelineChartRef.current) return;
    setIsExportingTimeline(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(timelineChartRef.current, {
        cacheBust: true,
        pixelRatio: 2.5
      });
      const link = document.createElement('a');
      link.download = `lumina-mood-timeline-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export timeline:', err);
    } finally {
      setIsExportingTimeline(false);
    }
  };

  // Stats calculation
  const avgValence = useMemo(() => {
    if (allTimelinePoints.length === 0) return 65;
    const sum = allTimelinePoints.reduce((acc, p) => acc + p.valence, 0);
    return Math.round(sum / allTimelinePoints.length);
  }, [allTimelinePoints]);

  const positivePercent = useMemo(() => {
    if (allTimelinePoints.length === 0) return 75;
    const pos = allTimelinePoints.filter(p => p.valence > 0).length;
    return Math.round((pos / allTimelinePoints.length) * 100);
  }, [allTimelinePoints]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quote Card Studio Modal */}
      {selectedJournalForCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto animate-scaleUp">
            <QuoteCardStudio
              journal={selectedJournalForCard}
              onClose={() => setSelectedJournalForCard(null)}
            />
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>Generative AI Canvas & Visualizer</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Emotional Artwork & Psychological Visualizations
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Transform cognitive journaling into dynamic abstract artwork, long-term mood timeline trajectories, interactive cognitive word clouds, and exportable high-res insight cards.
          </p>
        </div>

        {/* Quick Metrics Capsule */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl self-start md:self-auto">
          <div className="px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-center">
            <div className="text-xs text-violet-300 font-medium">Artworks</div>
            <div className="text-lg font-bold text-white">{journalsWithArtwork.length}</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-xs text-emerald-300 font-medium">Positive Ratio</div>
            <div className="text-lg font-bold text-white">{positivePercent}%</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center">
            <div className="text-xs text-sky-300 font-medium">Keywords</div>
            <div className="text-lg font-bold text-white">{wordCloudData.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveSubTab('gallery')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'gallery'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Artwork Gallery & Studio</span>
          </button>

          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'timeline'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Mood & Valence Timeline</span>
          </button>

          <button
            onClick={() => setActiveSubTab('wordcloud')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'wordcloud'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Interactive Word Cloud</span>
          </button>

          <button
            onClick={() => setActiveSubTab('themes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSubTab === 'themes'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-950'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Theme Evolution</span>
          </button>
        </div>

        {activeSubTab === 'gallery' && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            <select
              value={selectedStyleFilter}
              onChange={(e) => setSelectedStyleFilter(e.target.value)}
              className="bg-white/5 border border-white/10 text-xs text-white/80 rounded-xl px-3 py-1.5 focus:outline-none focus:border-violet-500"
            >
              <option value="all" className="bg-[#0B0F19]">All Artwork Styles</option>
              <option value="abstract_fluid" className="bg-[#0B0F19]">Fluid Waves</option>
              <option value="geometric_aura" className="bg-[#0B0F19]">Harmonic Aura</option>
              <option value="minimalist_waveform" className="bg-[#0B0F19]">Waveforms</option>
              <option value="expressionist_prism" className="bg-[#0B0F19]">Prism Light</option>
              <option value="cyberpunk_glass" className="bg-[#0B0F19]">Holo Grid</option>
              <option value="watercolor_mist" className="bg-[#0B0F19]">Watercolor Mist</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: ARTWORK GALLERY & STUDIO */}
      {activeSubTab === 'gallery' && (
        <div className="space-y-6">
          {filteredGallery.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl border border-white/10">
              <Palette className="w-8 h-8 text-white/30 mx-auto mb-3" />
              <p className="text-sm text-white/60">No entries match this artwork style.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGallery.map((j) => (
                <div
                  key={j.id}
                  className="group glass rounded-3xl border border-white/10 overflow-hidden hover:border-violet-500/40 transition-all flex flex-col justify-between hover:shadow-xl hover:shadow-violet-950/20"
                >
                  {/* Canvas Artwork Container */}
                  <div className="relative overflow-hidden cursor-pointer" onClick={() => onSelectJournal(j.id)}>
                    <AbstractArtworkCanvas
                      artwork={j.artwork}
                      aspectRatio="wide"
                      className="w-full transition-transform duration-700 group-hover:scale-105"
                    />
                    
                    {/* Top Floating Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white/90">
                        {j.artwork.primaryMood}
                      </span>
                    </div>

                    {/* Pro AI badge if generated */}
                    {proArtworkResults[j.id] && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-violet-500 text-white font-bold text-[9px] uppercase tracking-wider shadow-md">
                          ✨ AI Pro
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex flex-col flex-grow justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-white/40 mb-1 font-mono">
                        <span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(j.createdAt))}</span>
                        <span className="capitalize">{j.artwork.style.replace('_', ' ')}</span>
                      </div>
                      
                      <h4
                        onClick={() => onSelectJournal(j.id)}
                        className="text-base font-semibold text-white/90 hover:text-white cursor-pointer line-clamp-1 transition-colors"
                      >
                        {j.title || 'Untitled Entry'}
                      </h4>

                      <p className="text-xs text-white/50 line-clamp-2 mt-1.5 leading-relaxed">
                        {j.artwork.quoteSnippet || j.summary || j.messages[0]?.content}
                      </p>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
                      <button
                        onClick={() => setSelectedJournalForCard(j)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-semibold text-violet-300 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Quote Card</span>
                      </button>

                      <button
                        onClick={() => handleSynthesizeProArtwork(j)}
                        disabled={isSynthesizingPro === j.id}
                        className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/70 hover:text-white transition-colors"
                        title="Enhance with Pro AI Artwork Generation"
                      >
                        {isSynthesizingPro === j.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="hidden sm:inline">AI Synth</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MOOD & VALENCE TIMELINE */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-6">
          <div
            ref={timelineChartRef}
            className="glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">
                  Psychological Valence Trajectory
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Longitudinal Mood & Emotional Intensity Chart
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  {(['7d', '30d', 'all'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimelineRange(range)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                        timelineRange === range
                          ? 'bg-violet-600 text-white'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportTimelinePng}
                  disabled={isExportingTimeline}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white/80 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingTimeline ? 'Exporting...' : 'PNG'}</span>
                </button>
              </div>
            </div>

            {/* Recharts Mood & Arousal Area Chart */}
            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredTimelinePoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valenceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="arousalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EC4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EC4899" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FFFFFF" strokeOpacity={0.05} />
                  <XAxis dataKey="dateStr" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis domain={[-100, 100]} stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#0B0F19] border border-white/20 p-3 rounded-xl shadow-2xl text-xs space-y-1">
                            <div className="font-bold text-white">{data.title}</div>
                            <div className="text-white/50 text-[10px]">{data.dateStr}</div>
                            <div className="flex items-center gap-2 pt-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.emotionColor }} />
                              <span className="text-violet-300 font-semibold">{data.primaryEmotion}</span>
                            </div>
                            <div className="text-emerald-400">Emotional Valence: {data.valence > 0 ? `+${data.valence}` : data.valence}</div>
                            <div className="text-pink-400">Arousal / Energy: {data.arousal}/100</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valence"
                    name="Emotional Valence"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#valenceGrad)"
                  />
                  <Line
                    type="monotone"
                    dataKey="movingAverageValence"
                    name="Smoothed Trend"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Timeline Insights Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-xs text-white/40 mb-1">Baseline Positivity</div>
                <div className="text-xl font-bold text-emerald-400">{positivePercent}%</div>
                <p className="text-[11px] text-white/50 mt-1">Reflections with positive valence.</p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-xs text-white/40 mb-1">Average Polarity</div>
                <div className="text-xl font-bold text-violet-400">+{avgValence} pts</div>
                <p className="text-[11px] text-white/50 mt-1">Sustained positive growth sentiment.</p>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-xs text-white/40 mb-1">Long-term Trend</div>
                <div className="text-xl font-bold text-sky-400 flex items-center gap-1">
                  <TrendingUp className="w-5 h-5 text-sky-400" />
                  <span>Upward</span>
                </div>
                <p className="text-[11px] text-white/50 mt-1">Cognitive clarity increasing over sessions.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE WORD CLOUD */}
      {activeSubTab === 'wordcloud' && (
        <div className="space-y-6">
          <div className="glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">
                  Cognitive Lexicon & Keywords
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Interactive Psychological Word Cloud
                </h3>
              </div>

              {/* Word Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-white/60">Growth & Calm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                  <span className="text-white/60">Focus & Process</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-white/60">Friction & Stress</span>
                </div>
              </div>
            </div>

            {/* Dynamic Word Cloud Container */}
            <div className="bg-[#05070D] p-8 rounded-2xl border border-white/5 min-h-[340px] flex flex-wrap items-center justify-center gap-3 sm:gap-4 select-none">
              {wordCloudData.map((item, idx) => {
                // Scale font size based on frequency
                const maxVal = wordCloudData[0]?.value || 1;
                const minVal = wordCloudData[wordCloudData.length - 1]?.value || 1;
                const scale = (item.value - minVal) / Math.max(1, maxVal - minVal);
                const fontSizePx = 13 + Math.round(scale * 24);

                return (
                  <button
                    key={item.text}
                    onClick={() => setSelectedWord(selectedWord?.text === item.text ? null : item)}
                    className={`transition-all duration-300 rounded-xl px-2.5 py-1 hover:scale-110 hover:bg-white/10 cursor-pointer ${
                      selectedWord?.text === item.text ? 'bg-white/20 ring-2 ring-violet-500 scale-110' : ''
                    }`}
                    style={{
                      fontSize: `${fontSizePx}px`,
                      color: item.color,
                      fontWeight: fontSizePx > 22 ? 700 : fontSizePx > 16 ? 600 : 500
                    }}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>

            {/* Word Context Viewer */}
            {selectedWord && (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Keyword: "{selectedWord.text}"</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/70">
                      Mentioned {selectedWord.value} times
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedWord(null)}
                    className="text-white/40 hover:text-white text-xs"
                  >
                    Close
                  </button>
                </div>

                <div className="text-xs text-white/60">
                  Associated reflections ({selectedWord.associatedJournals.length}):
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedWord.associatedJournals.map(jId => {
                    const match = journals.find(j => j.id === jId);
                    return (
                      <button
                        key={jId}
                        onClick={() => onSelectJournal(jId)}
                        className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs text-violet-300 font-medium transition-colors"
                      >
                        {match?.title || 'Open Entry'} →
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: THEME EVOLUTION */}
      {activeSubTab === 'themes' && (
        <div className="space-y-6">
          <div className="glass p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
            <div>
              <div className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">
                Domain Trajectories
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Theme Evolution & Cognitive Focus Distribution
              </h3>
            </div>

            {/* Theme Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themeEvolutionData.map((theme) => (
                <div
                  key={theme.theme}
                  className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-3 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span className="text-sm font-semibold text-white/90">{theme.theme}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        theme.recentMomentum === 'rising'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : theme.recentMomentum === 'steady'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {theme.recentMomentum}
                    </span>
                  </div>

                  <p className="text-xs text-white/50 leading-relaxed">
                    {theme.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    <span className="text-white/40">{theme.count} associated reflections</span>
                    <span className="font-semibold text-violet-300">
                      Sentiment: {theme.sentimentScore > 0 ? `+${theme.sentimentScore}` : theme.sentimentScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
