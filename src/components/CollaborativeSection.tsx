import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Share2,
  Lock,
  Unlock,
  Key,
  Copy,
  Check,
  Heart,
  Target,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  Settings2,
  X,
  BookOpen,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  CollaborationRole,
  CollaborativeConnection,
  SharedJournalEntry,
  JointReflectionPrompt
} from '../types';
import {
  fetchCollaborativeConnections,
  createCollaborativeInvite,
  acceptCollaborativeInvite,
  disconnectCollaborativePartner,
  updateConnectionTags,
  fetchSharedEntries,
  revokeSharedEntry,
  generateJointPrompt,
  fetchJointPrompts,
  respondToJointPrompt
} from '../lib/db';
import {
  verifyAndDecryptSharedEntry
} from '../lib/crypto';

interface CollaborativeSectionProps {
  onSelectJournal?: (journalId: string) => void;
  targetEntryId?: string | null;
  onClearTargetEntry?: () => void;
}

interface UnlockedReflection {
  title: string;
  summary: string;
  messages: any[];
  emotions?: any[];
  artwork?: any;
}

export default function CollaborativeSection({
  onSelectJournal,
  targetEntryId,
  onClearTargetEntry
}: CollaborativeSectionProps) {
  const { user } = useAuth();

  // Active connections & selection
  const [connections, setConnections] = useState<CollaborativeConnection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Shared entries & password protection unlock state
  const [rawSharedEntries, setRawSharedEntries] = useState<SharedJournalEntry[]>([]);
  const [unlockedEntries, setUnlockedEntries] = useState<Record<string, UnlockedReflection>>({});
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [unlockErrors, setUnlockErrors] = useState<Record<string, string>>({});
  const [isUnlocking, setIsUnlocking] = useState<Record<string, boolean>>({});
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Quick Unlock Target Modal state (triggered from notification redirect)
  const [modalTargetEntry, setModalTargetEntry] = useState<SharedJournalEntry | null>(null);
  const [modalPasswordInput, setModalPasswordInput] = useState('');
  const [modalUnlockError, setModalUnlockError] = useState<string | null>(null);
  const [isModalUnlocking, setIsModalUnlocking] = useState(false);

  // AI Joint Reflection Prompts
  const [jointPrompts, setJointPrompts] = useState<JointReflectionPrompt[]>([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [promptResponseInputs, setPromptResponseInputs] = useState<Record<string, string>>({});
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<Record<string, boolean>>({});

  // Modals & Forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [tagEditConn, setTagEditConn] = useState<CollaborativeConnection | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Invite creation state
  const [inviteRole, setInviteRole] = useState<CollaborationRole>('couples');
  const [inviteTags, setInviteTags] = useState<string>('#relationship, #gratitude');
  const [generatedInvite, setGeneratedInvite] = useState<{ code: string; url: string } | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Join invite state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load connections on mount
  useEffect(() => {
    if (user) {
      loadConnections();
      checkForUrlInvite();
    }
  }, [user]);

  // Handle targetEntryId routing from notification clicks
  useEffect(() => {
    if (!targetEntryId || rawSharedEntries.length === 0) return;

    const entry = rawSharedEntries.find(e => e.id === targetEntryId);
    if (entry) {
      if (entry.connectionId !== activeConnectionId) {
        setActiveConnectionId(entry.connectionId);
      }

      // If already unlocked, expand it; otherwise open password prompt modal
      if (unlockedEntries[targetEntryId]) {
        setExpandedEntryId(targetEntryId);
      } else {
        setModalTargetEntry(entry);
        setModalPasswordInput('');
        setModalUnlockError(null);
      }

      // Smooth scroll to entry
      setTimeout(() => {
        const el = document.getElementById(`shared-entry-${targetEntryId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
    }
  }, [targetEntryId, rawSharedEntries, activeConnectionId, unlockedEntries]);

  // Check URL query parameters for invite: ?collab_invite=LUM-XXXX
  const checkForUrlInvite = () => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('collab_invite');

    if (inviteCode) {
      setJoinCodeInput(inviteCode.toUpperCase());
      setShowJoinModal(true);
    }
  };

  const loadConnections = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const conns = await fetchCollaborativeConnections(idToken);
      setConnections(conns || []);
      if (conns && conns.length > 0 && !activeConnectionId) {
        setActiveConnectionId(conns[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load connections:', err);
      setError('Could not load connections.');
    } finally {
      setLoading(false);
    }
  };

  // Load shared entries & prompts whenever active connection changes
  useEffect(() => {
    if (user && activeConnectionId) {
      loadSharedData(activeConnectionId);
    } else {
      setRawSharedEntries([]);
      setJointPrompts([]);
    }
  }, [user, activeConnectionId]);

  const loadSharedData = useCallback(async (connectionId: string) => {
    if (!user) return;
    setLoadingEntries(true);
    try {
      const idToken = await user.getIdToken();
      const [rawEntries, prompts] = await Promise.all([
        fetchSharedEntries(idToken, connectionId),
        fetchJointPrompts(idToken, connectionId)
      ]);

      setJointPrompts(prompts || []);
      setRawSharedEntries(rawEntries || []);
    } catch (err: any) {
      console.error('Failed to load shared data:', err);
    } finally {
      setLoadingEntries(false);
    }
  }, [user]);

  // Inline unlock
  const handleUnlockEntry = async (entry: SharedJournalEntry) => {
    const password = (passwordInputs[entry.id] || '').trim();
    if (!password) {
      setUnlockErrors(prev => ({
        ...prev,
        [entry.id]: 'Please enter the password to decrypt this reflection.'
      }));
      return;
    }

    setIsUnlocking(prev => ({ ...prev, [entry.id]: true }));
    setUnlockErrors(prev => ({ ...prev, [entry.id]: '' }));

    try {
      const decrypted = await verifyAndDecryptSharedEntry(
        entry.encryptedPayload,
        entry.accessHash,
        password
      );

      setUnlockedEntries(prev => ({
        ...prev,
        [entry.id]: {
          title: decrypted.title || entry.topicPreview || 'Shared Reflection',
          summary: decrypted.summary || '',
          messages: decrypted.messages || [],
          emotions: decrypted.emotions,
          artwork: decrypted.artwork
        }
      }));
      setExpandedEntryId(entry.id);
      if (onClearTargetEntry) onClearTargetEntry();
    } catch (err: any) {
      console.error('Decryption failed for entry:', entry.id, err);
      setUnlockErrors(prev => ({
        ...prev,
        [entry.id]: err?.message || 'Incorrect password. Please verify the password shared by your partner.'
      }));
    } finally {
      setIsUnlocking(prev => ({ ...prev, [entry.id]: false }));
    }
  };

  // Modal unlock handler (triggered from notification banner redirect)
  const handleModalUnlock = async () => {
    if (!modalTargetEntry) return;
    const cleanPass = modalPasswordInput.trim();
    if (!cleanPass) {
      setModalUnlockError('Please enter the reflection password.');
      return;
    }

    setIsModalUnlocking(true);
    setModalUnlockError(null);

    try {
      const decrypted = await verifyAndDecryptSharedEntry(
        modalTargetEntry.encryptedPayload,
        modalTargetEntry.accessHash,
        cleanPass
      );

      setUnlockedEntries(prev => ({
        ...prev,
        [modalTargetEntry.id]: {
          title: decrypted.title || modalTargetEntry.topicPreview || 'Shared Reflection',
          summary: decrypted.summary || '',
          messages: decrypted.messages || [],
          emotions: decrypted.emotions,
          artwork: decrypted.artwork
        }
      }));
      setExpandedEntryId(modalTargetEntry.id);
      setModalTargetEntry(null);
      if (onClearTargetEntry) onClearTargetEntry();
    } catch (err: any) {
      console.error('Modal unlock error:', err);
      setModalUnlockError(err?.message || 'Incorrect password. Please verify the password shared by your partner.');
    } finally {
      setIsModalUnlocking(false);
    }
  };

  // Relock reflection
  const handleRelockEntry = (entryId: string) => {
    setUnlockedEntries(prev => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    setExpandedEntryId(prev => (prev === entryId ? null : prev));
  };

  // Create an invitation with unique code
  const handleCreateInvite = async () => {
    if (!user) return;
    setIsCreatingInvite(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();

      const tags = inviteTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`));

      const invite = await createCollaborativeInvite(idToken, inviteRole, tags);
      const baseUrl = window.location.origin;
      const inviteUrl = `${baseUrl}/?collab_invite=${invite.inviteCode}`;

      setGeneratedInvite({
        code: invite.inviteCode,
        url: inviteUrl
      });
    } catch (err: any) {
      console.error('Failed to create invite:', err);
      setError(err?.message || 'Failed to create invite.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  // Accept an invite
  const handleAcceptInvite = async () => {
    if (!user) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const idToken = await user.getIdToken();
      const code = joinCodeInput.trim().toUpperCase();

      if (!code) {
        setJoinError('Please enter an invite code.');
        setIsJoining(false);
        return;
      }

      const connection = await acceptCollaborativeInvite(idToken, code);

      await loadConnections();
      setActiveConnectionId(connection.id);
      setShowJoinModal(false);
      setJoinCodeInput('');
      setSuccess(`Connected with ${connection.inviterName}!`);

      // Clean URL params if any
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err: any) {
      console.error('Failed to accept invite:', err);
      setJoinError(err?.message || 'Failed to join connection.');
    } finally {
      setIsJoining(false);
    }
  };

  // Disconnect partner
  const handleDisconnect = async (connectionId: string, partnerName: string) => {
    if (!user) return;
    const confirm = window.confirm(
      `Are you sure you want to disconnect from ${partnerName}? All shared entries between you will be immediately revoked.`
    );
    if (!confirm) return;

    try {
      const idToken = await user.getIdToken();
      await disconnectCollaborativePartner(idToken, connectionId);

      const updated = connections.filter(c => c.id !== connectionId);
      setConnections(updated);
      if (activeConnectionId === connectionId) {
        setActiveConnectionId(updated.length > 0 ? updated[0].id : null);
      }
      setSuccess(`Disconnected from ${partnerName}.`);
    } catch (err: any) {
      console.error('Failed to disconnect partner:', err);
      setError('Failed to disconnect partner.');
    }
  };

  // Revoke an individual entry
  const handleRevokeEntry = async (entryId: string) => {
    if (!user) return;
    const confirm = window.confirm('Stop sharing this entry with your partner?');
    if (!confirm) return;

    try {
      const idToken = await user.getIdToken();
      await revokeSharedEntry(idToken, entryId);
      setRawSharedEntries(prev => prev.filter(e => e.id !== entryId));
      handleRelockEntry(entryId);
      setSuccess('Entry sharing revoked.');
    } catch (err: any) {
      console.error('Failed to revoke entry:', err);
      setError('Failed to revoke entry.');
    }
  };

  // Generate AI Joint Reflection Prompts
  const handleGenerateJointPrompts = async () => {
    if (!user || !activeConnectionId) return;
    const activeConn = connections.find(c => c.id === activeConnectionId);
    if (!activeConn) return;

    setIsGeneratingPrompts(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();

      const themes = activeConn.autoShareTags || [];
      const snippets = rawSharedEntries
        .slice(0, 5)
        .map(e => unlockedEntries[e.id]?.title || e.topicPreview || '')
        .filter(Boolean);

      const prompts = await generateJointPrompt(idToken, {
        connectionId: activeConnectionId,
        role: activeConn.role,
        themes,
        recentSnippets: snippets
      });

      setJointPrompts(prompts || []);
      setSuccess('Generated new joint reflection prompts!');
    } catch (err: any) {
      console.error('Failed to generate joint prompts:', err);
      setError('Failed to generate AI joint prompts.');
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Submit response to joint prompt
  const handleSubmitPromptResponse = async (promptId: string) => {
    if (!user) return;
    const text = promptResponseInputs[promptId];
    if (!text || !text.trim()) return;

    setIsSubmittingResponse(prev => ({ ...prev, [promptId]: true }));
    try {
      const idToken = await user.getIdToken();
      const updatedPrompt = await respondToJointPrompt(idToken, promptId, text);

      setJointPrompts(prev => prev.map(p => (p.id === promptId ? updatedPrompt : p)));
      setPromptResponseInputs(prev => ({ ...prev, [promptId]: '' }));
    } catch (err: any) {
      console.error('Failed to submit prompt response:', err);
      setError('Failed to submit response.');
    } finally {
      setIsSubmittingResponse(prev => ({ ...prev, [promptId]: false }));
    }
  };

  // Save updated auto-share tags
  const handleSaveTags = async () => {
    if (!user || !tagEditConn) return;
    try {
      const idToken = await user.getIdToken();
      const tags = tagInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`));

      await updateConnectionTags(idToken, tagEditConn.id, tags);

      setConnections(prev =>
        prev.map(c => (c.id === tagEditConn.id ? { ...c, autoShareTags: tags } : c))
      );
      setShowTagsModal(false);
      setTagEditConn(null);
      setSuccess('Auto-share tags updated.');
    } catch (err: any) {
      console.error('Failed to update tags:', err);
      setError('Failed to update tags.');
    }
  };

  const activeConnection = connections.find(c => c.id === activeConnectionId);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner & Actions */}
      <div className="glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                Collaborative Journaling
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" /> Password Protected
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Share reflections with partners or accountability friends with custom password encryption.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                setJoinCodeInput('');
                setJoinError(null);
                setShowJoinModal(true);
              }}
              className="flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] transition-all flex items-center justify-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              Join with Code
            </button>
            <button
              onClick={() => {
                setGeneratedInvite(null);
                setShowInviteModal(true);
              }}
              className="flex-1 md:flex-initial px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Partner
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}

        {/* Partner Connection Switcher */}
        <div className="mt-6 pt-5 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Connected Partners ({connections.length})
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
              Loading partners...
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
              <p className="text-xs text-[var(--text-muted)]">No active partner connections yet.</p>
              <p className="text-[11px] text-[var(--text-faint)] mt-1">
                Click "Invite Partner" to start a secure, password-protected reflection space.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {connections.map((conn) => {
                const partnerName = conn.inviterUid === user?.uid ? conn.partnerName : conn.inviterName;
                const isSelected = conn.id === activeConnectionId;

                const roleIcons = {
                  couples: <Heart className="w-3.5 h-3.5 text-rose-500" />,
                  accountability: <Target className="w-3.5 h-3.5 text-blue-500" />,
                  friend: <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                };

                return (
                  <div
                    key={conn.id}
                    onClick={() => setActiveConnectionId(conn.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/5 dark:bg-violet-500/10 shadow-sm'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {partnerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {partnerName}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                            {roleIcons[conn.role]}
                            {conn.role.charAt(0).toUpperCase() + conn.role.slice(1)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagEditConn(conn);
                            setTagInput(conn.autoShareTags?.join(', ') || '');
                            setShowTagsModal(true);
                          }}
                          title="Configure auto-share tags"
                          className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnect(conn.id, partnerName);
                          }}
                          title="Disconnect partner"
                          className="p-1 rounded text-[var(--text-faint)] hover:text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Auto-share tags preview */}
                    <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                      <span className="text-[9px] text-[var(--text-faint)] uppercase font-semibold">Auto-share:</span>
                      {conn.autoShareTags && conn.autoShareTags.length > 0 ? (
                        conn.autoShareTags.map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--bg-card-hover)] text-violet-600 dark:text-violet-400 border border-[var(--border-color)]">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] text-[var(--text-faint)] italic">None (manual only)</span>
                      )}
                      <span className="ml-auto text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <Lock className="w-2.5 h-2.5 text-emerald-500" /> Password Protected
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area: Dual Feed + AI Reflection Studio */}
      {activeConnection && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Shared Reflections Feed */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-500" />
                Shared Reflections ({rawSharedEntries.length})
              </h3>
              <button
                onClick={() => activeConnectionId && loadSharedData(activeConnectionId)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors text-xs flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {loadingEntries ? (
              <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              </div>
            ) : rawSharedEntries.length === 0 ? (
              <div className="glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center">
                <Share2 className="w-8 h-8 text-[var(--text-faint)] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">No Entries Shared Yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                  Share entries individually from your Journal or tag entries with{' '}
                  <strong className="text-violet-500">{activeConnection.autoShareTags?.join(', ') || '#accountability'}</strong> to mirror them here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rawSharedEntries.map((entry) => {
                  const isAuthor = entry.authorUid === user?.uid;
                  const unlocked = unlockedEntries[entry.id];
                  const isExpanded = expandedEntryId === entry.id;
                  const isTargeted = targetEntryId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      id={`shared-entry-${entry.id}`}
                      className={`glass rounded-2xl border overflow-hidden transition-all duration-300 ${
                        isTargeted
                          ? 'border-violet-500 ring-2 ring-violet-500/30 bg-violet-500/5 dark:bg-violet-500/10'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-violet-500/30'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  isAuthor
                                    ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {isAuthor ? 'You Shared' : `${entry.authorName} Shared`}
                              </span>

                              {unlocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  <Unlock className="w-2.5 h-2.5" /> Unlocked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  <Lock className="w-2.5 h-2.5 text-amber-500" /> Password Protected
                                </span>
                              )}

                              <span className="text-[10px] text-[var(--text-faint)] flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                              {unlocked ? unlocked.title : (entry.topicPreview || 'Encrypted Shared Reflection')}
                            </h4>

                            {unlocked && unlocked.summary && (
                              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                                {unlocked.summary}
                              </p>
                            )}

                            {/* Tags */}
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                {entry.tags.map(t => (
                                  <span key={t} className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--bg-card-hover)] text-[var(--text-muted)]">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {unlocked && (
                              <button
                                onClick={() => handleRelockEntry(entry.id)}
                                title="Lock reflection again"
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] text-xs flex items-center gap-1"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isAuthor && (
                              <button
                                onClick={() => handleRevokeEntry(entry.id)}
                                title="Stop sharing this entry"
                                className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-red-500 hover:bg-red-500/10 text-xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {unlocked && (
                              <button
                                onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Recipient Password Prompt UI (when locked) */}
                        {!unlocked && (
                          <div className="mt-3 p-3 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)]">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                                <KeyRound className="w-3.5 h-3.5 text-violet-500" />
                                Enter password to decrypt reflection
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                id={`password-input-${entry.id}`}
                                type="password"
                                value={passwordInputs[entry.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPasswordInputs(prev => ({ ...prev, [entry.id]: val }));
                                  if (unlockErrors[entry.id]) {
                                    setUnlockErrors(prev => ({ ...prev, [entry.id]: '' }));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUnlockEntry(entry);
                                }}
                                placeholder="Enter reflection password..."
                                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500"
                              />
                              <button
                                onClick={() => handleUnlockEntry(entry)}
                                disabled={isUnlocking[entry.id]}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all shrink-0"
                              >
                                {isUnlocking[entry.id] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                                Unlock
                              </button>
                            </div>

                            {unlockErrors[entry.id] && (
                              <p className="text-[11px] text-red-500 mt-2 flex items-center gap-1 font-medium animate-shake">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {unlockErrors[entry.id]}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Expanded Full Reflection / Messages (when unlocked) */}
                        {unlocked && isExpanded && (
                          <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-3 animate-fade-in">
                            {unlocked.messages && unlocked.messages.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {unlocked.messages.map((m) => (
                                  <div
                                    key={m.id || m.timestamp}
                                    className={`p-2.5 rounded-xl text-xs ${
                                      m.role === 'user'
                                        ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)]'
                                        : 'bg-violet-500/5 text-[var(--text-secondary)] border border-violet-500/10'
                                    }`}
                                  >
                                    <p className="font-semibold text-[10px] text-[var(--text-muted)] mb-1">
                                      {m.role === 'user' ? entry.authorName : 'Lumina AI'}
                                    </p>
                                    <p className="whitespace-pre-wrap">{m.content}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--text-muted)] italic">
                                {unlocked.summary || 'No detailed messages recorded in this entry.'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column (5 cols): AI Joint Reflection Studio */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                AI Joint Reflection Studio
              </h3>
              <button
                onClick={handleGenerateJointPrompts}
                disabled={isGeneratingPrompts}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-sm disabled:opacity-50 transition-all"
              >
                {isGeneratingPrompts ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {isGeneratingPrompts ? 'Generating...' : 'New Prompts'}
              </button>
            </div>

            <div className="space-y-3">
              {jointPrompts.length === 0 ? (
                <div className="glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 text-center">
                  <Sparkles className="w-8 h-8 text-violet-500/60 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Mutual Reflection Prompts</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Click "New Prompts" to have Gemini craft synchronized reflection prompts based on your shared themes.
                  </p>
                </div>
              ) : (
                jointPrompts.map((prompt) => {
                  const partnerA = prompt.partnerA_response;
                  const partnerB = prompt.partnerB_response;
                  const isInviter = activeConnection.inviterUid === user?.uid;
                  const hasUserResponded = isInviter ? !!partnerA : !!partnerB;

                  return (
                    <div
                      key={prompt.id}
                      className="glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">
                          {prompt.theme || 'Mutual Reflection'}
                        </span>
                        <span className="text-[9px] text-[var(--text-faint)]">
                          {new Date(prompt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
                        "{prompt.prompt}"
                      </p>

                      {/* Responses Area */}
                      <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
                        {/* Partner A's Response */}
                        {partnerA && (
                          <div className="p-2.5 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-xs">
                            <p className="font-semibold text-[10px] text-violet-600 dark:text-violet-400 mb-0.5">
                              {partnerA.authorName} answered:
                            </p>
                            <p className="text-[var(--text-primary)]">{partnerA.text}</p>
                          </div>
                        )}

                        {/* Partner B's Response */}
                        {partnerB && (
                          <div className="p-2.5 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-xs">
                            <p className="font-semibold text-[10px] text-emerald-600 dark:text-emerald-400 mb-0.5">
                              {partnerB.authorName} answered:
                            </p>
                            <p className="text-[var(--text-primary)]">{partnerB.text}</p>
                          </div>
                        )}

                        {/* Response Input */}
                        {!hasUserResponded ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={promptResponseInputs[prompt.id] || ''}
                              onChange={(e) =>
                                setPromptResponseInputs(prev => ({
                                  ...prev,
                                  [prompt.id]: e.target.value
                                }))
                              }
                              placeholder="Write your reflection..."
                              className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSubmitPromptResponse(prompt.id);
                              }}
                            />
                            <button
                              onClick={() => handleSubmitPromptResponse(prompt.id)}
                              disabled={isSubmittingResponse[prompt.id]}
                              className="p-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors"
                            >
                              {isSubmittingResponse[prompt.id] ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium">
                            <Check className="w-3.5 h-3.5" /> You responded to this prompt
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK UNLOCK TARGET MODAL (Triggered when user clicks toast notification) */}
      {modalTargetEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Unlock Shared Reflection</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Shared by <span className="font-semibold text-violet-500">{modalTargetEntry.authorName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalTargetEntry(null);
                  if (onClearTargetEntry) onClearTargetEntry();
                }}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-xs">
              <p className="font-semibold text-[var(--text-primary)] truncate">
                "{modalTargetEntry.topicPreview || 'Encrypted Reflection'}"
              </p>
              <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
                {new Date(modalTargetEntry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>

            {modalUnlockError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalUnlockError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-violet-500" />
                Reflection Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                autoFocus
                value={modalPasswordInput}
                onChange={(e) => {
                  setModalPasswordInput(e.target.value);
                  if (modalUnlockError) setModalUnlockError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleModalUnlock();
                }}
                placeholder="Enter the password provided by your partner..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setModalTargetEntry(null);
                  if (onClearTargetEntry) onClearTargetEntry();
                }}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleModalUnlock}
                disabled={isModalUnlocking}
                className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isModalUnlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                Unlock Reflection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Invite Partner Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-violet-500" />
                Invite a Partner
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!generatedInvite ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                    Relationship Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'couples', label: 'Couples', icon: Heart, desc: 'Emotional holding' },
                      { id: 'accountability', label: 'Accountability', icon: Target, desc: 'Habits & goals' },
                      { id: 'friend', label: 'Friend', icon: Sparkles, desc: 'Mutual growth' }
                    ].map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setInviteRole(r.id as CollaborationRole)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          inviteRole === r.id
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
                        }`}
                      >
                        <r.icon className={`w-4 h-4 mb-1 ${inviteRole === r.id ? 'text-violet-500' : 'text-[var(--text-muted)]'}`} />
                        <p className="text-xs font-bold text-[var(--text-primary)]">{r.label}</p>
                        <p className="text-[10px] text-[var(--text-faint)] mt-0.5">{r.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                    Auto-Share Hashtags (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteTags}
                    onChange={(e) => setInviteTags(e.target.value)}
                    placeholder="#relationship, #accountability, #goals"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                  />
                  <p className="text-[10px] text-[var(--text-faint)] mt-1">
                    Entries saved with these tags will automatically mirror to this partner.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
                  <p>
                    Each shared reflection is protected with a custom password chosen at share time. Plaintext entries are never sent unencrypted to the server.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateInvite}
                    disabled={isCreatingInvite}
                    className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCreatingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Generate Invite Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Invite created! Send this link or code to your partner.</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                    Invite Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.url}
                      className="flex-1 px-3 py-2 rounded-xl text-xs bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.url);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2500);
                      }}
                      className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedInvite ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                    Invite Code
                  </label>
                  <div className="p-2.5 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] font-mono font-bold text-center text-sm text-[var(--text-primary)]">
                    {generatedInvite.code}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      setGeneratedInvite(null);
                      loadConnections();
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Join with Code / Link Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Key className="w-4 h-4 text-violet-500" />
                Connect with Partner
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. LUM-A8X4"
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono uppercase bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                />
              </div>

              <p className="text-[11px] text-[var(--text-muted)]">
                Enter the code from your partner's invite to link your reflection accounts.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptInvite}
                  disabled={isJoining}
                  className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isJoining && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Connect Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Configure Auto-Share Tags Modal */}
      {showTagsModal && tagEditConn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Tag className="w-4 h-4 text-violet-500" />
                Configure Auto-Share Tags
              </h3>
              <button
                onClick={() => setShowTagsModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                Configure rule-based tags for{' '}
                <strong className="text-[var(--text-primary)]">
                  {tagEditConn.inviterUid === user?.uid ? tagEditConn.partnerName : tagEditConn.inviterName}
                </strong>
                .
              </p>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="#relationship, #accountability, #goals"
                className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
              />
              <p className="text-[10px] text-[var(--text-faint)] mt-1.5">
                Comma-separated tags (e.g. #relationship, #fitness, #gratitude).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTagsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTags}
                className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-sm"
              >
                Save Tags
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
