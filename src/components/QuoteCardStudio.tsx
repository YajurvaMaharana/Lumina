import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { Download, Sparkles, Copy, Check, Palette, RefreshCw, Quote as QuoteIcon, Layers } from 'lucide-react';
import { Journal, JournalArtwork } from '../types';
import AbstractArtworkCanvas from './AbstractArtworkCanvas';
import { synthesizeLocalArtwork } from '../lib/artworkEngine';

interface QuoteCardStudioProps {
  journal: Journal;
  onClose?: () => void;
}

export default function QuoteCardStudio({ journal, onClose }: QuoteCardStudioProps) {
  const [artwork, setArtwork] = useState<JournalArtwork>(() => {
    return journal.artwork || synthesizeLocalArtwork(journal);
  });
  
  const [quoteText, setQuoteText] = useState(() => {
    return artwork.quoteSnippet || journal.title || (journal.messages[0]?.content.slice(0, 120) + '...');
  });

  const [aspectRatio, setAspectRatio] = useState<'square' | 'wide' | 'portrait'>('square');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [showMoodBadge, setShowMoodBadge] = useState(true);
  const [showAuthor, setShowAuthor] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const STYLES: Array<{ id: JournalArtwork['style']; label: string }> = [
    { id: 'abstract_fluid', label: 'Fluid Wave' },
    { id: 'geometric_aura', label: 'Harmonic Aura' },
    { id: 'minimalist_waveform', label: 'Waveform' },
    { id: 'expressionist_prism', label: 'Prism Light' },
    { id: 'cyberpunk_glass', label: 'Holo Grid' },
    { id: 'watercolor_mist', label: 'Mist Wash' }
  ];

  const handleStyleChange = (style: JournalArtwork['style']) => {
    setArtwork(prev => ({
      ...prev,
      style,
      seed: Math.floor(Math.random() * 100000)
    }));
  };

  const handleRandomize = () => {
    setArtwork(prev => ({
      ...prev,
      seed: Math.floor(Math.random() * 100000),
      complexity: Math.floor(Math.random() * 5) + 3
    }));
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      // Small timeout to ensure font rendering settles
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2.5, // Crisp high-res export
        quality: 0.98
      });
      const link = document.createElement('a');
      const filename = `lumina-insight-${journal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'card'}-${Date.now()}.png`;
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export PNG:', err);
      alert('Could not export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(`"${quoteText}" — Lumina Reflection`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const dateFormatted = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(journal.createdAt));

  const fontClass = {
    serif: 'font-serif tracking-normal leading-relaxed',
    sans: 'font-sans font-medium tracking-tight leading-snug',
    mono: 'font-mono tracking-tighter leading-relaxed text-sm'
  }[fontFamily];

  const cardContainerAspect = {
    square: 'aspect-square max-w-[420px]',
    wide: 'aspect-[16/9] max-w-[540px]',
    portrait: 'aspect-[4/5] max-w-[380px]'
  }[aspectRatio];

  return (
    <div className="bg-[#0B0F19] text-[#E0E6ED] rounded-3xl border border-white/10 p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Insight Card Studio</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">Shareable Quote & Emotional Canvas</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyQuote}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Quote'}</span>
          </button>
          
          <button
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Rendering HD...' : 'Export PNG'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors text-sm ml-2"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quote Editor */}
          <div>
            <label className="text-xs font-semibold text-white/70 block mb-2">Quote Text</label>
            <textarea
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white/90 placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
              placeholder="Enter inspiring reflection or insight..."
            />
          </div>

          {/* Style Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-violet-400" />
                <span>Artwork Mood Style</span>
              </label>
              <button
                onClick={handleRandomize}
                className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reseed</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStyleChange(s.id)}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-medium border transition-all text-center ${
                    artwork.style === s.id
                      ? 'bg-violet-600/30 border-violet-500 text-white font-semibold shadow-sm'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layout & Ratio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">Aspect Ratio</label>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                {(['square', 'wide', 'portrait'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                      aspectRatio === r ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">Typography</label>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                {(['serif', 'sans', 'mono'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFontFamily(f)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                      fontFamily === f ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggle Badges */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label className="text-xs font-semibold text-white/70 block">Card Elements</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowMoodBadge(!showMoodBadge)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showMoodBadge ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Emotional Tone Badge
              </button>
              <button
                onClick={() => setShowAuthor(!showAuthor)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showAuthor ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Lumina Branding
              </button>
              <button
                onClick={() => setShowDate(!showDate)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showDate ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-white/5 text-white/40 border-white/5'
                }`}
              >
                Date Stamp
              </button>
            </div>
          </div>
        </div>

        {/* Live Canvas Preview Column */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 bg-[#05070D] rounded-2xl border border-white/5 min-h-[380px]">
          <div className="text-[11px] text-white/40 font-mono mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>High-Res Export Preview (Live Render)</span>
          </div>

          {/* THE EXPORTABLE SOCIAL CARD ELEMENT */}
          <div
            ref={cardRef}
            className={`w-full ${cardContainerAspect} rounded-2xl relative overflow-hidden flex flex-col justify-between p-6 sm:p-8 shadow-2xl border border-white/20 select-none`}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(139, 92, 246, 0.15)'
            }}
          >
            {/* Background SVG Artwork */}
            <div className="absolute inset-0 pointer-events-none">
              <AbstractArtworkCanvas
                artwork={artwork}
                className="w-full h-full"
                aspectRatio="wide"
                interactive={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070E] via-black/40 to-[#05070E]/70" />
            </div>

            {/* Top Bar inside Card */}
            <div className="relative z-10 flex items-center justify-between gap-3 w-full">
              {showMoodBadge && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white/90">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: artwork.palette[1] || '#8B5CF6' }} />
                  <span>{artwork.primaryMood}</span>
                </div>
              )}

              {showDate && (
                <span className="text-[10px] font-medium text-white/60 tracking-wider uppercase ml-auto">
                  {dateFormatted}
                </span>
              )}
            </div>

            {/* Center Quote Content */}
            <div className="relative z-10 my-auto py-4">
              <QuoteIcon className="w-6 h-6 text-white/30 mb-3" />
              <blockquote className={`text-white text-base sm:text-lg font-light ${fontClass} drop-shadow-md`}>
                "{quoteText}"
              </blockquote>
            </div>

            {/* Footer inside Card */}
            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-white/50 w-full">
              {showAuthor ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-400 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                    L
                  </div>
                  <span className="font-medium text-white/80">Lumina Cognitive Journal</span>
                </div>
              ) : <div />}

              <span className="text-[10px] font-mono text-white/40 uppercase">
                {journal.title.slice(0, 24)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
