import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  FileCode,
  Download,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  Layers,
  Check
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Journal, TradeRecord } from '../types';
import { getTrades } from '../lib/db';
import { getPassword } from '../lib/crypto';
import {
  ExportFormat,
  DateRangePreset,
  ContentScope,
  ExportOptions,
  filterExportData,
  decryptJournalsForExport,
  generateAuditTrailPDF,
  generateAuditTrailMarkdown,
  generateAuditTrailJSON
} from '../lib/exportEngine';

interface ExportAuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  journals: Journal[];
}

export default function ExportAuditTrailModal({
  isOpen,
  onClose,
  journals
}: ExportAuditTrailModalProps) {
  const { user } = useAuth();

  // Configuration options
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [dateRange, setDateRange] = useState<DateRangePreset>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [contentScope, setContentScope] = useState<ContentScope>('all');

  // Trade data
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  // Decryption passphrase state
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  // Progress & Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [exportSuccess, setExportSuccess] = useState(false);

  // Check if session vault is already unlocked
  const isVaultAlreadyUnlocked = !!getPassword();

  useEffect(() => {
    if (isOpen && user) {
      loadUserTrades();
      setPassphraseError(null);
      setExportSuccess(false);
      setExportProgress(0);
    }
  }, [isOpen, user]);

  const loadUserTrades = async () => {
    if (!user) return;
    setLoadingTrades(true);
    try {
      const data = await getTrades(user.uid);
      setTrades(data || []);
    } catch (err) {
      console.error('Failed to load trades for export:', err);
    } finally {
      setLoadingTrades(false);
    }
  };

  if (!isOpen) return null;

  // Compute live preview of filtered data
  const currentOptions: ExportOptions = {
    format,
    dateRange,
    customStartDate,
    customEndDate,
    contentScope,
    passphrase
  };

  const preview = filterExportData(journals, trades, currentOptions);
  const requiresPassphrase = preview.hasEncryptedEntries && !isVaultAlreadyUnlocked;

  const handleStartExport = async () => {
    setIsExporting(true);
    setPassphraseError(null);
    setExportSuccess(false);
    setExportProgress(10);
    setExportStatus('Filtering audit trail records...');

    try {
      // 1. Filter dataset
      let filtered = filterExportData(journals, trades, currentOptions);
      await new Promise(r => setTimeout(r, 200));

      // 2. Decrypt protected entries if necessary
      if (filtered.hasEncryptedEntries) {
        setExportProgress(30);
        setExportStatus('Decrypting protected journal entries...');

        const decryptResult = await decryptJournalsForExport(
          filtered.journals,
          passphrase.trim() || undefined
        );

        if (!decryptResult.success) {
          setPassphraseError(decryptResult.error || 'Incorrect passphrase. Could not decrypt entries.');
          setIsExporting(false);
          return;
        }

        filtered = {
          ...filtered,
          journals: decryptResult.decryptedJournals
        };
      }

      setExportProgress(60);
      setExportStatus(`Compiling ${format.toUpperCase()} export bundle...`);
      await new Promise(r => setTimeout(r, 200));

      const userMetadata = {
        name: user?.displayName || '',
        email: user?.email || ''
      };

      // 3. Generate selected format
      if (format === 'pdf') {
        await generateAuditTrailPDF(filtered, userMetadata, (pct, msg) => {
          setExportProgress(pct);
          setExportStatus(msg);
        });
      } else if (format === 'markdown') {
        await generateAuditTrailMarkdown(filtered, userMetadata, (pct, msg) => {
          setExportProgress(pct);
          setExportStatus(msg);
        });
      } else if (format === 'json') {
        await generateAuditTrailJSON(filtered, userMetadata, (pct, msg) => {
          setExportProgress(pct);
          setExportStatus(msg);
        });
      }

      setExportProgress(100);
      setExportStatus('Export complete! Check your downloads.');
      setExportSuccess(true);
    } catch (err: any) {
      console.error('Export failed:', err);
      setPassphraseError(err?.message || 'Failed to generate export file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-xl glass rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl overflow-hidden my-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[var(--bg-card-hover)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-600/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                Export Audit Trail & Review
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  Backup
                </span>
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Generate verified review reports and backups for trading and journal logs.
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

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Format Selection Cards */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              1. Choose Export Format
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  id: 'pdf',
                  name: 'PDF Report',
                  desc: 'Formatted review & tax report',
                  icon: FileText,
                  badge: 'Recommended'
                },
                {
                  id: 'markdown',
                  name: 'Markdown',
                  desc: 'Editable GFM text archive',
                  icon: FileCode,
                  badge: '.md'
                },
                {
                  id: 'json',
                  name: 'Full JSON',
                  desc: 'Machine-readable schema',
                  icon: Layers,
                  badge: '.json'
                }
              ].map(f => {
                const isSelected = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id as ExportFormat)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/10 shadow-sm'
                        : 'border-[var(--border-color)] bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <f.icon className={`w-4 h-4 ${isSelected ? 'text-violet-500' : 'text-[var(--text-muted)]'}`} />
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]">
                        {f.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">{f.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              2. Date Range Filter
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: '90d', label: '90 Days' },
                { id: 'ytd', label: 'YTD' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' }
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDateRange(r.id as DateRangePreset)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    dateRange === r.id
                      ? 'border-violet-500 bg-violet-600 text-white shadow-sm'
                      : 'border-[var(--border-color)] bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-2.5 mt-2.5 p-3 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] animate-fade-in">
                <div>
                  <label className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Content Scope Selector */}
          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              3. Content Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'Complete Audit', desc: 'Journals + Trading Logs' },
                { id: 'journals_only', label: 'Journals & AI', desc: 'Reflections & Insights only' },
                { id: 'trades_only', label: 'Trading Log', desc: 'PnL & execution history' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setContentScope(s.id as ContentScope)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    contentScope === s.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-[var(--border-color)] bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card)]'
                  }`}
                >
                  <p className="text-xs font-bold text-[var(--text-primary)]">{s.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Decryption Passphrase Section (if encrypted entries exist) */}
          {preview.hasEncryptedEntries && (
            <div className="p-3.5 rounded-xl bg-[var(--bg-card-hover)] border border-[var(--border-color)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Encrypted Entries Detected
                  </span>
                </div>
                {isVaultAlreadyUnlocked && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Vault Unlocked
                  </span>
                )}
              </div>

              <p className="text-[11px] text-[var(--text-muted)]">
                {isVaultAlreadyUnlocked
                  ? 'Your vault is currently unlocked for this session. Entries will be decrypted locally before compiling.'
                  : 'Enter your vault password to decrypt protected reflections into the export file. Your plaintext data never leaves your device.'}
              </p>

              {(!isVaultAlreadyUnlocked || passphrase) && (
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => {
                      setPassphrase(e.target.value);
                      if (passphraseError) setPassphraseError(null);
                    }}
                    placeholder="Enter vault passphrase to decrypt..."
                    className="w-full px-3 py-2 pr-9 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Live Data Summary Card */}
          <div className="p-3.5 rounded-xl bg-violet-500/5 border border-violet-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[var(--text-secondary)]">
                Audit Scope Summary: <strong className="text-[var(--text-primary)]">{preview.journals.length} Journals</strong> & <strong className="text-[var(--text-primary)]">{preview.trades.length} Trades</strong>
              </span>
            </div>
            {contentScope !== 'journals_only' && preview.trades.length > 0 && (
              <span className={`font-mono font-bold ${preview.totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {preview.totalPnL >= 0 ? '+' : ''}${preview.totalPnL.toFixed(2)} PnL
              </span>
            )}
          </div>

          {/* Errors */}
          {passphraseError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passphraseError}</span>
            </div>
          )}

          {/* Export Progress Bar */}
          {isExporting && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                  {exportStatus}
                </span>
                <span className="font-bold text-violet-600 dark:text-violet-400">
                  {exportProgress}%
                </span>
              </div>
              <div className="w-full bg-[var(--bg-card-hover)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
                <div
                  className="bg-gradient-to-r from-violet-600 to-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner */}
          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Audit trail generated successfully! File has been downloaded to your device.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card-hover)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Client-Side Rendered
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-card)] rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleStartExport}
              disabled={isExporting || (preview.journals.length === 0 && preview.trades.length === 0)}
              className="px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {isExporting ? 'Generating...' : `Export ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
