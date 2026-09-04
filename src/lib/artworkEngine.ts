import { Journal, JournalArtwork, EmotionTag } from '../types';

export interface MoodPalette {
  name: string;
  colors: string[];
  background: string;
  accent: string;
  glow: string;
  valence: number; // -100 to +100
  arousal: number; // 0 to 100
}

export const MOOD_PALETTES: Record<string, MoodPalette> = {
  Joy: {
    name: 'Solar Euphoria',
    colors: ['#F59E0B', '#FBBF24', '#EC4899', '#8B5CF6', '#F43F5E'],
    background: '#1A0F2E',
    accent: '#FBBF24',
    glow: 'rgba(251, 191, 36, 0.4)',
    valence: 85,
    arousal: 75
  },
  Gratitude: {
    name: 'Golden Radiance',
    colors: ['#EAB308', '#F97316', '#FB7185', '#C084FC', '#FDE047'],
    background: '#18122B',
    accent: '#FACC15',
    glow: 'rgba(250, 204, 21, 0.35)',
    valence: 90,
    arousal: 45
  },
  Calm: {
    name: 'Emerald Serenity',
    colors: ['#059669', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6'],
    background: '#041F1E',
    accent: '#10B981',
    glow: 'rgba(16, 185, 129, 0.35)',
    valence: 75,
    arousal: 20
  },
  Focused: {
    name: 'Indigo Flux',
    colors: ['#4F46E5', '#6366F1', '#818CF8', '#06B6D4', '#9333EA'],
    background: '#0A0E2A',
    accent: '#818CF8',
    glow: 'rgba(99, 102, 241, 0.4)',
    valence: 65,
    arousal: 60
  },
  Hope: {
    name: 'Dawn Horizon',
    colors: ['#38BDF8', '#818CF8', '#C084FC', '#F472B6', '#34D399'],
    background: '#0F172A',
    accent: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.4)',
    valence: 70,
    arousal: 50
  },
  Anxious: {
    name: 'Turbulent Violet',
    colors: ['#7C3AED', '#A855F7', '#EC4899', '#475569', '#312E81'],
    background: '#12072B',
    accent: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.35)',
    valence: -45,
    arousal: 80
  },
  Fear: {
    name: 'Midnight Abyss',
    colors: ['#4338CA', '#3730A3', '#1E1B4B', '#9F1239', '#0284C7'],
    background: '#030712',
    accent: '#6366F1',
    glow: 'rgba(67, 56, 202, 0.3)',
    valence: -70,
    arousal: 85
  },
  Sadness: {
    name: 'Oceanic Melancholy',
    colors: ['#1E40AF', '#3B82F6', '#60A5FA', '#64748B', '#0284C7'],
    background: '#051124',
    accent: '#60A5FA',
    glow: 'rgba(59, 130, 246, 0.3)',
    valence: -60,
    arousal: 25
  },
  Anger: {
    name: 'Crimson Fracture',
    colors: ['#DC2626', '#EF4444', '#F97316', '#7F1D1D', '#991B1B'],
    background: '#1F0606',
    accent: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.45)',
    valence: -75,
    arousal: 95
  },
  Revenge: {
    name: 'Hyper-Tilt Obsidian',
    colors: ['#E11D48', '#BE123C', '#881337', '#EA580C', '#4C0519'],
    background: '#18040A',
    accent: '#FB7185',
    glow: 'rgba(225, 29, 72, 0.45)',
    valence: -85,
    arousal: 95
  },
  FOMO: {
    name: 'Electric Neon Surge',
    colors: ['#D946EF', '#EC4899', '#F43F5E', '#EAB308', '#6366F1'],
    background: '#1E0927',
    accent: '#F43F5E',
    glow: 'rgba(244, 63, 94, 0.4)',
    valence: -30,
    arousal: 90
  },
  Neutral: {
    name: 'Cosmic Equilibrium',
    colors: ['#64748B', '#94A3B8', '#6366F1', '#38BDF8', '#475569'],
    background: '#0B0F19',
    accent: '#94A3B8',
    glow: 'rgba(148, 163, 184, 0.25)',
    valence: 5,
    arousal: 35
  }
};

export const DEFAULT_PALETTE = MOOD_PALETTES.Neutral;

// Helper to determine dominant emotion palette
export function getPaletteForEmotions(emotions?: EmotionTag[]): MoodPalette {
  if (!emotions || emotions.length === 0) return DEFAULT_PALETTE;
  
  // Find emotion with highest confidence that exists in MOOD_PALETTES
  const matched = emotions.find(e => MOOD_PALETTES[e.name]);
  if (matched) return MOOD_PALETTES[matched.name];

  // Soft fallback matching by substrings
  for (const emo of emotions) {
    const lower = emo.name.toLowerCase();
    for (const [key, palette] of Object.entries(MOOD_PALETTES)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        return palette;
      }
    }
  }

  return DEFAULT_PALETTE;
}

