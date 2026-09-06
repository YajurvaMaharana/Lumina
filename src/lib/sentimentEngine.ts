/**
 * Lumina Sentiment & Psychological Valence Analysis Engine
 * Evaluates reflection text, messages, emotions, and CBT indicators
 * to produce dynamic, varied emotional valence (-100 to +100) and arousal (0 to 100).
 */

import { Journal, EmotionTag } from '../types';

export interface SentimentAnalysisResult {
  valence: number; // -100 (deeply negative / distressed) to +100 (euphoric / grateful)
  arousal: number; // 0 (still / lethargic) to 100 (turbulent / hyper-aroused)
  dominantEmotion: string;
  confidence: number;
  wordCount: number;
  positiveWordHits: number;
  negativeWordHits: number;
  isDecrypted: boolean;
}

/**
 * Detect whether a journal entry is encrypted, locked, or failed decryption.
 */
export function isEncryptedOrFailedEntry(journal: Journal): boolean {
  if (!journal) return true;

  const title = (journal.title || '').toLowerCase();
  if (
    title.includes('decryption failed') ||
    title.includes('encrypted entry') ||
    title.includes('locked')
  ) {
    return true;
  }

  const summary = (journal.summary || '').toLowerCase();
  if (
    summary.includes('unable to decrypt') ||
    summary.includes('please set your password') ||
    summary.includes('wrong password')
  ) {
    return true;
  }

  // If encryptedPayload is set and messages are empty, it is still locked
  if (journal.encryptedPayload && (!journal.messages || journal.messages.length === 0)) {
    return true;
  }

  return false;
}

