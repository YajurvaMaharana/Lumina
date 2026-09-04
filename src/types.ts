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
  userFeedback?: {
    isAccurate: boolean;
    notes?: string;
  };
  
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


