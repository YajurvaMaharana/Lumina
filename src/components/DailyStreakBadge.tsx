import React, { useState, useEffect, useRef } from 'react';
import { Flame, Trophy, Calendar, CheckCircle2, Circle, Sparkles, ChevronRight } from 'lucide-react';
import { Journal } from '../types';
import { calculateStreakStats, recordDailyEngagement, StreakStats } from '../lib/streakTracker';

interface DailyStreakBadgeProps {
  journals: Journal[];
  userId?: string;
  onOpenNewEntry?: () => void;
}

export default function DailyStreakBadge({ journals, userId, onOpenNewEntry }: DailyStreakBadgeProps) {
  const [stats, setStats] = useState<StreakStats>(() => calculateStreakStats(journals, userId));
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recalculate on mount and when journals change, and record today's engagement
  useEffect(() => {
    recordDailyEngagement(userId);
    const updated = calculateStreakStats(journals, userId);
    setStats(updated);
  }, [journals, userId]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
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

  const hasStreak = stats.currentStreak > 0;

  return (
    <div className="relative" ref={containerRef}>
      {/* Header Badge Button */}
      <button
        type="button"
        id="daily-streak-badge-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition-all duration-200 cursor-pointer select-none shadow-sm ${
          hasStreak
            ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:border-amber-500/50'
            : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border-[var(--border-color)] text-[var(--text-muted)]'
        }`}
        title={`Daily Engagement Streak: ${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`}
        aria-label="Daily Streak Status"
      >
        {/* Animated Flame Icon */}
        <div className="relative flex items-center justify-center">
          <Flame
            className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-300 group-hover:scale-110 ${
              hasStreak
                ? 'text-amber-500 fill-amber-500/30 dark:fill-amber-400/30 animate-flame drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          />
          {stats.isActiveToday && hasStreak && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#05070A]" />
          )}
        </div>

        {/* Counter */}
        <span className="font-mono font-bold text-xs sm:text-sm tracking-tight text-slate-800 dark:text-white">
          {stats.currentStreak}
        </span>

        {/* Optional text label on medium+ viewports */}
        <span className="hidden xl:inline text-[11px] font-medium text-[var(--text-muted)] lowercase">
          {stats.currentStreak === 1 ? 'day' : 'days'}
        </span>
      </button>

      {/* Click-away backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/35 dark:bg-black/65 backdrop-blur-[2px] transition-opacity duration-200 cursor-default"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Interactive Streak Popover */}
      {isOpen && (
        <div
          id="daily-streak-popover"
          role="dialog"
          aria-modal="true"
          aria-label="Daily Cognitive Streak Details"
          className="absolute right-0 top-full mt-5 w-[calc(100vw-2rem)] sm:w-88 max-w-sm rounded-2xl border border-slate-300 dark:border-slate-800/90 shadow-2xl p-4 sm:p-5 z-50 animate-scale-up bg-white dark:bg-slate-950 backdrop-blur-3xl ring-1 ring-black/10 dark:ring-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Flame className="w-4.5 h-4.5 fill-white/30" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Daily Cognitive Streak
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Consecutive days of mindful journaling
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
              {stats.currentStreak} Day{stats.currentStreak === 1 ? '' : 's'}
            </span>
          </div>

          {/* Main Streak Counter Card */}
          <div className="my-4 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-500/25 text-center relative overflow-hidden shadow-inner">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Flame className="w-6 h-6 text-amber-500 fill-amber-500/40 animate-flame" />
              <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                {stats.currentStreak}
              </span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Day{stats.currentStreak === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {stats.hasJournaledToday
                ? '🔥 Reflection recorded today! Streak actively protected.'
                : stats.isActiveToday
                ? '✨ Dashboard active today! Write an entry to keep the flame blazing.'
                : 'Log in and journal daily to maintain your streak.'}
            </p>
          </div>

          {/* 7-Day Activity Week Tracker */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-violet-500" />
                Past 7 Days
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {stats.weeklyActivity.filter(d => d.isActive).length} / 7 Active
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {stats.weeklyActivity.map((day) => {
                return (
                  <div
                    key={day.dateStr}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all ${
                      day.isToday
                        ? 'ring-2 ring-amber-500/50 border-amber-500/40 bg-amber-500/10'
                        : day.hasJournal
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : day.isActive
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                        : 'border-slate-200 dark:border-slate-800/80 bg-slate-100/90 dark:bg-slate-900/95 text-[var(--text-muted)] opacity-75'
                    }`}
                    title={`${day.dateStr}: ${day.hasJournal ? 'Journaled' : day.isActive ? 'Active Login' : 'No activity'}`}
                  >
                    <span className="text-[10px] font-semibold mb-1">
                      {day.dayName}
                    </span>
                    {day.hasJournal ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : day.isActive ? (
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                    )}
                    <span className="text-[9px] font-mono mt-0.5 opacity-75">
                      {day.dayNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800/80 shadow-sm">
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase">Best Streak</p>
                <p className="font-bold text-[var(--text-primary)] font-mono">{stats.longestStreak} Days</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800/80 shadow-sm">
              <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase">Total Active</p>
                <p className="font-bold text-[var(--text-primary)] font-mono">{stats.totalActiveDays} Days</p>
              </div>
            </div>
          </div>

          {/* Quick Action If Today's Reflection Not Yet Written */}
          {!stats.hasJournaledToday && onOpenNewEntry && (
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenNewEntry();
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-xs shadow-md shadow-amber-500/20 hover:brightness-105 transition-all cursor-pointer"
            >
              <span>Write Today's Reflection</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
