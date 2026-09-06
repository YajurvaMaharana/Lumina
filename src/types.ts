export interface EmotionTag {
  id: string;
  name: string;
  confidence: number; // 0-100
  color?: string;
  isCustom?: boolean;
}

export interface CBTDistortion {
  id: string;
  type: string; // e.g., Catastrophizing, All-or-Nothing, Emotional Reasoning
  confidence: number; // 0-100
  evidence: string;
  reframePrompt?: string;
}

export interface PatternInsight {
  id: string;
  title: string;
  category: 'temporal' | 'behavioral' | 'cognitive' | 'emotional';
  frequency: string;
  timeframe: string;
  description: string;
  whyThisMatters: string;
  actionableCbtTip: string;
  relatedEmotions?: string[];
  createdAt?: number;
}

export interface JournalArtwork {
  style: 'abstract_fluid' | 'geometric_aura' | 'minimalist_waveform' | 'expressionist_prism' | 'cyberpunk_glass' | 'watercolor_mist';
  primaryMood: string;
  palette: string[];
  seed: number;
  complexity: number;
  valence: number; // -100 (deep negative) to +100 (deep positive)
  arousal: number; // 0 (calm/still) to 100 (high energy/turbulent)
  aiConcept?: string;
  aiPrompt?: string;
  generatedImageUrl?: string;
  quoteSnippet?: string;
}

export interface Journal {
  id: string;
  userId: string;
  title: string;
  summary: string;
  location?: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  emotions?: EmotionTag[];
  cbtDistortions?: CBTDistortion[];
  artwork?: JournalArtwork;
  invalidation?: string;
  emotionalState?: string;
  userFeedback?: {
    isAccurate: boolean;
    notes?: string;
  };
  linkedCalendarEventId?: string;
  linkedCalendarEventSummary?: string;
  sharedConnections?: string[]; // Connection IDs this entry is currently shared with
  
