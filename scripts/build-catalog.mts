/**
 * Builds Melo's starting catalog with real artwork. Runs on GitHub Actions (see .github/workflows/catalog.yml).
 *
 *  1. Every hand-picked album and podcast in catalog-data.js is matched to Apple's catalog for its cover, link and release date.
 *  2. Apple's current most-played album charts in 14 countries and its top podcast charts are added on top,
 *     so Melo opens with hundreds of real records instead of a few dozen.
 *  3. Every artist gets a photo from Wikimedia Commons (with credit). Artists with no free photo fall back to their newest cover.
 *
 * Writes packages/core/src/catalog-art.js (imported by the apps and the seed generator) and catalog-report.md (what matched and what didn't).
 * usage: npx tsx scripts/build-catalog.mts
 */
import { writeFileSync } from 'node:fs';
import { ALBUMS, ARTISTS, SHOWS } from '../packages/core/src/catalog-data.js';
import { appleArt, appleSearchUrl, parseApple, type AppleResult } from '../packages/core/src/apple';
import { findArtistPhoto, type ArtistPhoto } from '../packages/core/src/images';

const UA = 'MeloCatalogBuilder/1.0 (https://github.com/ayalmeyers/melo)';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function getJson(url: string, headers: Record<string, string> = {}, tries = 3): Promise<unknown> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
      if (r.status === 429 || r.status === 403) { await wait(20000 * (i + 1)); continue; }
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await wait(3000); }
  }
  throw new Error('gave up ' + url);
}
// Apple's search API allows about 20 calls a minute.
let lastApple = 0;
async function apple(url: string): Promise<AppleResult[]> {
  const gap = 3300 - (Date.now() - lastApple); if (gap > 0) await wait(gap);
  lastApple = Date.now();
  try { return parseApple(await getJson(url)); } catch (e) { console.warn('apple failed', url, String(e)); return []; }
}
// Wikimedia: one request at a time, at most ~1.5 a second, honoring Retry-After. Every response is counted for the report.
const wikiStats = new Map<string, number>();
let lastWiki = 0;
async function wiki(url: string): Promise<unknown> {
  const host = new URL(url).host;
  for (let i = 0; i < 5; i++) {
    const gap = 650 - (Date.now() - lastWiki); if (gap > 0) await wait(gap);
    lastWiki = Date.now();
    let r: Response;
    try { r = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } }); }
    catch (e) { wikiStats.set(`${host} network`, (wikiStats.get(`${host} network`) ?? 0) + 1); await wait(5000); continue; }
    wikiStats.set(`${host} ${r.status}`, (wikiStats.get(`${host} ${r.status}`) ?? 0) + 1);
    if (r.status === 429 || r.status === 503 || r.status === 403) { await wait((Number(r.headers.get('retry-after')) || 30) * 1000); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error('wikimedia gave up ' + url);
}

const MELO_GENRE: [RegExp, string][] = [
  [/k-pop/i, 'kpop'], [/j-pop|anime|j-rock|vocaloid/i, 'jpop'], [/country|americana|bluegrass/i, 'country'], [/soundtrack|musicals?|original score|cast recording/i, 'soundtrack'],
  [/hip-hop|rap/i, 'hiphop'], [/r&b|soul/i, 'rnb'], [/afro/i, 'afro'], [/latin|reggaeton|urbano|salsa|bachata|regional mexicano|música mexicana|corrido/i, 'latin'],
  [/city pop/i, 'citypop'], [/brazil|mpb|bossa|samba|sertanejo|funk brasileiro|pagode/i, 'brazil'], [/alternative|indie/i, 'indie'],
  [/rock|metal|punk/i, 'rock'], [/electronic|dance|house|techno/i, 'electronic'], [/jazz/i, 'jazz'], [/pop|k-pop/i, 'pop'], [/world|african/i, 'afro'],
];
const unmapped = new Map<string, number>();
const meloGenre = (names: string[]) => {
  for (const n of names) for (const [re, g] of MELO_GENRE) if (re.test(n)) return g;
  const key = names.filter(n => n !== 'Music').join(' / ') || '(none)'; unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
  return null;
};
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export interface ItemArt { apple_id: number; artwork_url: string; apple_url?: string; release_date?: string; track_count?: number }
export interface ArtistArt { apple_id?: number; image_url?: string; image_credit?: string; image_source?: string; artwork_url?: string }
export interface ExtraAlbum { id: string; title: string; artist_id: string; artist_name: string; artist_apple_id?: number; year: number | null; genre: string | null; art: ItemArt; charts: string[] }
export interface ExtraShow { id: string; title: string; host: string; art: ItemArt; charts: string[] }
export interface ExtraArtist { id: string; name: string; apple_id: number; genres: string[] }

