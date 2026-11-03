import { CNAME, FLAG } from './catalog-data.js';

export function ago(iso: string | number | Date, now: number = Date.now()): string {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const h = (now - t) / 36e5;
  if (h < 1 / 60) return 'now';
  if (h < 1) return Math.max(1, Math.round(h * 60)) + 'm';
  if (h < 24) return Math.round(h) + 'h';
  const d = Math.round(h / 24);
  return d < 7 ? d + 'd' : d < 60 ? Math.round(d / 7) + 'w' : new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}

/** Parses "1:02:03", "62:03" or "75" into seconds. Returns null when it can't. */
export function parseTimestamp(s: string): number | null {
  const parts = s.trim().split(':');
  if (!parts.length || parts.some(p => !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

/** Ratings are stored 1..10 (half stars). */
export const starsText = (r10: number) => (r10 / 2).toFixed(1).replace('.0', '');
export const flag = (cc: string) => FLAG[cc] ?? '';
export const countryName = (cc: string) => CNAME[cc] ?? cc;
export const compact = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
export const LIMITS = { take: 280, review: 4000, thread: 6000, threadTitle: 140, comment: 2000, message: 2000, moment: 500, question: 200, detail: 1000, bio: 160 } as const;
