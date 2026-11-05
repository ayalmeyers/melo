/**
 * Melo Library: loads artists and their complete discographies into Supabase in bulk.
 * Runs on GitHub Actions (.github/workflows/library.yml) with the service role key. Resumable: each run continues
 * with the most notable artists not yet synced, stops before the time limit, and the next run picks up from there.
 *
 * Sources
 *  - Wikidata: every artist with an Apple Music artist ID (P2850) and Wikipedia articles in many languages,
 *    a strong signal of notability worldwide. Also their photo (P18), country, and English Wikipedia page.
 *  - Apple charts: the most-played albums and songs in ~40 countries, so whoever is popular right now is in.
 *  - Apple (iTunes lookup): each artist's full album and EP discography with covers and links.
 *  - Wikipedia: the opening of each artist's article as their Melo wiki page, credited (CC BY-SA 4.0).
 *  - Wikimedia Commons: photo credits and license for each artist photo.
 *
 * env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LIB_MIN_SITELINKS (default 18), LIB_MAX_MINUTES (default 320), LIB_LIMIT (optional cap on artists)
 */
import { appendFileSync } from 'node:fs';
import { appleArt, parseApple } from '../packages/core/src/apple';
import { pickPhoto } from '../packages/core/src/images';
import { toMeloGenre } from './genres.mts';

const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Without keys this is a dry run: it gathers everything for the first 60 artists and reports, but writes nothing.
const DRY = !URL_ || !KEY;
if (DRY) console.log('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: dry run (nothing is written). Add them as repository secrets to fill the library.');
const MIN_SL = Number(process.env.LIB_MIN_SITELINKS ?? 18);
const DEADLINE = Date.now() + Number(process.env.LIB_MAX_MINUTES ?? 320) * 60_000;
const LIMIT = Number(process.env.LIB_LIMIT ?? 0) || (DRY ? 60 : 0);
const UA = 'MeloLibrary/1.0 (https://github.com/ayalmeyers/melo)';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const summary = (line: string) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n'); };

