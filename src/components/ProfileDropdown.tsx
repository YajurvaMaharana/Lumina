import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  LogOut, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Copy, 
  Check, 
  ChevronDown, 
  Sparkles,
  KeyRound,
  ExternalLink,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { logout } from '../lib/firebase';
import { getPassword, clearPassword } from '../lib/crypto';

interface ProfileDropdownProps {
  onOpenAdmin?: () => void;
  onLockVault?: () => void;
  className?: string;
}

export default function ProfileDropdown({ onOpenAdmin, onLockVault, className = '' }: ProfileDropdownProps) {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isVaultUnlocked = !!getPassword();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Close on Escape key
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  // Extract user initials
  const getInitials = () => {
    if (user.displayName) {
      const parts = user.displayName.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.displayName.slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'LU';
  };

  const displayName = user.displayName || user.email?.split('@')[0] || 'Lumina Member';
  const email = user.email || 'No email registered';

  const handleCopyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email:', err);
    }
  };

  const handleLockVault = () => {
    clearPassword();
    setIsOpen(false);
    if (onLockVault) {
      onLockVault();
    } else {
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    clearPassword();
    setIsOpen(false);
    await logout();
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef} id="profile-dropdown-container">
      {/* Profile Trigger Button */}
      <button
        id="profile-dropdown-trigger"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Open user profile menu"
        className="group flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-all duration-200 cursor-pointer shadow-sm hover:border-violet-500/30"
      >
        {/* Avatar Ring with Status Dot */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white font-semibold text-xs flex items-center justify-center shadow-sm shadow-violet-500/25 ring-2 ring-white/10 group-hover:ring-violet-500/40 transition-all">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={displayName} 
                className="w-full h-full rounded-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{getInitials()}</span>
            )}
          </div>
          {/* Active Vault / Online Status Indicator */}
          <span 
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-primary)] ${
              isVaultUnlocked ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            title={isVaultUnlocked ? "Vault Decrypted & Active" : "Vault Locked"}
          />
        </div>

        {/* User preview label on medium+ screens */}
        <div className="hidden md:flex flex-col text-left pr-1">
          <span className="text-xs font-semibold text-[var(--text-primary)] leading-tight line-clamp-1 max-w-[120px]">
            {displayName}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] leading-none font-medium flex items-center gap-1">
            {isAdmin ? (
              <span className="text-violet-600 dark:text-violet-400 font-bold">Admin</span>
            ) : isVaultUnlocked ? (
              <span className="text-emerald-600 dark:text-emerald-400">Vault Active</span>
            ) : (
              'Standard'
            )}
          </span>
        </div>

        <ChevronDown 
          className={`w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="profile-dropdown-menu"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl border border-[var(--border-color)] bg-white dark:bg-[#0c1017] shadow-2xl z-50 overflow-hidden backdrop-blur-xl divide-y divide-[var(--border-color)]"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="profile-dropdown-trigger"
          >
            {/* Header: User Profile Details */}
            <div className="p-4 bg-gradient-to-b from-violet-500/5 to-transparent">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20 ring-2 ring-violet-500/30">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={displayName} 
                      className="w-full h-full rounded-xl object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{getInitials()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {displayName}
                    </h3>
                    {isAdmin && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5" title={email}>
                    {email}
                  </p>
                  <button
                    onClick={handleCopyEmail}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Email copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy email address</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Security & Vault Status Indicator */}
            <div className="px-4 py-3 bg-[var(--bg-card)]/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)] font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Zero-Knowledge Vault
                </span>
                <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border ${
                  isVaultUnlocked 
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                }`}>
                  {isVaultUnlocked ? 'Active & Decrypted' : 'Encrypted (Locked)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3 text-indigo-400" />
                  Algorithm
                </span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  AES-GCM 256 / PBKDF2
                </span>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="p-2 space-y-0.5">
              {isAdmin && onOpenAdmin && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <ShieldAlert className="w-4 h-4 text-violet-500 shrink-0" />
                  <div className="flex-1">
                    <div>Admin Intelligence Dashboard</div>
                    <div className="text-[10px] font-normal text-[var(--text-muted)]">Platform sentiments & global trends</div>
                  </div>
                </button>
              )}

              <button
                onClick={handleLockVault}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors cursor-pointer text-left"
              >
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <div>Lock Vault Session</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Clear active decryption keys from memory</div>
                </div>
              </button>
            </div>

            {/* Footer / Sign Out Button */}
            <div className="p-2 bg-[var(--bg-card)]/30">
              <button
                id="profile-dropdown-signout"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Lumina</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
