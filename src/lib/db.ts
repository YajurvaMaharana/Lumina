import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { 
  Journal, 
  IntegrationSettings, 
  TradeRecord, 
  WeeklyPerformanceReport, 
  AutonomousAgentSettings, 
  HabitEvolutionScorecard,
  DevTask,
  ProjectManagementSettings,
  CalendarIntegrationSettings
} from '../types';
import { getPassword, encryptData, decryptData } from './crypto';

const processJournalDoc = async (data: any, id: string): Promise<Journal> => {
  let journalData = { id, ...data } as Journal;
  const password = getPassword();
  
  if (journalData.encryptedPayload) {
    if (password) {
      try {
        const decrypted = await decryptData(journalData.encryptedPayload, password);
        journalData = { ...journalData, ...decrypted };
      } catch (err) {
        console.error("Failed to decrypt journal", err);
        journalData.title = "🔒 Decryption Failed (Wrong Password?)";
        journalData.messages = [];
        journalData.summary = "Unable to decrypt data.";
      }
    } else {
      journalData.title = "🔒 Encrypted Entry";
      journalData.messages = [];
      journalData.summary = "Please set your password to view this entry.";
    }
  }
  return journalData;
};

export const getJournals = async (userId: string): Promise<Journal[]> => {
  const q = query(
    collection(db, 'users', userId, 'journals'),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  const journals = await Promise.all(snapshot.docs.map(doc => processJournalDoc(doc.data(), doc.id)));
  return journals;
};

export const getJournal = async (userId: string, journalId: string): Promise<Journal | null> => {
  const docRef = doc(db, 'users', userId, 'journals', journalId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return await processJournalDoc(snapshot.data(), snapshot.id);
  }
  return null;
};

export const saveJournal = async (userId: string, journal: Journal): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'journals', journal.id);
  const password = getPassword();
  
  if (!password) {
    throw new Error("Zero-Knowledge password is required to save.");
  }

  const { id, title, summary, location, messages, emotions, cbtDistortions, userFeedback, artwork, ...baseData } = journal;
  const sensitiveData = { title, summary, location, messages, emotions, cbtDistortions, userFeedback, artwork };
  
  const encryptedPayload = await encryptData(sensitiveData, password);
  
  await setDoc(docRef, {
    ...baseData,
    encryptedPayload,
    updatedAt: Date.now(),
    title: "", // clear plaintext
    summary: "", // clear plaintext
    location: "", // clear plaintext
    messages: [] // clear plaintext
  }, { merge: true });
};

// --- Integration Settings ---
export const getIntegrationSettings = async (userId: string): Promise<IntegrationSettings | null> => {
  const docRef = doc(db, 'users', userId, 'integrations', 'config');
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data() as IntegrationSettings;
  }
  return {
    github: {
      enabled: false,
      username: '',
      status: 'disconnected'
    },
    trading: {
      enabled: false,
      provider: 'manual',
      autoSync: true
    },
    discordWebhook: {
      enabled: false,
      webhookUrl: ''
    },
    privacyAcknowledged: false
  };
};

export const saveIntegrationSettings = async (userId: string, settings: IntegrationSettings): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'integrations', 'config');
  await setDoc(docRef, {
    ...settings,
    updatedAt: Date.now()
  }, { merge: true });
};

// --- Trade Records ---
export const getTrades = async (userId: string): Promise<TradeRecord[]> => {
  const q = query(
    collection(db, 'users', userId, 'trades'),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TradeRecord));
};

export const saveTrade = async (userId: string, trade: TradeRecord): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'trades', trade.id);
  await setDoc(docRef, trade, { merge: true });
};

export const deleteTrade = async (userId: string, tradeId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'trades', tradeId);
  await deleteDoc(docRef);
};

// --- Weekly Performance Reports ---
export const getWeeklyReports = async (userId: string): Promise<WeeklyPerformanceReport[]> => {
  const q = query(
    collection(db, 'users', userId, 'reports'),
    orderBy('generatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyPerformanceReport));
};

export const saveWeeklyReport = async (userId: string, report: WeeklyPerformanceReport): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'reports', report.id);
  await setDoc(docRef, report, { merge: true });
};

// --- Autonomous Agent Settings & Habit Evolution Scorecards ---
export const getAgentSettings = async (userId: string): Promise<AutonomousAgentSettings> => {
  const docRef = doc(db, 'users', userId, 'agent', 'config');
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data() as AutonomousAgentSettings;
  }
  return {
    enabled: false,
    isPaused: false,
    pauseUntil: null,
    scheduleCron: '0 8 * * 0', // Every Sunday at 8:00 AM
    deliveryChannels: {
      inApp: true,
      discord: false,
      email: false,
      telegram: false
    },
    minEntriesRequired: 2,
    executionHistory: []
  };
};

export const saveAgentSettings = async (userId: string, settings: AutonomousAgentSettings): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'agent', 'config');
  await setDoc(docRef, settings, { merge: true });
};

export const getHabitScorecards = async (userId: string): Promise<HabitEvolutionScorecard[]> => {
  const q = query(
    collection(db, 'users', userId, 'scorecards'),
    orderBy('generatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitEvolutionScorecard));
};

export const saveHabitScorecard = async (userId: string, scorecard: HabitEvolutionScorecard): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'scorecards', scorecard.id);
  await setDoc(docRef, scorecard, { merge: true });
};

export const markScorecardAsRead = async (userId: string, scorecardId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'scorecards', scorecardId);
  await setDoc(docRef, { isRead: true }, { merge: true });
};