/* ---------- polite HTTP with per-host pacing ---------- */
const lastHit = new Map<string, number>();
const GAP: Record<string, number> = { 'itunes.apple.com': 3200, 'query.wikidata.org': 2000, 'qlever.cs.uni-freiburg.de': 1000, 'en.wikipedia.org': 600, 'commons.wikimedia.org': 600 };
async function getJson(url: string, init: RequestInit = {}, tries = 5, timeoutMs = 60_000): Promise<unknown> {
  const host = new URL(url).host;
  for (let i = 0; i < tries; i++) {
    const gap = (GAP[host] ?? 300) - (Date.now() - (lastHit.get(host) ?? 0)); if (gap > 0) await wait(gap);
    lastHit.set(host, Date.now());
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
      if (r.status === 429 || r.status === 503 || r.status === 502 || r.status === 403) { await wait((Number(r.headers.get('retry-after')) || 20 * (i + 1)) * 1000); continue; }
      // Other 4xx answers will not change on retry.
      if (r.status >= 400 && r.status < 500) throw Object.assign(new Error(`${r.status} ${(await r.text()).slice(0, 200)}`), { final: true });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      return await r.json();
    } catch (e) { if ((e as { final?: boolean }).final || i === tries - 1) throw e; await wait(4000 * (i + 1)); }
  }
  throw new Error('gave up ' + url);
}
const rpc = (fn: string, body: unknown): Promise<unknown> => DRY ? Promise.resolve(dryRpc(fn, body)) : getJson(`${URL_}/rest/v1/rpc/${fn}`, {
  method: 'POST', body: JSON.stringify(body),
  headers: { apikey: KEY!, ...(KEY!.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json' },
}, 3);

const dry = { artists: 0, albums: 0, bios: 0, photos: 0, sample: [] as string[] };
function dryRpc(fn: string, body: unknown): unknown {
  if (fn === 'library_synced') return [];
  if (fn === 'library_stats') return dry;
  const p = (body as { p: { artists?: { name: string; wiki?: string; image_url?: string; genres: string[]; cc: string }[]; albums?: { title: string; artist_name: string }[] } }).p;
  for (const a of p.artists ?? []) { dry.artists++; if (a.wiki) dry.bios++; if (a.image_url) dry.photos++; if (dry.sample.length < 25) dry.sample.push(`${a.name} [${a.cc}] ${a.genres.join('/')}${a.image_url ? ' photo' : ''}${a.wiki ? ' bio' : ''}`); }
  dry.albums += p.albums?.length ?? 0;
  if (p.albums?.length && dry.sample.length < 40) dry.sample.push('  albums: ' + p.albums.slice(0, 6).map(a => a.title).join(' | '));
  return { artists: p.artists?.length ?? 0, albums: p.albums?.length ?? 0 };
}

/* ---------- 1. Who belongs in the library ---------- */
interface Target { apple: number; qid?: string; label?: string; sl: number; image?: string; cc?: string; enwiki?: string; charts: number }
const targets = new Map<number, Target>();

const PREFIXES = `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
`;
const query = (min: number, max: number) => `${PREFIXES}SELECT ?item ?apple ?sl (SAMPLE(?lbl) AS ?label) (SAMPLE(?img) AS ?image) (SAMPLE(?code) AS ?cc) (SAMPLE(?t) AS ?enwiki) WHERE {
  ?item wdt:P2850 ?apple ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${min} && ?sl < ${max})
  OPTIONAL { ?item rdfs:label ?lbl FILTER(LANG(?lbl) = "en") }
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item wdt:P495 ?c1 . ?c1 wdt:P297 ?code }
  OPTIONAL { ?item wdt:P27 ?c2 . ?c2 wdt:P297 ?code }
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?t }
} GROUP BY ?item ?apple ?sl`;
type Binding = Record<string, { value: string }>;
function absorb(bindings: Binding[]): number {
  let n = 0;
  for (const b of bindings) {
    const raw = b.apple?.value ?? ''; const apple = Number(raw); if (!apple || !/^\d+$/.test(raw)) continue;
    const prev = targets.get(apple); const sl = Number(b.sl?.value ?? 0);
    if (prev && prev.sl >= sl) continue;
    const file = b.image?.value ? decodeURIComponent(b.image.value.split('/Special:FilePath/')[1] ?? b.image.value.split('/').pop() ?? '').replace(/_/g, ' ') : '';
    targets.set(apple, { apple, qid: b.item.value.split('/').pop(), label: b.label?.value, sl, charts: prev?.charts ?? 0,
      image: file || undefined, cc: b.cc?.value?.toUpperCase(), enwiki: b.enwiki?.value });
    n++;
  }
  return n;
}
// QLever (a fast public Wikidata mirror) answers the whole question at once. If it is down, ask Wikidata's own
// endpoint in sitelink bands, each small enough to finish inside its 60-second limit.
const t0 = Date.now();
try {
  const j = await getJson(`https://qlever.cs.uni-freiburg.de/api/wikidata?query=${encodeURIComponent(query(MIN_SL, 100000))}`, { headers: { Accept: 'application/sparql-results+json' } }, 2, 180_000) as { results?: { bindings: Binding[] } };
  log(`qlever: ${absorb(j.results?.bindings ?? [])} artists in ${Math.round((Date.now() - t0) / 1000)}s`);
} catch (e) { log('qlever unavailable:', String(e).slice(0, 160)); }
if (targets.size < 1000) {
  const bands: [number, number][] = [[150, 100000], [90, 150], [60, 90], [45, 60], [35, 45], [28, 35], [24, 28], [21, 24], [18, 21], [15, 18], [12, 15], [10, 12]];
  for (const [a, b] of bands) {
    if (b <= MIN_SL || Date.now() - t0 > 25 * 60_000) break;
    try {
      const j = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query(Math.max(a, MIN_SL), b))}`, {}, 2, 75_000) as { results: { bindings: Binding[] } };
      log(`wikidata sitelinks ${a}–${b - 1}: ${absorb(j.results.bindings)}`);
    } catch (e) { log(`wikidata band ${a}–${b - 1} failed:`, String(e).slice(0, 120)); }
  }
}
log('artists from Wikidata:', targets.size);

type Rss = { artistId?: string; artistName: string };
const STOREFRONTS = ['us', 'gb', 'ca', 'au', 'ie', 'nz', 'ng', 'gh', 'ke', 'za', 'eg', 'ma', 'br', 'mx', 'ar', 'co', 'cl', 'pe', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'tr', 'jp', 'kr', 'tw', 'hk', 'ph', 'id', 'th', 'vn', 'in', 'pk', 'ae', 'sa', 'il'];
let chartArtists = 0; const tCharts = Date.now(); let feeds = 0;
// Use whichever chart host answers, remember it, and give the whole step at most six minutes.
let rssHosts = ['rss.marketingtools.apple.com', 'rss.applemarketingtools.com'];
charts: for (const cc of STOREFRONTS) for (const kind of ['albums', 'songs']) {
  if (Date.now() - tCharts > 6 * 60_000) { log('chart step hit its time limit'); break charts; }
  let rows: Rss[] = []; const t = Date.now();
  for (const host of rssHosts) {
    try {
      rows = ((await getJson(`https://${host}/api/v2/${cc}/music/most-played/100/${kind}.json`, {}, 1, 15_000)) as { feed?: { results?: Rss[] } }).feed?.results ?? [];
      if (rows.length) { rssHosts = [host, ...rssHosts.filter(h => h !== host)]; break; }
    } catch (e) { if (feeds < 3) log(`chart ${cc} ${kind} via ${host}:`, String(e).slice(0, 100)); }
  }
  if (feeds < 3 || !rows.length) log(`chart ${cc} ${kind}: ${rows.length} rows in ${Date.now() - t}ms`);
  if (rows.length) feeds++;
  for (const r of rows) {
    const id = Number(r.artistId); if (!id) continue;
    const t = targets.get(id); if (t) t.charts++; else { targets.set(id, { apple: id, label: r.artistName, sl: 0, charts: 1 }); chartArtists++; }
  }
}
log(`artists added from Apple charts: ${chartArtists} (${feeds} feeds in ${Math.round((Date.now() - tCharts) / 1000)}s) · total: ${targets.size}`);