// Generate or extract artwork metadata for a journal
export function synthesizeLocalArtwork(journal: Journal): JournalArtwork {
  const paletteObj = getPaletteForEmotions(journal.emotions);
  const primaryMood = journal.emotions?.[0]?.name || 'Equilibrium';
  
  // Extract a memorable quote snippet from messages
  let quote = '';
  const firstUserMsg = journal.messages.find(m => m.role === 'user')?.content || journal.summary || '';
  if (firstUserMsg) {
    const sentences = firstUserMsg
      .replace(/[\n\r]+/g, ' ')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 160);
    quote = sentences[0] || firstUserMsg.slice(0, 110) + '...';
  }

  // Deterministic seed based on journal ID
  let seed = 42;
  for (let i = 0; i < journal.id.length; i++) {
    seed = (seed * 31 + journal.id.charCodeAt(i)) % 100000;
  }

  // Calculate complexity from content length and emotion count
  const wordCount = (journal.messages.map(m => m.content).join(' ')).split(/\s+/).length;
  const complexity = Math.min(10, Math.max(2, Math.floor(wordCount / 30) + (journal.emotions?.length || 1)));

  return {
    style: 'abstract_fluid',
    primaryMood,
    palette: paletteObj.colors,
    seed,
    complexity,
    valence: paletteObj.valence,
    arousal: paletteObj.arousal,
    aiConcept: `An abstract exploration of ${primaryMood.toLowerCase()}, weaving harmonic color chords of ${paletteObj.name}.`,
    aiPrompt: `Abstract expressionist fine art capturing ${primaryMood} and emotional state, flowing volumetric liquid gradients in ${paletteObj.colors.join(', ')}, golden ratio geometric harmony, cinematic diffused lighting, 8k resolution, minimalist modern museum aesthetic.`,
    quoteSnippet: quote
  };
}

// Word cloud processing
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
  'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
  'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
  'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
  'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
  "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
  'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
  'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
  'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't", 'also', 'like', 'feel', 'feeling',
  'felt', 'think', 'thought', 'going', 'know', 'today', 'really', 'much', 'get', 'got', 'make', 'made', 'still',
  'want', 'need', 'day', 'time', 'thing', 'things', 'even', 'well', 'see', 'one', 'would', 'could', 'say', 'said'
]);

export interface WordCloudItem {
  text: string;
  value: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'focus';
  color: string;
  associatedJournals: string[]; // Journal IDs
}

const POSITIVE_MARKERS = new Set([
  'clarity', 'calm', 'grateful', 'peace', 'growth', 'progress', 'focused', 'joy', 'confidence',
  'solution', 'strength', 'insight', 'breakthrough', 'energized', 'aligned', 'consistent', 'patience',
  'discipline', 'balance', 'mastery', 'flow', 'optimistic', 'courage', 'proud', 'accomplished'
]);

const NEGATIVE_MARKERS = new Set([
  'anxious', 'stress', 'fear', 'overwhelm', 'revenge', 'fomo', 'loss', 'frustrated', 'exhausted',
  'doubt', 'panic', 'regret', 'stuck', 'tilt', 'anger', 'mistake', 'tired', 'chasing', 'hesitant',
  'pressure', 'catastrophe', 'burden', 'failure', 'burnout'
]);

const FOCUS_MARKERS = new Set([
  'trading', 'code', 'build', 'strategy', 'execution', 'system', 'process', 'risk', 'thesis',
  'discipline', 'market', 'journal', 'habit', 'analysis', 'decision', 'deep', 'learning', 'routine'
]);

