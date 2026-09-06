import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Lock,
  Users,
  CheckCircle2,
  Shield,
  Heart,
  Target,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import NeuralOrbit, { NeuralOrbitLoader } from './NeuralOrbit';
import { useAuth } from '../lib/AuthContext';
import { Journal, CollaborativeConnection } from '../types';
import {
  fetchCollaborativeConnections,
  publishSharedEntry,
  revokeSharedEntry,
  fetchSharedEntries,
  extractTagsFromText,
  saveJournal
} from '../lib/db';
import { encryptSharedEntryWithPassword } from '../lib/crypto';

interface ShareEntryModalProps {
  journal: Journal;
  isOpen: boolean;
  onClose: () => void;
  onShareUpdated?: (sharedConnectionIds: string[]) => void;
}

export default function ShareEntryModal({
  journal,
  isOpen,
  onClose,
  onShareUpdated
}: ShareEntryModalProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<CollaborativeConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [sharedConnections, setSharedConnections] = useState<string[]>(journal.sharedConnections || []);
  
  // Password protection state
  const [entryPassword, setEntryPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadConnectionsAndSharedStatus();
      setEntryPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, user]);

  const loadConnectionsAndSharedStatus = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const [activeConns, sharedList] = await Promise.all([
        fetchCollaborativeConnections(idToken),
        fetchSharedEntries(idToken)
      ]);

      setConnections(activeConns || []);

      // Cross-check which connections already hold a shared entry for this journal
      const alreadySharedWith = (sharedList || [])
        .filter((entry: any) => entry.originalJournalId === journal.id)
        .map((entry: any) => entry.connectionId);

      const merged = Array.from(new Set([...(journal.sharedConnections || []), ...alreadySharedWith]));
      setSharedConnections(merged);
    } catch (err: any) {
      console.error('Failed to load sharing settings:', err);
      setError('Could not load partner connections.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleShare = async (conn: CollaborativeConnection) => {
    if (!user) return;
    const isCurrentlyShared = sharedConnections.includes(conn.id);
    setActionInProgress(conn.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const idToken = await user.getIdToken();

      if (isCurrentlyShared) {
        // Unshare / Revoke
        const sharedList = await fetchSharedEntries(idToken, conn.id);
        const existing = sharedList.find((e: any) => e.originalJournalId === journal.id);
        if (existing) {
          await revokeSharedEntry(idToken, existing.id);
        }

        const updated = sharedConnections.filter(id => id !== conn.id);
        setSharedConnections(updated);

        // Update local journal record
        const updatedJournal = { ...journal, sharedConnections: updated };
        await saveJournal(user.uid, updatedJournal);
        if (onShareUpdated) onShareUpdated(updated);

        setSuccessMsg(`Revoked sharing with ${conn.inviterUid === user.uid ? conn.partnerName : conn.inviterName}.`);
      } else {
        // Validation: sender password is required
        const cleanPassword = entryPassword.trim();
        const cleanConfirm = confirmPassword.trim();

        if (!cleanPassword) {
          setError('Please set a password specifically for this shared reflection.');
          setActionInProgress(null);
          return;
        }

        if (cleanPassword.length < 4) {
          setError('Password must be at least 4 characters long.');
          setActionInProgress(null);
          return;
        }

        if (cleanPassword !== cleanConfirm) {
          setError('Passwords do not match. Please confirm your password.');
          setActionInProgress(null);
          return;
        }

        // Prepare clean unencrypted journal payload
        const payloadToEncrypt = {
          title: journal.title || 'Untitled Reflection',
          summary: journal.summary || '',
          messages: journal.messages || [],
          emotions: journal.emotions || [],
          artwork: journal.artwork,
          createdAt: journal.createdAt,
          location: journal.location
        };

        // Encrypt with user's custom password using PBKDF2/AES-GCM
        const { encryptedPayload, accessHash } = await encryptSharedEntryWithPassword(
          payloadToEncrypt,
          cleanPassword
        );

        const tags = extractTagsFromText(`${journal.title} ${journal.summary} ${(journal.messages || []).map(m => m.content).join(' ')}`);

        const publishedEntry = await publishSharedEntry(idToken, {
          originalJournalId: journal.id,
          connectionId: conn.id,
          encryptedPayload,
          accessHash,
          isPasswordProtected: true,
          tags,
          topicPreview: journal.title || 'Shared Reflection'
        });

        // Dispatch local event for real-time notification testing
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('lumina:shared-entry-created', {
              detail: {
                entryId: publishedEntry.id,
                connectionId: conn.id,
                authorName: user.displayName || user.email?.split('@')[0] || 'Partner',
                authorUid: user.uid,
                topicPreview: journal.title || 'Shared Reflection',
                createdAt: Date.now()
              }
            })
          );
        }

        const updated = [...sharedConnections, conn.id];
        setSharedConnections(updated);

        // Update local journal record
        const updatedJournal = { ...journal, sharedConnections: updated };
        await saveJournal(user.uid, updatedJournal);
        if (onShareUpdated) onShareUpdated(updated);

        setSuccessMsg(`Password protected and shared with ${conn.inviterUid === user.uid ? conn.partnerName : conn.inviterName}! Remember to share this password with them.`);
        setEntryPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      console.error('Failed to update share state:', err);
      setError(err?.message || 'Failed to update sharing.');
    } finally {
      setActionInProgress(null);
    }
  };

  if (!isOpen) return null;

  const partnerDisplayName = (conn: CollaborativeConnection) =>
    conn.inviterUid === user?.uid ? conn.partnerName : conn.inviterName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-card-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 dark:bg-violet-400/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Share Entry</h3>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px]">
                "{journal.title || 'Untitled Entry'}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Security Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs">
            <Shield className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
            <div>
              <p className="font-semibold flex items-center gap-1.5">
                Password-Protected Encryption
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/20 font-bold uppercase">Zero-Knowledge</span>
              </p>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                Set a custom password below. Your reflection will be encrypted with AES-256 before upload. Your partner will unlock it using this password.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Password Setup Form */}
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-hover)] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-violet-500" />
                Set Shared Entry Password <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={entryPassword}
                  onChange={(e) => setEntryPassword(e.target.value)}
                  placeholder="Create custom password"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className={`w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-card)] border text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none transition-colors ${
                    confirmPassword && confirmPassword !== entryPassword
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-[var(--border-color)] focus:border-violet-500'
                  }`}
                />
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              Choose a password to share with your partner (via private message or in person).
            </p>
          </div>

          {/* Partner Selection List */}
          {loading ? (
            <NeuralOrbitLoader size={40} label="Loading partners..." />
          ) : connections.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]">
              <Users className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No Connected Partners Yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Invite a romantic partner or accountability friend from the Collaboration tab to share entries with them.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Select Partner to Share
              </p>
              {connections.map((conn) => {
                const partnerName = partnerDisplayName(conn);
                const isShared = sharedConnections.includes(conn.id);
                const isBusy = actionInProgress === conn.id;

                const roleIcons = {
                  couples: <Heart className="w-3.5 h-3.5 text-rose-500" />,
                  accountability: <Target className="w-3.5 h-3.5 text-blue-500" />,
                  friend: <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                };

                const roleLabels = {
                  couples: 'Couples',
                  accountability: 'Accountability',
                  friend: 'Friend'
                };

                return (
                  <div
                    key={conn.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isShared
                        ? 'border-violet-500/40 bg-violet-500/5 dark:bg-violet-500/10'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[var(--bg-card-hover)] border border-[var(--border-color)] flex items-center justify-center font-bold text-xs text-[var(--text-primary)]">
                        {partnerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {partnerName}
                          </p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-card-hover)] text-[var(--text-muted)] border border-[var(--border-color)]">
                            {roleIcons[conn.role]}
                            {roleLabels[conn.role]}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-faint)] flex items-center gap-1 mt-0.5">
                          <Lock className="w-2.5 h-2.5 text-violet-500" />
                          {isShared ? 'Shared (Password Protected)' : 'Not shared'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleShare(conn)}
                      disabled={isBusy}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isShared
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                          : 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                      } disabled:opacity-50`}
                    >
                      {isBusy ? (
                        <NeuralOrbit size={15} speed="fast" glow={false} />
                      ) : isShared ? (
                        'Revoke Share'
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          Encrypt & Share
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card-hover)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