/* ---------- 2. Skip what is already fresh, most notable first ---------- */
const popularity = (t: Target) => t.sl * 10 + t.charts * 40;
let queue = [...targets.values()].sort((a, b) => popularity(b) - popularity(a));
const fresh = new Set<number>();
for (let i = 0; i < queue.length; i += 1000) {
  const ids = queue.slice(i, i + 1000).map(t => t.apple);
  for (const id of await rpc('library_synced', { p_ids: ids, p_days: 45 }) as number[]) fresh.add(Number(id));
}
queue = queue.filter(t => !fresh.has(t.apple));
if (LIMIT) queue = queue.slice(0, LIMIT);
log(`already fresh: ${fresh.size} · to sync now: ${queue.length}`);
summary(`### Library run\n- Artists found: ${targets.size} (Wikidata ≥ ${MIN_SL} sitelinks + Apple charts in ${STOREFRONTS.length} countries)\n- Already fresh: ${fresh.size}\n- To sync: ${queue.length}`);

/* ---------- 3. Sync in chunks ---------- */
const EDITION = /\s*(?:[([][^)\]]*(?:deluxe|remaster(?:ed)?|anniversary|expanded|edition|version)[^)\]]*[)\]]|\s[-–]\s.*(?:deluxe|remaster(?:ed)?|anniversary|expanded|edition|version).*)$/i;
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
type AppleRaw = { wrapperType: string; collectionType?: string; artistId?: number; artistName?: string; collectionId?: number; collectionName?: string; collectionExplicitness?: string;
  artworkUrl100?: string; collectionViewUrl?: string; releaseDate?: string; trackCount?: number; primaryGenreName?: string };