const report: string[] = ['# Catalog build report', '', `Built ${new Date().toISOString()}`, ''];
const items: Record<string, ItemArt> = {};
const artists: Record<string, ArtistArt> = {};
const misses: string[] = [];
const toArt = (r: AppleResult): ItemArt => ({ apple_id: r.apple_id, artwork_url: appleArt(r.artwork, 600)!, apple_url: r.url, release_date: r.release_date?.slice(0, 10), track_count: r.track_count });

/* 1. Hand-picked albums and podcasts.
   First a plain search in the US store and the artist's home store; if that misses, find the artist on Apple
   and look through their whole discography, which catches records the search ranks below singles and remixes. */
const STORES = new Set(['US', 'GB', 'NG', 'JP', 'ES', 'KR', 'FR', 'BR', 'PK', 'CO', 'MX', 'DE', 'CA', 'GH', 'ZA', 'IN', 'JM', 'AU', 'IE', 'SE']);
const EDITION = /\s*(?:[([](?:[^)\]]*?)(?:deluxe|explicit|clean|remaster(?:ed)?|anniversary|expanded|edition|version)[^)\]]*[)\]]|\s[-–]\s.*(?:deluxe|remaster(?:ed)?|anniversary|expanded|edition|version).*)$/i;
const plain = (t: string) => norm(t.replace(EDITION, ''));
// A different record that happens to share the name: instrumentals, remixes, live sets, karaoke.
const OTHER = /instrumental|remix|acapella|a cappella|karaoke|live (at|from|in)|\blive\b|commentary|tribute|reimagined|sped up|slowed/i;
function pick(hits: AppleResult[], title: string, artist: string): AppleResult | null {
  const t = norm(title), a = norm(artist);
  const mine = hits.filter(h => h.kind === 'album' && (norm(h.artist) === a || norm(h.artist).includes(a) || a.includes(norm(h.artist))) && (OTHER.test(title) || !OTHER.test(h.title)));
  const exact = mine.filter(h => norm(h.title) === t);
  const loose = mine.filter(h => plain(h.title) === t || plain(h.title) === plain(title));
  // Prefer the standard edition (fewest extras in the title), then the earliest release.
  const best = (xs: AppleResult[]) => xs.sort((x, y) => x.title.length - y.title.length || (x.release_date ?? '').localeCompare(y.release_date ?? ''))[0] ?? null;
  return best(exact) ?? best(loose);
}
const artistAppleIds = new Map<string, number>();
async function appleArtistId(name: string, cc: string): Promise<number | null> {
  if (artistAppleIds.has(name)) return artistAppleIds.get(name)!;
  for (const store of [...new Set(['US', cc])].filter(c => STORES.has(c))) {
    const j = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(name).replace(/%20/g, '+')}&entity=musicArtist&media=music&limit=10&country=${store}`).catch(() => null) as { results?: { artistName: string; artistId: number }[] } | null;
    lastApple = Date.now();
    const hit = j?.results?.find(r => norm(r.artistName) === norm(name)); if (hit) { artistAppleIds.set(name, hit.artistId); return hit.artistId; }
    await wait(3300);
  }
  return null;
}
const candidates: Record<string, string[]> = {};
for (const row of ALBUMS) {
  const [id, title, aid] = row as [string, string, string];
  const a = ARTISTS[aid as keyof typeof ARTISTS];
  let m: AppleResult | null = null;
  for (const cc of [...new Set(['US', a.cc])].filter(c => STORES.has(c))) {
    const hits = await apple(appleSearchUrl(`${title} ${a.name}`, 'album', 25, cc));
    candidates[id] = hits.slice(0, 8).map(h => `${h.title} — ${h.artist}`);
    m = pick(hits, title, a.name);
    if (m) break;
  }
  if (!m) {
    const artistId = await appleArtistId(a.name, a.cc);
    if (artistId) {
      for (const cc of [...new Set(['US', a.cc])].filter(c => STORES.has(c))) {
        const disco = await apple(`https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200&country=${cc}`);
        candidates[id] = disco.slice(0, 12).map(h => `${h.title} (${h.release_date?.slice(0, 4)})`);
        m = pick(disco.map(d => ({ ...d, artist: d.artist || a.name })), title, a.name);
        if (m) break;
      }
    }
  }
  if (m?.artwork) {
    items[id] = toArt(m);
    if (m.artist_apple_id && !artists[aid]?.apple_id) artists[aid] = { ...artists[aid], apple_id: m.artist_apple_id };
    report.push(`- album ${id}: ${m.title} — ${m.artist} (${m.apple_id})`);
  } else { misses.push(`album ${id} (${title} — ${a.name}); Apple offered: ${(candidates[id] ?? []).join(' | ') || 'nothing'}`); }
}
for (const [id, title, host] of SHOWS as [string, string, string, string, string][]) {
  const hits = await apple(appleSearchUrl(title, 'show', 10));
  const m = hits.find(h => norm(h.title) === norm(title)) ?? hits.find(h => norm(h.title).startsWith(norm(title)) && norm(h.artist).includes(norm(host.split(/[,&]/)[0])));
  if (m?.artwork) { items[id] = toArt(m); report.push(`- show ${id}: ${m.title} (${m.apple_id})`); } else misses.push(`show ${id} (${title})`);
}

/* 2. Apple's charts. Each country's 50 most-played albums, plus top podcasts in the US and UK. */
type RssItem = { id: string; name: string; artistName: string; artistId?: string; releaseDate?: string; artworkUrl100: string; url: string; genres?: { name: string }[]; kind: string };
async function rss(cc: string, kind: 'music/most-played/50/albums' | 'podcasts/top/50/podcasts'): Promise<RssItem[]> {
  for (const host of ['rss.marketingtools.apple.com', 'rss.applemarketingtools.com']) {
    try { const j = await getJson(`https://${host}/api/v2/${cc}/${kind}.json`) as { feed?: { results?: RssItem[] } }; if (j.feed?.results?.length) return j.feed.results; } catch { /* next host */ }
  }
  console.warn('no chart', cc, kind); return [];
}
const CHART_COUNTRIES = ['us', 'gb', 'ng', 'br', 'jp', 'kr', 'mx', 'fr', 'za', 'in', 'es', 'co', 'de', 'ca'];
const seededAppleIds = new Set(Object.values(items).map(i => i.apple_id));
const seededArtistByApple = new Map<number, string>(); for (const [k, v] of Object.entries(artists)) if (v.apple_id) seededArtistByApple.set(v.apple_id, k);
const seededArtistByName = new Map<string, string>(Object.entries(ARTISTS).map(([k, v]) => [norm(v.name), k]));
const seededTitles = new Set((ALBUMS as [string, string, string][]).map(([, t, aid]) => norm(t) + '|' + norm(ARTISTS[aid as keyof typeof ARTISTS].name)));
const extraAlbums = new Map<string, ExtraAlbum>();
const extraArtists = new Map<string, ExtraArtist>();
for (const cc of CHART_COUNTRIES) {
  const rows = await rss(cc, 'music/most-played/50/albums');
  report.push('', `## ${cc.toUpperCase()} albums chart: ${rows.length}`);
  for (const r of rows) {
    const appleId = Number(r.id); const artistApple = r.artistId ? Number(r.artistId) : undefined;
    if (!appleId || seededAppleIds.has(appleId) || / - (Single|EP)$/.test(r.name)) continue;
    if (seededTitles.has(norm(r.name) + '|' + norm(r.artistName))) continue;
    const key = 'am' + appleId;
    const prev = extraAlbums.get(key); if (prev) { prev.charts.push(cc); continue; }
    // Collaborations ("A & B") stay under the credited name; known artists resolve to their existing page.
    const artistId = (artistApple && seededArtistByApple.get(artistApple)) ?? seededArtistByName.get(norm(r.artistName)) ?? (artistApple ? 'ar' + artistApple : null);
    if (!artistId) continue;
    const genre = meloGenre((r.genres ?? []).map(g => g.name));
    if (artistId.startsWith('ar') && artistApple && !extraArtists.has(artistId)) extraArtists.set(artistId, { id: artistId, name: r.artistName, apple_id: artistApple, genres: genre ? [genre] : [] });
    extraAlbums.set(key, { id: key, title: r.name, artist_id: artistId, artist_name: r.artistName, artist_apple_id: artistApple, year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null, genre,
      art: { apple_id: appleId, artwork_url: appleArt(r.artworkUrl100, 600)!, apple_url: r.url, release_date: r.releaseDate?.slice(0, 10) }, charts: [cc] });
  }
}
const extraShows = new Map<string, ExtraShow>();
const seededShowTitles = new Set((SHOWS as string[][]).map(s => norm(s[1])));
for (const cc of ['us', 'gb']) {
  for (const r of await rss(cc, 'podcasts/top/50/podcasts')) {
    const appleId = Number(r.id); if (!appleId || seededAppleIds.has(appleId) || seededShowTitles.has(norm(r.name))) continue;
    const key = 'pc' + appleId; const prev = extraShows.get(key); if (prev) { prev.charts.push(cc); continue; }
    extraShows.set(key, { id: key, title: r.name, host: r.artistName, art: { apple_id: appleId, artwork_url: appleArt(r.artworkUrl100, 600)!, apple_url: r.url, release_date: r.releaseDate?.slice(0, 10) }, charts: [cc] });
  }
}
// An artist's newest cover is the fallback picture when there is no free photo.
const newestCover = new Map<string, { date: string; url: string }>();
const noteCover = (artistId: string, date: string | undefined, url: string) => { const p = newestCover.get(artistId); if (!p || (date ?? '') > p.date) newestCover.set(artistId, { date: date ?? '', url }); };
for (const row of ALBUMS as [string, string, string][]) if (items[row[0]]) noteCover(row[2], items[row[0]].release_date, items[row[0]].artwork_url);
for (const a of extraAlbums.values()) noteCover(a.artist_id, a.art.release_date, a.art.artwork_url);

