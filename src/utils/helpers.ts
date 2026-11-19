import type { Language } from '../types/health';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(baseISO: string, offset: number): string {
  const dt = new Date(baseISO + 'T00:00:00');
  dt.setDate(dt.getDate() + offset);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDates(startISO?: string): string[] {
  const start = startISO || getTodayISO();
  return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
}

export function formatShortDate(dateISO: string, lang: Language): string {
  const dt = new Date(dateISO + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return dateISO;
  return dt.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatLongDate(lang: Language): string {
  return new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getTimeGreeting(lang: Language): string {
  const hour = new Date().getHours();
  if (lang === 'ta') {
    if (hour < 12) return 'காலை வணக்கம்';
    if (hour < 17) return 'மதிய வணக்கம்';
    return 'மாலை வணக்கம்';
  }
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function generateSecureId(prefix = 'id'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) {
      token += chars[arr[i] % chars.length];
    }
  } else {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return `${prefix}_${token}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const arr = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) {
      suffix += chars[arr[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `RM${suffix}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
