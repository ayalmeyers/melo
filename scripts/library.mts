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
const MIN_SL = Number(process.env.LIB_MIN_SITELINKS ?? 12);
const DEADLINE = Date.now() + Number(process.env.LIB_MAX_MINUTES ?? 320) * 60_000;
const LIMIT = Number(process.env.LIB_LIMIT ?? 0) || (DRY ? 40 : 0);
// Several runners split the work (each has its own Apple rate limit): this one takes every SHARDS-th artist.
const SHARD = Number(process.env.LIB_SHARD ?? 0), SHARDS = Math.max(1, Number(process.env.LIB_SHARDS ?? 1));
const UA = 'MeloLibrary/1.0 (https://github.com/ayalmeyers/melo)';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const summary = (line: string) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n'); };

// Compare names loosely; names in non-Latin scripts (周杰倫) keep their characters instead of collapsing to nothing.
const norm = (x: string) => x.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

/* ---------- polite HTTP with per-host pacing ---------- */
const lastHit = new Map<string, number>();
const GAP: Record<string, number> = { 'rss.marketingtools.apple.com': 0, 'rss.applemarketingtools.com': 0, 'itunes.apple.com': 3200, 'query.wikidata.org': 2000, 'qlever.cs.uni-freiburg.de': 1000, 'en.wikipedia.org': 600, 'commons.wikimedia.org': 600 };
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
const albumsBy = new Map<string, string[]>();
function dryRpc(fn: string, body: unknown): unknown {
  if (fn === 'library_synced') return [];
  if (fn === 'library_stats') return dry;
  const p = (body as { p: { artists?: { name: string; wiki?: string; image_url?: string; genres: string[]; cc: string }[]; albums?: { title: string; artist_name: string }[] } }).p;
  for (const a of p.artists ?? []) { dry.artists++; if (a.wiki) dry.bios++; if (a.image_url) dry.photos++; if (dry.sample.length < 25) dry.sample.push(`${a.name} [${a.cc}] ${a.genres.join('/')}${a.image_url ? ' photo' : ''}${a.wiki ? ' bio' : ''}`); }
  dry.albums += p.albums?.length ?? 0;
  for (const a of p.albums ?? []) albumsBy.set(a.artist_name, [...(albumsBy.get(a.artist_name) ?? []), a.title]);
  return { artists: p.artists?.length ?? 0, albums: p.albums?.length ?? 0 };
}

/* ---------- 1. Who belongs in the library ---------- */
interface Target { apple: number; alts?: number[]; qid?: string; label?: string; sl: number; image?: string; cc?: string; enwiki?: string; charts: number }
const targets = new Map<number, Target>();
// Some artists carry two Apple ids on Wikidata (an old and a new profile). One page per artist: extra ids become alternates.
const byQid = new Map<string, number>(); const altOf = new Map<number, number>();