async function discographies(ids: number[]): Promise<Map<number, { name?: string; albums: AppleRaw[] }>> {
  const out = new Map<number, { name?: string; albums: AppleRaw[] }>();
  const j = await getJson(`https://itunes.apple.com/lookup?id=${ids.join(',')}&entity=album&limit=200&sort=recent`) as { results?: AppleRaw[] };
  for (const r of j.results ?? []) {
    if (!r.artistId) continue;
    const e = out.get(r.artistId) ?? { albums: [] }; out.set(r.artistId, e);
    if (r.wrapperType === 'artist') e.name = r.artistName;
    else if (r.wrapperType === 'collection' && r.collectionType === 'Album' && r.collectionId && !/ - Single$/.test(r.collectionName ?? '')) e.albums.push(r);
  }
  return out;
}
/** One release per record: drop clean versions when the explicit one exists, and editions when the original exists. */
function tidy(albums: AppleRaw[]): AppleRaw[] {
  const byKey = new Map<string, AppleRaw[]>();
  for (const a of albums) { const k = norm((a.collectionName ?? '').replace(EDITION, '')); byKey.set(k, [...(byKey.get(k) ?? []), a]); }
  const keep: AppleRaw[] = [];
  for (const group of byKey.values()) {
    const notClean = group.filter(a => a.collectionExplicitness !== 'cleaned');
    const pool = notClean.length ? notClean : group;
    const original = pool.filter(a => !EDITION.test(a.collectionName ?? ''));
    keep.push((original.length ? original : pool).sort((x, y) => (x.releaseDate ?? '').localeCompare(y.releaseDate ?? ''))[0]);
  }
  return keep;
}
async function bios(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1&titles=${encodeURIComponent(chunk.join('|'))}`) as
      { query?: { pages?: Record<string, { title: string; extract?: string }>; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } };
    const back = new Map<string, string>(); for (const m of [...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])]) back.set(m.to, back.get(m.from) ?? m.from);
    for (const p of Object.values(j.query?.pages ?? {})) {
      const text = (p.extract ?? '').replace(/\s*\([^()]*(?:born|pronounced|listen)[^()]*\)/g, '').replace(/\n{2,}/g, '\n\n').trim();
      if (text.length < 80) continue;
      let cut = text.slice(0, 1600); if (text.length > 1600) cut = cut.slice(0, cut.lastIndexOf('. ') + 1) || cut;
      out.set(back.get(p.title) ?? p.title, `${cut}\n\nFrom Wikipedia (CC BY-SA 4.0): https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`);
    }
  }
  return out;
}
async function photos(files: string[]): Promise<Map<string, { url: string; credit: string; source: string }>> {
  const out = new Map<string, { url: string; credit: string; source: string }>();
  for (let i = 0; i < files.length; i += 40) {
    const chunk = files.slice(i, i + 40);
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&redirects=1&titles=${encodeURIComponent(chunk.map(f => 'File:' + f).join('|'))}`) as
      { query?: { pages?: Record<string, { title: string }>; normalized?: { from: string; to: string }[] } };
    const back = new Map<string, string>(); for (const m of j.query?.normalized ?? []) back.set(m.to, m.from);
    for (const p of Object.values(j.query?.pages ?? {})) {
      const ph = pickPhoto({ query: { pages: { x: p } } }); if (!ph) continue;
      out.set((back.get(p.title) ?? p.title).replace(/^File:/, ''), { url: ph.url, credit: ph.credit, source: ph.source });
    }
  }
  return out;
}