// Psychological Lexicon mapping tokens to { valence, arousal }
const SENTIMENT_LEXICON: Record<string, { valence: number; arousal: number }> = {
  // Joy / Euphoria / Triumph
  euphoric: { valence: 95, arousal: 85 },
  breakthrough: { valence: 90, arousal: 80 },
  triumph: { valence: 92, arousal: 82 },
  ecstatic: { valence: 92, arousal: 88 },
  thrilled: { valence: 88, arousal: 82 },
  exhilarated: { valence: 88, arousal: 85 },
  joyful: { valence: 85, arousal: 75 },
  joy: { valence: 85, arousal: 75 },
  delighted: { valence: 82, arousal: 70 },
  celebrate: { valence: 80, arousal: 75 },
  winning: { valence: 82, arousal: 78 },
  win: { valence: 80, arousal: 75 },
  profit: { valence: 75, arousal: 65 },
  gain: { valence: 70, arousal: 60 },
  massive: { valence: 40, arousal: 75 },
  success: { valence: 82, arousal: 70 },
  successful: { valence: 80, arousal: 68 },

  // Gratitude / Peace / Serenity
  grateful: { valence: 90, arousal: 45 },
  gratitude: { valence: 90, arousal: 45 },
  blessed: { valence: 85, arousal: 40 },
  serene: { valence: 82, arousal: 25 },
  peace: { valence: 80, arousal: 20 },
  peaceful: { valence: 80, arousal: 20 },
  tranquil: { valence: 78, arousal: 18 },
  calm: { valence: 75, arousal: 20 },
  clarity: { valence: 80, arousal: 45 },
  clear: { valence: 60, arousal: 40 },
  aligned: { valence: 75, arousal: 40 },
  content: { valence: 70, arousal: 30 },
  relaxed: { valence: 72, arousal: 22 },

  // Focus / Growth / Momentum
  flow: { valence: 82, arousal: 65 },
  mastery: { valence: 85, arousal: 60 },
  discipline: { valence: 78, arousal: 55 },
  disciplined: { valence: 78, arousal: 55 },
  focused: { valence: 70, arousal: 60 },
  focus: { valence: 68, arousal: 60 },
  productive: { valence: 75, arousal: 62 },
  progress: { valence: 74, arousal: 55 },
  growth: { valence: 76, arousal: 50 },
  insight: { valence: 75, arousal: 52 },
  patience: { valence: 68, arousal: 35 },
  patient: { valence: 68, arousal: 35 },
  confident: { valence: 78, arousal: 62 },
  confidence: { valence: 78, arousal: 62 },
  optimistic: { valence: 74, arousal: 58 },
  hope: { valence: 70, arousal: 50 },
  hopeful: { valence: 70, arousal: 50 },
  strength: { valence: 72, arousal: 58 },
  proud: { valence: 76, arousal: 60 },
  energized: { valence: 80, arousal: 78 },
  energy: { valence: 55, arousal: 70 },
  inspired: { valence: 80, arousal: 65 },
  relief: { valence: 65, arousal: 35 },
  relieved: { valence: 65, arousal: 35 },
  good: { valence: 50, arousal: 40 },
  great: { valence: 72, arousal: 55 },
  awesome: { valence: 78, arousal: 68 },
  better: { valence: 55, arousal: 45 },
  improving: { valence: 62, arousal: 48 },
  steady: { valence: 50, arousal: 30 },
  balanced: { valence: 65, arousal: 30 },
  solid: { valence: 58, arousal: 40 },

  // Mild / Neutral / Reflective
  neutral: { valence: 5, arousal: 30 },
  okay: { valence: 15, arousal: 25 },
  fine: { valence: 20, arousal: 25 },
  curious: { valence: 45, arousal: 50 },
  pondering: { valence: 25, arousal: 35 },
  observing: { valence: 30, arousal: 30 },
  routine: { valence: 20, arousal: 28 },
  normal: { valence: 10, arousal: 25 },

  // Hesitation / Doubt / Minor Stress
  hesitant: { valence: -25, arousal: 45 },
  hesitation: { valence: -28, arousal: 48 },
  doubt: { valence: -35, arousal: 50 },
  doubting: { valence: -35, arousal: 50 },
  uncertain: { valence: -30, arousal: 45 },
  uncertainty: { valence: -30, arousal: 45 },
  tired: { valence: -30, arousal: 20 },
  exhausted: { valence: -45, arousal: 22 },
  fatigue: { valence: -38, arousal: 25 },
  drained: { valence: -42, arousal: 22 },
  confused: { valence: -32, arousal: 50 },
  slow: { valence: -15, arousal: 20 },
  stuck: { valence: -40, arousal: 55 },
  distracted: { valence: -30, arousal: 48 },
  bored: { valence: -25, arousal: 15 },
  nervous: { valence: -38, arousal: 68 },

  // Anxiety / Stress / Fear / FOMO
  anxious: { valence: -55, arousal: 78 },
  anxiety: { valence: -58, arousal: 80 },
  stressed: { valence: -52, arousal: 75 },
  stress: { valence: -52, arousal: 75 },
  overwhelmed: { valence: -65, arousal: 82 },
  fomo: { valence: -60, arousal: 88 },
  chasing: { valence: -48, arousal: 82 },
  fear: { valence: -70, arousal: 85 },
  afraid: { valence: -68, arousal: 80 },
  scared: { valence: -68, arousal: 82 },
  pressure: { valence: -45, arousal: 72 },
  worried: { valence: -48, arousal: 65 },
  worry: { valence: -48, arousal: 65 },
  rush: { valence: -35, arousal: 75 },
  rushed: { valence: -40, arousal: 78 },
  panic: { valence: -85, arousal: 95 },
  panicking: { valence: -88, arousal: 95 },

  // Frustration / Anger / Revenge / Tilt
  frustrated: { valence: -55, arousal: 72 },
  frustration: { valence: -55, arousal: 72 },
  annoyed: { valence: -45, arousal: 65 },
  irritated: { valence: -48, arousal: 68 },
  angry: { valence: -75, arousal: 90 },
  anger: { valence: -75, arousal: 90 },
  mad: { valence: -70, arousal: 85 },
  furious: { valence: -88, arousal: 95 },
  rage: { valence: -92, arousal: 96 },
  revenge: { valence: -85, arousal: 95 },
  tilt: { valence: -80, arousal: 92 },
  tilted: { valence: -80, arousal: 92 },
  impulsive: { valence: -65, arousal: 85 },
  stupid: { valence: -65, arousal: 60 },
  idiot: { valence: -70, arousal: 65 },
  mistake: { valence: -45, arousal: 55 },
  error: { valence: -35, arousal: 45 },
  loss: { valence: -65, arousal: 70 },
  lost: { valence: -60, arousal: 65 },
  losing: { valence: -62, arousal: 68 },
  bad: { valence: -50, arousal: 45 },
  terrible: { valence: -78, arousal: 68 },
  awful: { valence: -76, arousal: 65 },
  horrible: { valence: -82, arousal: 75 },

  // Sadness / Grief / Despair
  sad: { valence: -65, arousal: 30 },
  sadness: { valence: -65, arousal: 30 },
  depressed: { valence: -82, arousal: 25 },
  depression: { valence: -82, arousal: 25 },
  miserable: { valence: -80, arousal: 35 },
  hopeless: { valence: -88, arousal: 30 },
  despair: { valence: -90, arousal: 40 },
  devastated: { valence: -92, arousal: 65 },
  disappointed: { valence: -58, arousal: 45 },
  disappointment: { valence: -58, arousal: 45 },
  lonely: { valence: -62, arousal: 25 },
  hurt: { valence: -65, arousal: 50 },
  grief: { valence: -80, arousal: 40 },
  guilt: { valence: -68, arousal: 52 },
  shame: { valence: -72, arousal: 55 },
  regret: { valence: -62, arousal: 50 },
  regretting: { valence: -62, arousal: 50 }
};

