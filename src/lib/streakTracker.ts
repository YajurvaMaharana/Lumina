/**
 * Lumina Daily Streak Engine
 * Calculates, updates, and persists consecutive day-to-day engagement
 * based on both journal entries and daily dashboard activity.
 */

import { Journal } from '../types';

export interface DayActivity {
  dateStr: string; // 'YYYY-MM-DD'
  dayName: string; // 'Mon', 'Tue', etc.
  dayNumber: number; // 1-31
  isToday: boolean;
  isActive: boolean;
  hasJournal: boolean;
  hasLogin: boolean;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  isActiveToday: boolean;
  hasJournaledToday: boolean;
  weeklyActivity: DayActivity[];
  lastActiveDate: string | null;
}

/**
 * Format timestamp or Date into local YYYY-MM-DD
 */
export function toLocalDateString(dateInput: number | Date): string {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD into local Date object
 */
export function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get stored login/visit history from localStorage
 */
export function getStoredLoginDates(userId?: string): string[] {
  if (typeof window === 'undefined') return [];
  const storageKey = `lumina_streak_logins_${userId || 'local_user'}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Record today's visit/engagement in localStorage
 */
export function recordDailyEngagement(userId?: string): void {
  if (typeof window === 'undefined') return;
  const storageKey = `lumina_streak_logins_${userId || 'local_user'}`;
  const todayStr = toLocalDateString(Date.now());
  try {
    const existing = getStoredLoginDates(userId);
    if (!existing.includes(todayStr)) {
      const updated = [...existing, todayStr].sort();
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to persist streak login date:', e);
  }
}

/**
 * Calculate full streak statistics
 */
export function calculateStreakStats(journals: Journal[], userId?: string): StreakStats {
  const today = new Date();
  const todayStr = toLocalDateString(today);
  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayStr = toLocalDateString(yesterday);

  // 1. Gather all journal dates
  const journalDatesSet = new Set<string>();
  journals.forEach(j => {
    if (j.createdAt) {
      journalDatesSet.add(toLocalDateString(j.createdAt));
    }
  });

  // 2. Gather all login/visit dates
  const loginDates = getStoredLoginDates(userId);
  const loginDatesSet = new Set<string>(loginDates);
  // Ensure today is counted as a login date during this active session
  loginDatesSet.add(todayStr);

  // 3. Combined active dates (union of journal dates & login dates)
  const allActiveDatesSet = new Set<string>([...journalDatesSet, ...loginDatesSet]);
  const sortedActiveDates = Array.from(allActiveDatesSet).sort();

  const isActiveToday = allActiveDatesSet.has(todayStr);
  const hasJournaledToday = journalDatesSet.has(todayStr);

  // 4. Calculate current streak
  let currentStreak = 0;
  
  // Decide anchor day for counting backwards
  let checkDate: Date;
  if (isActiveToday) {
    checkDate = new Date(today);
  } else if (allActiveDatesSet.has(yesterdayStr)) {
    // Grace period: unbroken streak from yesterday, waiting for today's action
    checkDate = new Date(yesterday);
  } else {
    // Streak broken or empty
    checkDate = new Date(today);
  }

  // Count consecutive days backward
  while (true) {
    const checkStr = toLocalDateString(checkDate);
    if (allActiveDatesSet.has(checkStr)) {
      currentStreak++;
      // Move 1 day back
      checkDate = new Date(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  // 5. Calculate historical longest streak
  let longestStreak = 0;
  if (sortedActiveDates.length > 0) {
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of sortedActiveDates) {
      const curDate = parseLocalDateString(dStr);
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86400000);
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      prevDate = curDate;
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  // 6. Persist / retrieve best historical streak in localStorage
  const bestKey = `lumina_longest_streak_${userId || 'local_user'}`;
  if (typeof window !== 'undefined') {
    try {
      const savedLongest = parseInt(localStorage.getItem(bestKey) || '0', 10);
      if (longestStreak > savedLongest) {
        localStorage.setItem(bestKey, String(longestStreak));
      } else {
        longestStreak = savedLongest;
      }
    } catch {
      // ignore storage error
    }
  }

  // 7. Generate last 7 days weekly activity breakdown
  const weeklyActivity: DayActivity[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(Date.now() - i * 86400000);
    const dateStr = toLocalDateString(targetDate);
    const dayOfWeek = targetDate.getDay();
    const isThisDay = dateStr === todayStr;
    const hasJ = journalDatesSet.has(dateStr);
    const hasL = loginDatesSet.has(dateStr);

    weeklyActivity.push({
      dateStr,
      dayName: dayNames[dayOfWeek],
      dayNumber: targetDate.getDate(),
      isToday: isThisDay,
      isActive: hasJ || hasL,
      hasJournal: hasJ,
      hasLogin: hasL
    });
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: sortedActiveDates.length,
    isActiveToday,
    hasJournaledToday,
    weeklyActivity,
    lastActiveDate: sortedActiveDates.length > 0 ? sortedActiveDates[sortedActiveDates.length - 1] : null
  };
}
