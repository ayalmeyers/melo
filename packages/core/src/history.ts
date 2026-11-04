/**
 * Reads listening-history exports and boils them down to albums, artists and podcasts.
 * Spotify: Extended Streaming History (Streaming_History_Audio_*.json, has albums) and Account Data
 *   (StreamingHistory_music_*.json and StreamingHistory_podcast_*.json, no albums).
 * Apple Music: the Play Activity / Play History CSVs from privacy.apple.com (column names vary by year, so columns are found by name).
 */
export type HistorySource = 'spotify' | 'apple';
export interface HistAlbum { title: string; artist: string; plays: number; ms: number; last: string }
export interface HistArtist { name: string; plays: number; ms: number }
export interface HistShow { title: string; plays: number; ms: number; last: string }
export interface History { source: HistorySource; albums: HistAlbum[]; artists: HistArtist[]; shows: HistShow[]; plays: number; from: string | null; to: string | null }

/** A listen shorter than this doesn't count (Spotify and Apple both use 30 seconds for a "stream"). */
export const MIN_MS = 30_000;

interface Play { album?: string; artist?: string; show?: string; ms: number | null; at: string | null }

const iso = (v: unknown): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  let s = String(v).trim();
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) s = s.replace(' ', 'T') + ':00Z';
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const num = (v: unknown) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Minimal CSV reader that handles quoted fields with commas, quotes and newlines. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(x => x.trim()));
  if (!head) return [];
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

function fromSpotify(rows: Record<string, unknown>[]): Play[] {
  return rows.map(r => {
    if ('master_metadata_album_album_name' in r || 'episode_show_name' in r) {
      return { album: str(r.master_metadata_album_album_name), artist: str(r.master_metadata_album_artist_name), show: str(r.episode_show_name), ms: num(r.ms_played), at: iso(r.ts) };
    }
    if ('podcastName' in r) return { show: str(r.podcastName), ms: num(r.msPlayed), at: iso(r.endTime) };
    return { artist: str(r.artistName), ms: num(r.msPlayed), at: iso(r.endTime) };
  });
}

function fromAppleCsv(rows: Record<string, string>[]): Play[] {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const find = (...res: RegExp[]) => { for (const re of res) { const c = cols.find(k => re.test(k)); if (c) return c; } return undefined; };
  const album = find(/^album name$/i, /album/i);
  const artist = find(/^artist name$/i, /container artist/i, /^artist/i, /artist/i);
  const desc = find(/track description/i);
  const time = find(/event start timestamp/i, /date played/i, /timestamp/i, /date/i);
  const ms = find(/play duration milliseconds/i, /duration.*ms|milliseconds/i);
  const count = find(/^play count$/i);
  const media = find(/media type/i);
  const out: Play[] = [];
  for (const r of rows) {
    if (media && /video/i.test(r[media] ?? '')) continue;
    let a = artist ? str(r[artist]) : undefined;
    if (!a && desc) a = str((r[desc] ?? '').split(' - ')[0]);
    const n = count ? Math.max(1, Math.min(1000, num(r[count]) ?? 1)) : 1;
    const dur = ms ? num(r[ms]) : null;
    for (let i = 0; i < n; i++) out.push({ album: album ? str(r[album]) : undefined, artist: a, ms: dur != null ? dur / n : null, at: time ? iso(r[time]) : null });
  }
  return out;
}

/** Reads one export file (JSON or CSV text). Unknown files return null. */
export function parseHistoryFile(name: string, text: string): { source: HistorySource; plays: Play[] } | null {
  const n = name.toLowerCase();
  if (n.endsWith('.json')) {
    let json: unknown; try { json = JSON.parse(text); } catch { return null; }
    if (!Array.isArray(json) || !json.length || typeof json[0] !== 'object') return null;
    const k = json[0] as Record<string, unknown>;
    if (!('ms_played' in k) && !('msPlayed' in k)) return null;
    return { source: 'spotify', plays: fromSpotify(json as Record<string, unknown>[]) };
  }
  if (n.endsWith('.csv')) {
    const rows = parseCsv(text);
    if (!rows.length) return null;
    const cols = Object.keys(rows[0]).join(' ').toLowerCase();
    if (!/(album|artist|track|song)/.test(cols)) return null;
    return { source: 'apple', plays: fromAppleCsv(rows) };
  }
  return null;
}

/** Totals plays per album, artist and podcast. A play counts at 30 seconds or more (or when the export has no duration). */
export function summarize(source: HistorySource, plays: Play[]): History {
  const albums = new Map<string, HistAlbum>(), artists = new Map<string, HistArtist>(), shows = new Map<string, HistShow>();
  let total = 0, from: string | null = null, to: string | null = null;
  for (const p of plays) {
    if (p.ms != null && p.ms < MIN_MS) continue;
    const ms = p.ms ?? 180_000, at = p.at ?? '';
    total++;
    if (at) { if (!from || at < from) from = at; if (!to || at > to) to = at; }
    if (p.show) { const s = shows.get(p.show) ?? { title: p.show, plays: 0, ms: 0, last: '' }; s.plays++; s.ms += ms; if (at > s.last) s.last = at; shows.set(p.show, s); continue; }
    if (p.artist) { const a = artists.get(p.artist.toLowerCase()) ?? { name: p.artist, plays: 0, ms: 0 }; a.plays++; a.ms += ms; artists.set(p.artist.toLowerCase(), a); }
    if (p.album && p.artist) {
      const k = `${p.artist.toLowerCase()}\u0000${p.album.toLowerCase()}`;
      const a = albums.get(k) ?? { title: p.album, artist: p.artist, plays: 0, ms: 0, last: '' }; a.plays++; a.ms += ms; if (at > a.last) a.last = at; albums.set(k, a);
    }
  }
  const byMs = <T extends { ms: number }>(m: Map<string, T>) => [...m.values()].sort((a, b) => b.ms - a.ms);
  return { source, albums: byMs(albums), artists: byMs(artists), shows: byMs(shows), plays: total, from, to };
}

/** Reads several files from one export and merges them. */
export function readHistory(files: { name: string; text: string }[]): History | null {
  let source: HistorySource | null = null; const plays: Play[] = [];
  for (const f of files) { const r = parseHistoryFile(f.name, f.text); if (r) { source ??= r.source; plays.push(...r.plays); } }
  return source ? summarize(source, plays) : null;
}