export function extractWordCloud(journals: Journal[]): WordCloudItem[] {
  const wordMap = new Map<string, { count: number; journals: Set<string> }>();

  journals.forEach(j => {
    const text = (j.title + ' ' + j.messages.map(m => m.content).join(' ')).toLowerCase();
    const cleanWords = text.replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/);

    cleanWords.forEach(w => {
      const trimmed = w.trim();
      if (trimmed.length > 3 && !STOP_WORDS.has(trimmed)) {
        if (!wordMap.has(trimmed)) {
          wordMap.set(trimmed, { count: 0, journals: new Set() });
        }
        const item = wordMap.get(trimmed)!;
        item.count += 1;
        item.journals.add(j.id);
      }
    });
  });

  const sorted = Array.from(wordMap.entries())
    .map(([text, data]) => {
      let sentiment: 'positive' | 'neutral' | 'negative' | 'focus' = 'neutral';
      let color = '#94A3B8';

      if (POSITIVE_MARKERS.has(text)) {
        sentiment = 'positive';
        color = '#10B981'; // Emerald
      } else if (NEGATIVE_MARKERS.has(text)) {
        sentiment = 'negative';
        color = '#F43F5E'; // Rose
      } else if (FOCUS_MARKERS.has(text)) {
        sentiment = 'focus';
        color = '#818CF8'; // Indigo
      } else {
        color = '#38BDF8'; // Sky cyan
      }

      return {
        text,
        value: data.count,
        sentiment,
        color,
        associatedJournals: Array.from(data.journals)
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 45);

  return sorted;
}

// Mood Timeline Aggregation
export interface MoodTimelinePoint {
  dateStr: string;
  timestamp: number;
  journalId: string;
  title: string;
  valence: number; // -100 to +100
  arousal: number; // 0 to 100
  primaryEmotion: string;
  emotionColor: string;
  movingAverageValence: number;
}

export function buildMoodTimeline(journals: Journal[]): MoodTimelinePoint[] {
  const sorted = [...journals].sort((a, b) => a.createdAt - b.createdAt);
  
  const points: MoodTimelinePoint[] = [];
  let runningValenceSum = 0;

  sorted.forEach((j, index) => {
    const palette = getPaletteForEmotions(j.emotions);
    const primaryEmotion = j.emotions?.[0]?.name || 'Equilibrium';
    const valence = j.artwork?.valence ?? palette.valence;
    const arousal = j.artwork?.arousal ?? palette.arousal;

    runningValenceSum += valence;
    const movingAverageValence = Math.round(runningValenceSum / (index + 1));

    const dateStr = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(j.createdAt));

    points.push({
      dateStr,
      timestamp: j.createdAt,
      journalId: j.id,
      title: j.title || 'Reflection',
      valence,
      arousal,
      primaryEmotion,
      emotionColor: palette.accent,
      movingAverageValence
    });
  });

  return points;
}

// Theme Evolution
export interface ThemeCategoryData {
  theme: string;
  iconName: string;
  count: number;
  sentimentScore: number; // -100 to +100
  recentMomentum: 'rising' | 'steady' | 'declining';
  color: string;
  description: string;
}

const THEME_DEFINITIONS = [
  {
    theme: 'Trading & Market Execution',
    iconName: 'TrendingUp',
    keywords: ['trade', 'trading', 'market', 'btc', 'pnl', 'loss', 'win', 'fomo', 'revenge', 'position', 'risk', 'entry', 'exit'],
    color: '#8B5CF6',
    description: 'Disciplined decision-making, emotional management during volatility'
  },
  {
    theme: 'Engineering & Deep Work',
    iconName: 'Code',
    keywords: ['code', 'build', 'commit', 'pr', 'feature', 'bug', 'architecture', 'project', 'ship', 'deploy', 'system'],
    color: '#3B82F6',
    description: 'Cognitive flow, architecture problem solving, developer momentum'
  },
  {
    theme: 'Emotional Clarity & Mindfulness',
    iconName: 'Brain',
    keywords: ['calm', 'peace', 'anxiety', 'distortions', 'cbt', 'clarity', 'breath', 'stress', 'reflection', 'grounded'],
    color: '#10B981',
    description: 'Cognitive reframing, mental stillness, baseline resilience'
  },
  {
    theme: 'Relationships & Social Dynamics',
    iconName: 'Users',
    keywords: ['friend', 'family', 'partner', 'conversation', 'team', 'connect', 'relationship', 'listen', 'boundary'],
    color: '#EC4899',
    description: 'Interpersonal empathy, communication patterns, relational harmony'
  },
  {
    theme: 'Physical Vitality & Habits',
    iconName: 'Sparkles',
    keywords: ['sleep', 'workout', 'gym', 'health', 'walk', 'energy', 'diet', 'routine', 'morning', 'rest'],
    color: '#F59E0B',
    description: 'Somatic grounding, sleep hygiene, energetic sustainability'
  }
];

export function analyzeThemeEvolution(journals: Journal[]): ThemeCategoryData[] {
  return THEME_DEFINITIONS.map(def => {
    let count = 0;
    let totalSentiment = 0;
    let recentHits = 0;

    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    journals.forEach(j => {
      const text = (j.title + ' ' + j.messages.map(m => m.content).join(' ')).toLowerCase();
      const hasMatch = def.keywords.some(k => text.includes(k));

      if (hasMatch) {
        count += 1;
        const pal = getPaletteForEmotions(j.emotions);
        totalSentiment += pal.valence;

        if (j.createdAt > recentCutoff) {
          recentHits += 1;
        }
      }
    });

    const sentimentScore = count > 0 ? Math.round(totalSentiment / count) : 0;
    const recentMomentum: 'rising' | 'steady' | 'declining' = 
      recentHits >= 2 ? 'rising' : count > 0 ? 'steady' : 'declining';

    return {
      theme: def.theme,
      iconName: def.iconName,
      count: Math.max(count, 1),
      sentimentScore: count > 0 ? sentimentScore : 40,
      recentMomentum,
      color: def.color,
      description: def.description
    };
  });
}