/* 3. Artist photos from Wikimedia Commons. */
const photoFor = (name: string): Promise<ArtistPhoto | null> => findArtistPhoto(name, wiki);
let photos = 0;
const allArtists: [string, string][] = [...Object.entries(ARTISTS).map(([k, v]) => [k, v.name] as [string, string]), ...[...extraArtists.values()].map(a => [a.id, a.name] as [string, string])];
for (const [id, name] of allArtists) {
  // Skip credits that are several people at once; their newest cover stands in.
  const p = /,| & | x | feat\.| and the /i.test(name) && !ARTISTS[id as keyof typeof ARTISTS] ? null : await photoFor(name);
  const cover = newestCover.get(id)?.url;
  artists[id] = { ...artists[id], ...(p ? { image_url: p.url, image_credit: p.credit, image_source: p.source } : {}), ...(cover ? { artwork_url: cover } : {}) };
  if (extraArtists.has(id)) artists[id].apple_id = extraArtists.get(id)!.apple_id;
  if (p) photos++; else report.push(`- no free photo: ${name}${cover ? ' (using newest cover)' : ''}`);
}

if (Object.keys(items).length < (ALBUMS.length + SHOWS.length) * 0.8) { console.error('Too many misses; not trusting this build.\n' + misses.join('\n')); process.exit(1); }
const out = {
  built: new Date().toISOString().slice(0, 10),
  items, artists,
  extraAlbums: [...extraAlbums.values()].sort((a, b) => b.charts.length - a.charts.length),
  extraShows: [...extraShows.values()],
  extraArtists: [...extraArtists.values()],
};
writeFileSync(new URL('../packages/core/src/catalog-art.js', import.meta.url),
  `/* Generated by scripts/build-catalog.mts on ${out.built}. Real artwork for the starting catalog. Do not edit by hand. */\n` +
  `export const CATALOG_ART = ${JSON.stringify(out)};\n`);
report.splice(4, 0,
  `Hand-picked albums and podcasts with art: ${Object.keys(items).length} of ${ALBUMS.length + SHOWS.length}`,
  `Chart albums added: ${out.extraAlbums.length} · chart podcasts added: ${out.extraShows.length} · new artists: ${out.extraArtists.length}`,
  `Artists with a Commons photo: ${photos} of ${allArtists.length}`, '',
  '## Wikimedia responses', ...[...wikiStats].sort().map(([k, n]) => `- ${k}: ${n}`), '',
  '## Apple genres with no Melo genre', ...[...unmapped].sort((a, b) => b[1] - a[1]).map(([g, n]) => `- ${g}: ${n}`), '', '## Misses', ...(misses.length ? misses.map(m => '- ' + m) : ['- none']), '');
writeFileSync(new URL('../catalog-report.md', import.meta.url), report.join('\n') + '\n');
console.log(report.slice(4, 12).join('\n'));
