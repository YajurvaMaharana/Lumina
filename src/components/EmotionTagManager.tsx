import React, { useState } from 'react';
import { Sparkles, Plus, X, Check, Edit2, AlertTriangle, HelpCircle, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import { EmotionTag, CBTDistortion } from '../types';

interface EmotionTagManagerProps {
  emotions: EmotionTag[];
  cbtDistortions: CBTDistortion[];
  userFeedback?: {
    isAccurate: boolean;
    notes?: string;
  };
  onChangeEmotions: (newEmotions: EmotionTag[]) => void;
  onFeedback?: (isAccurate: boolean) => void;
  onReanalyze?: () => void;
  isAnalyzing?: boolean;
}

const PRESET_EMOTIONS = [
  { name: 'Calm', color: 'emerald' },
  { name: 'Anxious', color: 'amber' },
  { name: 'Grateful', color: 'teal' },
  { name: 'Frustrated', color: 'rose' },
  { name: 'Excited', color: 'sky' },
  { name: 'Overwhelmed', color: 'purple' },
  { name: 'Grounded', color: 'indigo' },
  { name: 'Hopeful', color: 'cyan' },
  { name: 'Sad', color: 'slate' }
];

const getColorClasses = (color?: string) => {
  switch (color) {
    case 'emerald':
    case 'teal':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
    case 'amber':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25';
    case 'rose':
    case 'red':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25';
    case 'sky':
    case 'cyan':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25';
    case 'purple':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25';
    case 'indigo':
    default:
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25';
  }
};

export default function EmotionTagManager({
  emotions = [],
  cbtDistortions = [],
  userFeedback,
  onChangeEmotions,
  onFeedback,
  onReanalyze,
  isAnalyzing = false
}: EmotionTagManagerProps) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTagName, setCustomTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagConfidence, setEditingTagConfidence] = useState(80);
  const [showReframingFor, setShowReframingFor] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(userFeedback ? userFeedback.isAccurate : null);

  const handleRemoveTag = (tagId: string) => {
    const updated = emotions.filter(e => e.id !== tagId);
    onChangeEmotions(updated);
  };

  const handleAddCustomTag = (nameToAdd?: string) => {
    const finalName = (nameToAdd || customTagName).trim();
    if (!finalName) return;

    // Check if tag already exists
    if (emotions.some(e => e.name.toLowerCase() === finalName.toLowerCase())) {
      setIsAddingCustom(false);
      setCustomTagName('');
      return;
    }

    const matchedPreset = PRESET_EMOTIONS.find(p => p.name.toLowerCase() === finalName.toLowerCase());
    const newTag: EmotionTag = {
      id: 'tag-' + Math.random().toString(36).substr(2, 9),
      name: finalName,
      confidence: 100, // User entered tag is 100% user-confirmed
      color: matchedPreset?.color || 'indigo',
      isCustom: true
    };

    onChangeEmotions([...emotions, newTag]);
    setCustomTagName('');
    setIsAddingCustom(false);
  };

  const handleStartEdit = (tag: EmotionTag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagConfidence(tag.confidence);
  };

  const handleSaveEdit = () => {
    if (!editingTagId || !editingTagName.trim()) {
      setEditingTagId(null);
      return;
    }
    const updated = emotions.map(t => {
      if (t.id === editingTagId) {
        return {
          ...t,
          name: editingTagName.trim(),
          confidence: Math.min(100, Math.max(1, Number(editingTagConfidence) || 80)),
          isCustom: true
        };
      }
      return t;
    });
    onChangeEmotions(updated);
    setEditingTagId(null);
  };

  const handleFeedbackClick = (accurate: boolean) => {
    setFeedbackGiven(accurate);
    if (onFeedback) {
      onFeedback(accurate);
    }
  };

  return (
    <div className="w-full space-y-4 pt-4 pb-2 text-left">
      {/* Emotion Tags Header & Bar */}
      <div className="bg-black/30 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <h4 className="text-xs uppercase tracking-widest text-white/80 font-bold">
              Detected Emotional Tone
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {onReanalyze && (
              <button
                type="button"
                onClick={onReanalyze}
                disabled={isAnalyzing}
                className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                title="Re-run AI Emotion Analysis"
              >
                <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin text-violet-400' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing...' : 'Re-scan Tone'}</span>
              </button>
            )}

            {/* User Feedback Quick Loop */}
            <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 text-[11px]">
              <span className="text-white/40 mr-1 hidden sm:inline">Accurate?</span>
              <button
                type="button"
                onClick={() => handleFeedbackClick(true)}
                className={`p-1 rounded transition-colors ${
                  feedbackGiven === true
                    ? 'bg-emerald-500/30 text-emerald-300 font-bold'
                    : 'text-white/40 hover:text-white/80'
                }`}
                title="Classification is accurate"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleFeedbackClick(false)}
                className={`p-1 rounded transition-colors ${
                  feedbackGiven === false
                    ? 'bg-amber-500/30 text-amber-300 font-bold'
                    : 'text-white/40 hover:text-white/80'
                }`}
                title="Tone needs correction"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Emotion Tags List */}
        <div className="flex flex-wrap items-center gap-2">
          {emotions.map((tag) => {
            const isEditing = editingTagId === tag.id;

            if (isEditing) {
              return (
                <div key={tag.id} className="flex items-center gap-1.5 bg-black/80 border border-violet-500/50 p-1 rounded-xl text-xs">
                  <input
                    type="text"
                    value={editingTagName}
                    onChange={(e) => setEditingTagName(e.target.value)}
                    className="bg-transparent text-white px-2 py-0.5 text-xs outline-none w-24 border-r border-white/10"
                    placeholder="Emotion"
                    autoFocus
                  />
                  <div className="flex items-center gap-1 px-1">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editingTagConfidence}
                      onChange={(e) => setEditingTagConfidence(Number(e.target.value))}
                      className="bg-white/10 text-white px-1.5 py-0.5 text-[11px] rounded w-12 text-center outline-none"
                    />
                    <span className="text-[10px] text-white/40">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="p-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg"
                    title="Save changes"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTagId(null)}
                    className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded-lg"
                    title="Cancel"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${getColorClasses(tag.color)}`}
              >
                <span className="font-semibold text-white/95">{tag.name}</span>
                <span className="text-[10px] font-mono opacity-70 bg-black/30 px-1.5 py-0.5 rounded-md">
                  {tag.confidence}% confidence
                </span>
                {tag.isCustom && (
                  <span className="text-[9px] uppercase tracking-wider bg-white/10 text-white/70 px-1 rounded">
                    User
                  </span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(tag)}
                    className="p-0.5 hover:text-white text-white/50 transition-colors"
                    title="Edit tag or confidence"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="p-0.5 hover:text-red-300 text-white/50 transition-colors"
                    title="Remove tag"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {emotions.length === 0 && !isAddingCustom && (
            <div className="text-xs text-white/40 italic py-1">
              No emotion tags classified yet. Add custom tags or scan reflection.
            </div>
          )}

          {/* Add Custom Tag Button / Inline Field */}
          {isAddingCustom ? (
            <div className="flex items-center gap-1.5 bg-black/60 border border-white/20 p-1 rounded-xl text-xs">
              <input
                type="text"
                value={customTagName}
                onChange={(e) => setCustomTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                placeholder="Type emotion (e.g. Hopeful)"
                className="bg-transparent text-white px-2 py-0.5 text-xs outline-none w-36"
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleAddCustomTag()}
                className="p-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCustom(false)}
                className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded-lg"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCustom(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-dashed border-white/20 text-xs text-white/50 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all"
            >
              <Plus className="w-3 h-3" />
              <span>Add Custom Tag</span>
            </button>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-white/30 mr-1">Quick Add:</span>
          {PRESET_EMOTIONS.filter(preset => !emotions.some(e => e.name.toLowerCase() === preset.name.toLowerCase())).map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleAddCustomTag(preset.name)}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 border border-white/5 transition-all"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* CBT Cognitive Distortion Alerts */}
      {cbtDistortions && cbtDistortions.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="text-xs uppercase tracking-widest font-bold">
                CBT Cognitive Distortion Alert
              </h4>
            </div>
            <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
              {cbtDistortions.length} Pattern{cbtDistortions.length > 1 ? 's' : ''} Identified
            </span>
          </div>

          <div className="space-y-2.5">
            {cbtDistortions.map((distortion) => {
              const isExpanded = showReframingFor === distortion.id;
              return (
                <div key={distortion.id} className="bg-black/40 border border-amber-500/20 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-300 text-sm">{distortion.type}</span>
                      <span className="text-[10px] font-mono bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded">
                        {distortion.confidence}% confidence
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowReframingFor(isExpanded ? null : distortion.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold underline underline-offset-2"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>{isExpanded ? 'Hide Reframe' : 'CBT Reframe'}</span>
                    </button>
                  </div>

                  {distortion.evidence && (
                    <div className="text-white/70 italic bg-white/5 p-2 rounded-lg border border-white/5">
                      Evidence from text: "{distortion.evidence}"
                    </div>
                  )}

                  {isExpanded && distortion.reframePrompt && (
                    <div className="bg-violet-950/40 border border-violet-500/30 p-3 rounded-lg space-y-1 text-white/90 animate-in fade-in duration-150">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-violet-300">
                        Cognitive Restructuring Prompt:
                      </div>
                      <p className="text-xs leading-relaxed italic text-white/95">
                        "{distortion.reframePrompt}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