  // Encrypted fields (when saved to Firestore)
  encryptedPayload?: {
    ciphertext: string;
    salt: string;
    iv: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  mediaBase64?: string;
  mediaMimeType?: string;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface IntegrationSettings {
  github: {
    enabled: boolean;
    username: string;
    token?: string;
    repo?: string;
    lastSyncedAt?: number;
    status: 'connected' | 'disconnected' | 'error';
    commitCount?: number;
  };
  trading: {
    enabled: boolean;
    provider: 'manual' | 'csv' | 'api';
    autoSync: boolean;
    lastSyncedAt?: number;
    tradeCount?: number;
  };
  discordWebhook: {
    enabled: boolean;
    webhookUrl?: string;
    lastDeliveredAt?: number;
  };
  calendar?: CalendarIntegrationSettings;
  privacyAcknowledged: boolean;
  updatedAt?: number;
}

export interface TradeRecord {
  id: string;
  userId: string;
  timestamp: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
  pnl: number; // in $
  entryPrice?: number;
  exitPrice?: number;
  associatedEmotion: string; // e.g. "Calm", "Focused", "Neutral", "Anxious", "FOMO", "Revenge"
  isRevengeTrade?: boolean;
  notes?: string;
}

export interface GitHubActivityRecord {
  id: string;
  timestamp: number;
  commitCount: number;
  additions: number;
  deletions: number;
  prApprovalCount?: number;
  repoName: string;
  message?: string;
}

export interface WeeklyPerformanceReport {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: number;
  topTradingMentalStates: Array<{
    emotion: string;
    winRate: number;
    tradeCount: number;
    avgPnl: number;
  }>;
  developerCognitiveMetrics: {
    morningJournalingPrApprovalRatio: number; // e.g., 2.0 (2x higher)
    morningJournalingPrRate: number; // percentage
    regularPrRate: number;
    frustrationCommitCorrelation: string;
    focusedStateEfficiency: string;
    totalCommitsAnalyzed: number;
  };
  riskWarnings: string[];
  comprehensiveSummary: string;
  actionableRecommendations: string[];
  webhookDelivered: boolean;
}

export interface CognitiveBottleneck {
  id: string;
  title: string;
  category: 'Emotional Bias' | 'Habit Friction' | 'Execution Drift' | 'Burnout / Fatigue' | 'Cognitive Distortion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: number; // how many times observed in window
  patternDescription: string;
  rootCause: string;
  actionableIntervention: string;
  firstDetectedAt: number;
  resolvedStatus: 'active' | 'improving' | 'resolved';
}

export interface HabitScoreItem {
  habit: string;
  category: 'Mindfulness & Grounding' | 'Discipline & Execution' | 'Deep Work & Focus' | 'Cognitive Reframing' | 'Emotional Regulation';
  score: number; // 0 - 100
  previousScore?: number;
  delta: number; // e.g. +12, -5
  streakDays: number;
  status: 'optimal' | 'stable' | 'at_risk' | 'breakthrough';
  insight: string;
}

export interface HabitEvolutionScorecard {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: number;
  overallConsistencyScore: number; // 0 - 100
  growthVelocity: '+Accelerating' | '+Steady' | '~Neutral' | '-Stagnant' | '-Decelerating';
  habitScores: HabitScoreItem[];
  cognitiveBottlenecks: CognitiveBottleneck[];
  executiveSummary: string;
  breakthroughs: string[];
  recommendedMicroHabits: string[];
  deliveryChannelsSent: Array<'in_app' | 'discord' | 'email' | 'telegram'>;
  isRead: boolean;
}

export interface AutonomousAgentSettings {
  enabled: boolean; // Opt-in toggle: "Enable Autonomous Background Synthesis"
  isPaused: boolean; // "Pause insights" for sensitive periods or vacation
  pauseUntil?: number | null; // Optional timestamp when pause automatically resumes
  scheduleCron: string; // Default: "0 8 * * 0" (Every Sunday 8:00 AM)
  deliveryChannels: {
    inApp: boolean;
    discord: boolean;
    email: boolean;
    telegram: boolean;
  };
  discordWebhookUrl?: string;
  emailRecipient?: string;
  telegramChatId?: string;
  minEntriesRequired: number; // e.g. 2 entries per week to run
  lastExecutedAt?: number;
  lastScorecardId?: string;
  cachedAnalysisHash?: string;
  executionHistory: Array<{
    timestamp: number;
    status: 'success' | 'skipped_no_entries' | 'skipped_paused' | 'error';
    summary?: string;
    deliveredChannels?: string[];
  }>;
}

export interface DevTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  suggestedDataModels?: string[];
  suggestedApiEndpoints?: string[];
  priority: 'P0' | 'P1' | 'P2';
  category: 'Feature' | 'Bug' | 'Refactor' | 'Architecture' | 'Security';
  isDraft: boolean; // default true for review
  isSelected?: boolean;
  status: 'pending_review' | 'dispatched' | 'dismissed';
  dispatchedTo?: {
    platform: 'github' | 'trello' | 'linear';
    issueUrl?: string;
    issueNumber?: number;
    dispatchedAt: number;
  };
  journalId?: string;
  sourceTextSnippet?: string;
}

export interface ProjectManagementSettings {
  enabled: boolean;
  targetPlatform: 'github' | 'trello';
  github: {
    owner: string;
    repo: string;
    token?: string;
    defaultLabels: string[];
    useDraftLabel: boolean;
  };
  trello?: {
    apiKey?: string;
    token?: string;
    boardId?: string;
    listId?: string;
  };
  issueTemplate: 'standard' | 'agile_user_story' | 'technical_rfc';
  autoExtractOnSave: boolean;
  requireConfirmation: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO date-time
  end: string;   // ISO date-time
  location?: string;
  attendeeCount: number;
  htmlLink?: string;
  isAllDay: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarIntegrationSettings {
  connected: boolean;
  connectedEmail: string | null;
  lastSyncedAt: number | null;
  autoPromptAfterMeeting: boolean;
}

// ============================================================================
// COLLABORATIVE JOURNALING (E2EE & AI JOINT REFLECTIONS)
// ============================================================================

export type CollaborationRole = 'couples' | 'accountability' | 'friend';

export interface CollaborativeConnection {
  id: string; // Connection ID
  inviterUid: string;
  inviterName: string;
  partnerUid: string;
  partnerName: string;
  role: CollaborationRole;
  status: 'pending' | 'accepted' | 'disconnected';
  createdAt: number;
  acceptedAt?: number;
  autoShareTags: string[]; // e.g. ['#relationship', '#accountability']
  inviteCode: string;
}

export interface CollaborativeInvite {
  id: string;
  inviteCode: string;
  inviterUid: string;
  inviterName: string;
  role: CollaborationRole;
  autoShareTags: string[];
  expiresAt: number;
  createdAt: number;
  accepted: boolean;
  acceptedByUid?: string;
  acceptedByName?: string;
}

export interface SharedJournalEntry {
  id: string; // Shared entry ID
  originalJournalId: string;
  connectionId: string;
  authorUid: string;
  authorName: string;
  partnerUid: string;
  role: CollaborationRole;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  // End-to-end encrypted payload containing title, messages, summary, emotions, artwork
  encryptedPayload: {
    ciphertext: string;
    salt: string;
    iv: string;
  };
  accessHash?: string; // SHA-256 access verification hash for password validation
  isPasswordProtected?: boolean;
  // Optional sanitized plain summary preview for dashboard card
  topicPreview?: string;
}

export interface DecryptedSharedEntry extends Omit<SharedJournalEntry, 'encryptedPayload'> {
  title: string;
  summary: string;
  messages: Message[];
  emotions?: EmotionTag[];
  artwork?: JournalArtwork;
  isUnlocked?: boolean;
  encryptedPayload?: {
    ciphertext: string;
    salt: string;
    iv: string;
  };
}

export interface JointReflectionPrompt {
  id: string;
  connectionId: string;
  prompt: string;
  theme: string;
  role: CollaborationRole;
  createdAt: number;
  partnerA_response?: {
    text: string;
    authorName: string;
    updatedAt: number;
  };
  partnerB_response?: {
    text: string;
    authorName: string;
    updatedAt: number;
  };
}