const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
`;
const query = (min: number, max: number) => `${PREFIXES}SELECT ?item ?apple ?sl (SAMPLE(?lbl) AS ?label) (SAMPLE(?img) AS ?image) (SAMPLE(?code) AS ?cc) (SAMPLE(?t) AS ?enwiki) WHERE {
  ?item wdt:P2850 ?apple ; wikibase:sitelinks ?sl .
  FILTER(?sl >= ${min} && ?sl < ${max})
  # Music only: groups; people listed directly as singer, musician, composer, rapper, singer-songwriter, guitarist, pianist,
  # DJ, record producer or songwriter. Writers, poets, philosophers, politicians, journalists, playwrights and actors count
  # only when Wikidata lists them directly as singer, musician, composer, rapper, singer-songwriter, guitarist or pianist
  # (Apple lists authors as audiobook "artists").
  FILTER(
    EXISTS { ?item wdt:P31/wdt:P279* wd:Q215380 }
    || ( EXISTS { { ?item wdt:P106/wdt:P279* wd:Q639669 } UNION { ?item wdt:P106/wdt:P279* wd:Q36834 } UNION { ?item wdt:P106 ?dj . VALUES ?dj { wd:Q130857 wd:Q183945 wd:Q753110 } } }
         && ( NOT EXISTS { ?item wdt:P106 ?w . VALUES ?w { wd:Q36180 wd:Q49757 wd:Q6625963 wd:Q4964182 wd:Q82955 wd:Q1930187 wd:Q214917 wd:Q33999 } }
              || EXISTS { ?item wdt:P106 ?m . VALUES ?m { wd:Q177220 wd:Q639669 wd:Q36834 wd:Q2252262 wd:Q488205 wd:Q855091 wd:Q486748 } } ) )
  )
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
    const qid = b.item.value.split('/').pop()!;
    const main = byQid.get(qid);
    if (main !== undefined && main !== apple) { const m = targets.get(main)!; if (!m.alts?.includes(apple)) m.alts = [...(m.alts ?? []), apple]; altOf.set(apple, main); continue; }
    byQid.set(qid, apple);
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
async function chartFeed(cc: string, kind: string): Promise<Rss[]> {
  for (const host of rssHosts) {
    try {
      const rows = ((await getJson(`https://${host}/api/v2/${cc}/music/most-played/100/${kind}.json`, {}, 1, 15_000)) as { feed?: { results?: Rss[] } }).feed?.results ?? [];
      if (rows.length) return rows;
    } catch { /* try the other host */ }
  }
  return [];
}
// Eight feeds at a time; Apple's chart hosts are slow from cloud machines, so the step is capped at six minutes.
const jobs = STOREFRONTS.flatMap(cc => ['albums', 'songs'].map(kind => [cc, kind] as const));
await Promise.all(Array.from({ length: 8 }, async () => {
  while (jobs.length && Date.now() - tCharts < 6 * 60_000) {
    const [cc, kind] = jobs.shift()!;
    const rows = await chartFeed(cc, kind);
    if (rows.length) feeds++;
    for (const r of rows) {
      const id0 = Number(r.artistId); if (!id0) continue; const id = altOf.get(id0) ?? id0;
      const t = targets.get(id); if (t) t.charts++; else { targets.set(id, { apple: id, label: r.artistName, sl: 0, charts: 1 }); chartArtists++; }
    }
  }
}));
// Apple's charts sometimes use a newer artist id than Wikidata has. A chart-only entry whose name matches a Wikidata
// artist becomes that artist's alternate id, so each artist still gets exactly one page.
{
  const nameKey = (x: string) => norm(x.split(/,\s|\s&\s|\sx\s|\sfeat\.?\s/i)[0]);
  const byName = new Map<string, Target>();
  for (const t of targets.values()) if (t.sl > 0 && t.label) { const k = nameKey(t.label); const o = byName.get(k); if (!o || o.sl < t.sl) byName.set(k, t); }
  let merged = 0;
  for (const t of [...targets.values()]) {
    if (t.sl > 0 || !t.label) continue;
    const m = byName.get(nameKey(t.label)); if (!m) continue;
    m.alts = [...(m.alts ?? []), t.apple]; m.charts += t.charts; altOf.set(t.apple, m.apple); targets.delete(t.apple); merged++; chartArtists--;
  }
  log(`chart entries merged into Wikidata artists: ${merged}`);
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
// Split by Apple id, not list position: every runner agrees which artists are its own even when their chart feeds differ.
queue = queue.filter(t => !fresh.has(t.apple)).filter(t => t.apple % SHARDS === SHARD);
if (LIMIT) queue = queue.slice(0, LIMIT);
log(`already fresh: ${fresh.size} · shard ${SHARD + 1}/${SHARDS} syncs ${queue.length}`);
summary(`### Library run\n- Artists found: ${targets.size} (Wikidata ≥ ${MIN_SL} sitelinks + Apple charts in ${STOREFRONTS.length} countries)\n- Already fresh: ${fresh.size}\n- To sync: ${queue.length}`);

/* ---------- 3. Sync in chunks ---------- */
const EDITION = /\s*(?:[([][^)\]]*(?:deluxe|remaster(?:ed)?|anniversary|expanded|edition|version)[^)\]]*[)\]]|\s[-–]\s.*(?:deluxe|remaster(?:ed)?|anniversary|expanded|edition|version).*)$/i;
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
const NOT_MUSIC = /spoken word|audiobook|hörbuch|livres audio|audiolibro|fitness/i;
// Versions people don't log as records: remix packages, store sessions, tour setlists, "(Live)" tour cuts.
// Albums whose title starts with "Live at/in/from…" are kept: those are records in their own right.
const NOISE = /\bremix(es|ed)?\b|\bsped up\b|\bslowed\b|\bkaraoke\b|\binstrumentals?\b|\ba cappella\b|\bacapella\b|apple music|spotify|amazon (music|original)|\bsetlist\b|\bhome session\b|[([\-–]\s*live\b[^)\]]*[)\]]?\s*$|\(live\)/i;
function tidy(raw: AppleRaw[]): AppleRaw[] {
  // Older live albums (Stop Making Sense, At Folsom Prison) are classics; recent "(Live)" releases are mostly tour cuts.
  const LIVE_ONLY = /[([\-–]\s*live\b[^)\]]*[)\]]?\s*$|\(live\)/i;
  const noise = (a: AppleRaw) => { const t = a.collectionName ?? ''; if (!NOISE.test(t)) return false; return !(LIVE_ONLY.test(t) && !NOISE.test(t.replace(LIVE_ONLY, '')) && (a.releaseDate ?? '9999') < '2005'); };
  const albums = raw.filter(a => !NOT_MUSIC.test(a.primaryGenreName ?? '') && !noise(a));
  const byKey = new Map<string, AppleRaw[]>();
  for (const a of albums) { const k = norm((a.collectionName ?? '').replace(EDITION, '')); byKey.set(k, [...(byKey.get(k) ?? []), a]); }
  const keep: AppleRaw[] = [];
  for (const group of byKey.values()) {
    const notClean = group.filter(a => a.collectionExplicitness !== 'cleaned');
    const pool = notClean.length ? notClean : group;
    const original = pool.filter(a => !EDITION.test(a.collectionName ?? ''));
    keep.push((original.length ? original : pool).sort((x, y) => (x.releaseDate ?? '').localeCompare(y.releaseDate ?? ''))[0]);
  }
  // "Record: The Encore", "Record + Acoustic Collection", "Record (Live)" are versions of Record. Re-recordings ("Taylor's Version") stand alone.
  const titles = keep.map(a => a.collectionName ?? '');
  return keep.filter(a => {
    const t = a.collectionName ?? '';
    if (/taylor.s version/i.test(t)) return true;
    return !titles.some(base => base.length >= 3 && base !== t && t.toLowerCase().startsWith(base.toLowerCase()) && /^\s*(?:[:+(\[-–—]|&)/.test(t.slice(base.length)));
  });
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
// Apple's lookup returns at most 200 albums per request in total, so each artist gets a request of their own.
const CHUNK = 30; const APPLE_BATCH = 1;
for (let i = 0; i < queue.length; i += CHUNK) {
  if (Date.now() > DEADLINE) { log('time limit reached; the next run continues from here'); break; }
  const chunk = queue.slice(i, i + CHUNK);
  const disco = new Map<number, { name?: string; albums: AppleRaw[] }>();
  for (let k = 0; k < chunk.length; k += APPLE_BATCH) {
    const t = chunk[k];
    try {
      // With alternate ids, keep whichever Apple profile holds the bigger discography.
      let best: { name?: string; albums: AppleRaw[] } | undefined;
      for (const id of [t.apple, ...(t.alts ?? [])]) {
        const got = (await discographies([id])).get(id);
        if (got && (!best || got.albums.length > best.albums.length)) best = got;
      }
      if (best) disco.set(t.apple, best);
    } catch (e) { log('apple lookup failed', t.apple, String(e).slice(0, 100)); }
  }
  const [bio, pics] = await Promise.all([
    bios(chunk.map(t => t.enwiki).filter((x): x is string => !!x)).catch(() => new Map<string, string>()),
    photos(chunk.map(t => t.image).filter((x): x is string => !!x)).catch(() => new Map<string, { url: string; credit: string; source: string }>()),
  ]);
  const artists: unknown[] = []; const albums: unknown[] = [];
  for (const t of chunk) {
    const d = disco.get(t.apple);
    // Apple's own artist name first; then Wikidata's; a chart credit ("A, B & C") only as the first name in it.
    const name = d?.name ?? t.label?.split(/,\s|\s&\s|\sx\s|\sfeat\.?\s/i)[0] ?? d?.albums[0]?.artistName;
    // No discography from Apple this time: leave the artist for a later run instead of adding an empty page.
    if (!d) { totals.emptyApple++; continue; }
    if (!name) continue;
    const kept = tidy(d?.albums ?? []);
    // Nothing left after removing audiobooks and spoken word: not a music artist on Apple.
    if (!kept.length) { totals.emptyApple++; continue; }
    // Only real artists: at least one record credited to them alone (keeps out poets who appear on readings, one-off credits).
    if (!kept.some(a => norm(a.artistName ?? '') === norm(name))) { totals.emptyApple++; continue; }
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
if (DRY) { console.log(dry.sample.join('\n')); for (const [n, t] of [...albumsBy].slice(0, 12)) console.log(`${n} (${t.length}): ${t.slice(0, 14).join(' | ')}`); }
log('done', JSON.stringify(totals), JSON.stringify(stats));
summary(`- This run: ${JSON.stringify(totals)}\n- Library now: ${JSON.stringify(stats)}`);