const NEGATION_WORDS = new Set([
  'not', 'never', 'no', 'hardly', 'scarcely', 'barely', 'without', 'cannot', "can't",
  "don't", "didn't", "doesn't", "won't", "wasn't", "weren't", "isn't", "aren't",
  "couldn't", "shouldn't", "wouldn't", 'stop', 'quit', 'prevent'
]);

const INTENSIFIERS = new Set([
  'very', 'extremely', 'deeply', 'massively', 'immensely', 'really', 'huge',
  'significantly', 'strongly', 'totally', 'absolutely', 'completely', 'intensely'
]);

const DIMINISHERS = new Set([
  'slightly', 'somewhat', 'a bit', 'a little', 'partially', 'kind of', 'sort of', 'mildly'
]);

/**
 * Calculates emotional valence (-100 to +100) and arousal (0 to 100)
 * from actual journal reflection text and psychological metadata.
 */
export function calculateJournalSentiment(journal: Journal): SentimentAnalysisResult {
  // If entry failed decryption or is locked, flag it
  if (isEncryptedOrFailedEntry(journal)) {
    return {
      valence: 0,
      arousal: 0,
      dominantEmotion: 'Encrypted',
      confidence: 0,
      wordCount: 0,
      positiveWordHits: 0,
      negativeWordHits: 0,
      isDecrypted: false
    };
  }

  // 1. Gather all available text content from messages, title, summary, emotional state
  const textChunks: string[] = [];
  if (journal.title) textChunks.push(journal.title);
  if (journal.summary) textChunks.push(journal.summary);
  if (journal.emotionalState) textChunks.push(journal.emotionalState);
  if (journal.invalidation) textChunks.push(journal.invalidation);
  
  if (journal.messages && Array.isArray(journal.messages)) {
    journal.messages.forEach(m => {
      if (m.content) textChunks.push(m.content);
    });
  }

  const fullText = textChunks.join(' ').toLowerCase();
  
  // Clean tokens (strip punctuation but preserve words)
  const rawTokens = fullText
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const wordCount = rawTokens.length;

  let totalValenceWeight = 0;
  let totalArousalWeight = 0;
  let matchesCount = 0;
  let positiveWordHits = 0;
  let negativeWordHits = 0;

  // 2. Scan tokens with negation and intensifier windows
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i].replace(/^'+|'+$/g, '');
    const entry = SENTIMENT_LEXICON[token];

    if (entry) {
      matchesCount++;
      let multiplier = 1.0;

      // Check preceding 1 to 3 tokens for negation or intensifiers
      const prevWindow = rawTokens.slice(Math.max(0, i - 3), i);
      const isNegated = prevWindow.some(w => NEGATION_WORDS.has(w));
      const isIntensified = prevWindow.some(w => INTENSIFIERS.has(w));
      const isDiminished = prevWindow.some(w => DIMINISHERS.has(w));

      if (isIntensified) multiplier *= 1.35;
      if (isDiminished) multiplier *= 0.65;

      let val = entry.valence * multiplier;
      let aro = entry.arousal;

      if (isNegated) {
        // Flipping polarity with slight dampening
        val = -val * 0.8;
      }

      if (val > 10) positiveWordHits++;
      if (val < -10) negativeWordHits++;

      totalValenceWeight += val;
      totalArousalWeight += aro;
    }
  }

  // 3. Compute baseline text valence & arousal
  let textValence = 0;
  let textArousal = 40;

  if (matchesCount > 0) {
    textValence = totalValenceWeight / matchesCount;
    textArousal = totalArousalWeight / matchesCount;
  } else {
    // If no lexicon matches, inspect general word markers
    const hasExclamation = fullText.includes('!');
    const hasQuestion = fullText.includes('?');
    textArousal = hasExclamation ? 60 : hasQuestion ? 50 : 35;
  }

  // 4. Factor in CBT distortions (distortions increase arousal and downward valence)
  if (journal.cbtDistortions && journal.cbtDistortions.length > 0) {
    const distortionPenalty = journal.cbtDistortions.length * 12;
    textValence -= distortionPenalty;
    textArousal = Math.min(95, textArousal + journal.cbtDistortions.length * 10);
  }

  // 5. Factor in explicit Emotion tags if present
  let emotionTagValence: number | null = null;
  let emotionTagArousal: number | null = null;
  let taggedDominantName: string | null = null;

  if (journal.emotions && journal.emotions.length > 0) {
    let sumVal = 0;
    let sumAro = 0;
    let sumConf = 0;

    journal.emotions.forEach(e => {
      const lower = e.name.toLowerCase();
      const match = Object.entries(SENTIMENT_LEXICON).find(([k]) => lower.includes(k));
      const conf = (e.confidence || 75) / 100;
      if (match) {
        sumVal += match[1].valence * conf;
        sumAro += match[1].arousal * conf;
        sumConf += conf;
      }
    });

    if (sumConf > 0) {
      emotionTagValence = sumVal / sumConf;
      emotionTagArousal = sumAro / sumConf;
    }
    taggedDominantName = journal.emotions[0]?.name;
  }

  // 6. Blend text sentiment with tagged emotions
  let finalValence = textValence;
  let finalArousal = textArousal;

  if (emotionTagValence !== null && emotionTagArousal !== null) {
    // Weighted blend: 60% text content evaluation + 40% model-tagged emotions
    finalValence = textValence * 0.6 + emotionTagValence * 0.4;
    finalArousal = textArousal * 0.6 + emotionTagArousal * 0.4;
  }

  // 7. Add deterministic subtle micro-variation derived from journal ID & timestamp
  // Ensures entries with identical word structures still exhibit natural human emotional variance
  let hash = 0;
  const idStr = journal.id + (journal.createdAt || 0);
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash * 31 + idStr.charCodeAt(i)) % 1000;
  }
  const microVariance = (hash % 11) - 5; // -5 to +5
  finalValence += microVariance;

  // Clamp within bounds
  finalValence = Math.max(-100, Math.min(100, Math.round(finalValence)));
  finalArousal = Math.max(10, Math.min(100, Math.round(finalArousal)));

  // 8. Derive dominant emotion if not explicitly tagged
  let dominantEmotion = taggedDominantName || 'Equilibrium';
  if (!taggedDominantName || dominantEmotion === 'Equilibrium' || dominantEmotion === 'Neutral') {
    if (finalValence >= 70 && finalArousal >= 65) dominantEmotion = 'Joy';
    else if (finalValence >= 60) dominantEmotion = 'Gratitude';
    else if (finalValence >= 40 && finalArousal < 50) dominantEmotion = 'Calm';
    else if (finalValence >= 35) dominantEmotion = 'Focused';
    else if (finalValence >= 15) dominantEmotion = 'Hope';
    else if (finalValence > -15 && finalValence < 15) dominantEmotion = 'Neutral';
    else if (finalValence <= -65 && finalArousal >= 80) dominantEmotion = 'Anger';
    else if (finalValence <= -50 && finalArousal >= 75) dominantEmotion = 'FOMO';
    else if (finalValence <= -40 && finalArousal >= 65) dominantEmotion = 'Anxious';
    else if (finalValence <= -40) dominantEmotion = 'Sadness';
    else dominantEmotion = 'Reflective';
  }

  return {
    valence: finalValence,
    arousal: finalArousal,
    dominantEmotion,
    confidence: matchesCount > 0 ? Math.min(95, 50 + matchesCount * 5) : 60,
    wordCount,
    positiveWordHits,
    negativeWordHits,
    isDecrypted: true
  };
}