// --- Automated Project Management Dispatcher DB Helpers ---
export const getProjectManagementSettings = async (userId: string): Promise<ProjectManagementSettings> => {
  const docRef = doc(db, 'users', userId, 'pm', 'config');
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data() as ProjectManagementSettings;
  }
  return {
    enabled: true,
    targetPlatform: 'github',
    github: {
      owner: '',
      repo: '',
      defaultLabels: ['dev-task', '🤖 AI-generated', 'brainstorm-extract'],
      useDraftLabel: true
    },
    issueTemplate: 'standard',
    autoExtractOnSave: true,
    requireConfirmation: true
  };
};

export const saveProjectManagementSettings = async (userId: string, settings: ProjectManagementSettings): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'pm', 'config');
  await setDoc(docRef, settings, { merge: true });
};

export const getDevTasks = async (userId: string): Promise<DevTask[]> => {
  const q = query(
    collection(db, 'users', userId, 'dev_tasks'),
    orderBy('priority', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DevTask));
};

export const saveDevTask = async (userId: string, task: DevTask): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'dev_tasks', task.id);
  await setDoc(docRef, task, { merge: true });
};

export const deleteDevTask = async (userId: string, taskId: string): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'dev_tasks', taskId);
  await deleteDoc(docRef);
};

// --- Google Calendar Integration Status ---
export const getCalendarIntegrationStatus = async (userId: string): Promise<CalendarIntegrationSettings> => {
  const docRef = doc(db, 'users', userId, 'integrations', 'calendar');
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data() as CalendarIntegrationSettings;
  }
  return {
    connected: false,
    connectedEmail: null,
    lastSyncedAt: null,
    autoPromptAfterMeeting: false
  };
};

export const saveCalendarIntegrationStatus = async (userId: string, settings: CalendarIntegrationSettings): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'integrations', 'calendar');
  await setDoc(docRef, settings, { merge: true });
};

// ============================================================================
// COLLABORATIVE JOURNALING CLIENT HELPERS
// ============================================================================

// Helper: Extract #hashtags from text
export const extractTagsFromText = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_\-]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(t => t.toLowerCase())));
};

// API: Fetch partner connections
export const fetchCollaborativeConnections = async (idToken: string) => {
  const res = await fetch('/api/collaborative/connections', {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch connections');
  return (await res.json()).connections;
};

// API: Create an invitation
export const createCollaborativeInvite = async (
  idToken: string,
  role: 'couples' | 'accountability' | 'friend',
  autoShareTags: string[]
) => {
  const res = await fetch('/api/collaborative/invites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ role, autoShareTags })
  });
  if (!res.ok) throw new Error('Failed to create invite');
  return (await res.json()).invite;
};

// API: Accept an invitation
export const acceptCollaborativeInvite = async (idToken: string, inviteCode: string) => {
  const res = await fetch('/api/collaborative/invites/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ inviteCode })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to accept invite');
  }
  return (await res.json()).connection;
};

// API: Disconnect partner
export const disconnectCollaborativePartner = async (idToken: string, connectionId: string) => {
  const res = await fetch(`/api/collaborative/connections/${connectionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) throw new Error('Failed to disconnect partner');
  return await res.json();
};

// API: Update auto-share tags
export const updateConnectionTags = async (idToken: string, connectionId: string, autoShareTags: string[]) => {
  const res = await fetch(`/api/collaborative/connections/${connectionId}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ autoShareTags })
  });
  if (!res.ok) throw new Error('Failed to update tags');
  return (await res.json()).connection;
};

// API: Publish an encrypted entry to a connection
export const publishSharedEntry = async (
  idToken: string,
  data: {
    originalJournalId: string;
    connectionId: string;
    encryptedPayload: { ciphertext: string; salt: string; iv: string };
    accessHash?: string;
    isPasswordProtected?: boolean;
    tags: string[];
    topicPreview?: string;
  }
) => {
  const res = await fetch('/api/collaborative/entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to share entry');
  return (await res.json()).entry;
};

// API: Fetch shared entries
export const fetchSharedEntries = async (idToken: string, connectionId?: string) => {
  const url = connectionId ? `/api/collaborative/entries?connectionId=${encodeURIComponent(connectionId)}` : '/api/collaborative/entries';
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch shared entries');
  return (await res.json()).entries;
};

// API: Revoke an entry
export const revokeSharedEntry = async (idToken: string, entryId: string) => {
  const res = await fetch(`/api/collaborative/entries/${entryId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) throw new Error('Failed to revoke entry');
  return await res.json();
};

// API: Generate AI joint reflection prompt
export const generateJointPrompt = async (
  idToken: string,
  params: {
    connectionId: string;
    role: string;
    themes?: string[];
    recentSnippets?: string[];
  }
) => {
  const res = await fetch('/api/collaborative/joint-prompt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error('Failed to generate joint prompt');
  return (await res.json()).prompts;
};

// API: Fetch joint reflection prompts
export const fetchJointPrompts = async (idToken: string, connectionId: string) => {
  const res = await fetch(`/api/collaborative/joint-prompts?connectionId=${encodeURIComponent(connectionId)}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch joint prompts');
  return (await res.json()).prompts;
};

// API: Respond to a joint reflection prompt
export const respondToJointPrompt = async (idToken: string, promptId: string, text: string) => {
  const res = await fetch(`/api/collaborative/joint-prompts/${promptId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Failed to submit response');
  return (await res.json()).prompt;
};