const totals = { artists: 0, new_artists: 0, albums: 0, new_albums: 0, wiki: 0, photos: 0, emptyApple: 0 };
const CHUNK = 30; const APPLE_BATCH = 10;
for (let i = 0; i < queue.length; i += CHUNK) {
  if (Date.now() > DEADLINE) { log('time limit reached; the next run continues from here'); break; }
  const chunk = queue.slice(i, i + CHUNK);
  const disco = new Map<number, { name?: string; albums: AppleRaw[] }>();
  for (let k = 0; k < chunk.length; k += APPLE_BATCH) {
    const ids = chunk.slice(k, k + APPLE_BATCH).map(t => t.apple);
    try { for (const [id, v] of await discographies(ids)) disco.set(id, v); } catch (e) { log('apple lookup failed', ids.join(','), String(e).slice(0, 100)); }
  }
  const [bio, pics] = await Promise.all([
    bios(chunk.map(t => t.enwiki).filter((x): x is string => !!x)).catch(() => new Map<string, string>()),
    photos(chunk.map(t => t.image).filter((x): x is string => !!x)).catch(() => new Map<string, { url: string; credit: string; source: string }>()),
  ]);
  const artists: unknown[] = []; const albums: unknown[] = [];
  for (const t of chunk) {
    const d = disco.get(t.apple);
    const name = d?.name ?? d?.albums[0]?.artistName ?? t.label;
    // No discography from Apple this time: leave the artist for a later run instead of adding an empty page.
    if (!d) { totals.emptyApple++; continue; }
    if (!name) continue;
    const kept = tidy(d?.albums ?? []);
    const genreVotes = new Map<string, number>();
    for (const a of kept) { const g = toMeloGenre([a.primaryGenreName ?? '']); if (g) genreVotes.set(g, (genreVotes.get(g) ?? 0) + 1); }
    const genres = [...genreVotes].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([g]) => g);
    const pic = t.image ? pics.get(t.image) : undefined; if (pic) totals.photos++;
    artists.push({ apple_id: t.apple, name, cc: t.cc ?? '', genres, wikidata_id: t.qid, popularity: popularity(t),
      image_url: pic?.url, image_credit: pic?.credit, image_source: pic?.source, wiki: t.enwiki ? bio.get(t.enwiki) : undefined, synced: !!d });
    for (const a of kept) albums.push({ apple_id: a.collectionId, artist_apple_id: t.apple, title: a.collectionName, artist_name: a.artistName ?? name,
      year: a.releaseDate?.slice(0, 4), release_date: a.releaseDate?.slice(0, 10), genre: a.primaryGenreName, artwork_url: appleArt(a.artworkUrl100 ?? null, 600),
      apple_url: a.collectionViewUrl?.split('?')[0], track_count: a.trackCount, popularity: popularity(t) });
  }
  // Artists first (albums need them), then albums in slices that stay well inside the statement timeout.
  try {
    const r1 = await rpc('library_import', { p: { artists } }) as Record<string, number>;
    for (const k of ['artists', 'new_artists', 'wiki'] as const) totals[k] += r1[k] ?? 0;
    for (let k = 0; k < albums.length; k += 400) {
      const r2 = await rpc('library_import', { p: { albums: albums.slice(k, k + 400) } }) as Record<string, number>;
      totals.albums += r2.albums ?? 0; totals.new_albums += r2.new_albums ?? 0;
    }
  } catch (e) { log('import failed for chunk', i, String(e).slice(0, 300)); }
  if (DRY || (i / CHUNK) % 10 === 0) log(`${i + chunk.length}/${queue.length}`, JSON.stringify(totals));
}

const stats = await rpc('library_stats', {}).catch(e => ({ error: String(e) }));
if (DRY) console.log(dry.sample.join('\n'));
log('done', JSON.stringify(totals), JSON.stringify(stats));
summary(`- This run: ${JSON.stringify(totals)}\n- Library now: ${JSON.stringify(stats)}`);
