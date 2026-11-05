/**
 * Artist photos from Wikimedia Commons. Every image on Commons carries a free license (most need credit),
 * so Melo stores the photographer and license with the photo and links to the file page.
 * Path: Wikipedia search → the page's Wikidata item → its "image" (P18) → Commons file info.
 */
import type { FetchJson } from './apple';

export interface ArtistPhoto { url: string; credit: string; source: string }

const WP = 'https://en.wikipedia.org/w/api.php';
const WD = 'https://www.wikidata.org/w/api.php';
const CM = 'https://commons.wikimedia.org/w/api.php';
const qs = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const wikiSearchUrl = (name: string) => `${WP}?${qs({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: `${name} (singer OR rapper OR musician OR band OR group OR producer OR DJ)`, gsrlimit: '3', prop: 'pageprops', ppprop: 'wikibase_item' })}`;
export const wikidataImageUrl = (qid: string) => `${WD}?${qs({ action: 'wbgetclaims', format: 'json', origin: '*', entity: qid, property: 'P18' })}`;
export const commonsInfoUrl = (file: string, width = 800) => `${CM}?${qs({ action: 'query', format: 'json', origin: '*', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(width) })}`;

const strip = (html: unknown) => (typeof html === 'string' ? html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '');
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

type Pages = { query?: { pages?: Record<string, { title?: string; index?: number; pageprops?: { wikibase_item?: string }; imageinfo?: { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } };

/** Picks the Wikipedia page for an artist: the best-ranked result whose title starts with the artist's name. */
export function pickPage(json: unknown, name: string): string | null {
  const pages = Object.values((json as Pages)?.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const want = norm(name);
  const hit = pages.find(p => p.title && norm(p.title.replace(/\s*\(.*\)$/, '')) === want && p.pageprops?.wikibase_item);
  return hit?.pageprops?.wikibase_item ?? null;
}

export function pickImageFile(json: unknown): string | null {
  const claims = (json as { claims?: { P18?: { mainsnak?: { datavalue?: { value?: unknown } } }[] } })?.claims?.P18;
  const v = claims?.[0]?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? v : null;
}

export function pickPhoto(json: unknown): ArtistPhoto | null {
  const page = Object.values((json as Pages)?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url || !url.startsWith('https://upload.wikimedia.org/wikipedia/commons/')) return null;
  const meta = info?.extmetadata ?? {};
  const author = strip(meta.Artist?.value).slice(0, 120);
  const license = strip(meta.LicenseShortName?.value).slice(0, 60);
  const credit = ['Photo', author && `by ${author}`, license && `(${license})`, 'via Wikimedia Commons'].filter(Boolean).join(' ');
  return { url, credit, source: info?.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page?.title ?? '')}` };
}

/* Direct title lookup: the artist's own Wikipedia page by exact name, or the usual "(musician)" style variants.
   A page only counts when Wikipedia's short description says it is about a musician, so "Future" the concept
   or "Drake" the disambiguation page never wins. This finds far more artists than full-text search. */
const QUALIFIERS = ['', ' (musician)', ' (singer)', ' (rapper)', ' (band)', ' (group)', ' (entertainer)', ' (DJ)', ' (producer)'];
export const wikiTitlesUrl = (name: string) => `${WP}?${qs({ action: 'query', format: 'json', origin: '*', redirects: '1', prop: 'pageprops|description|pageimages', piprop: 'name', ppprop: 'wikibase_item|disambiguation', titles: QUALIFIERS.map(q => name + q).join('|') })}`;
const MUSIC = /singer|rapper|musician|band|group|duo|trio|producer|\bDJ\b|disc jockey|composer|songwriter|vocalist|guitarist|pianist|drummer|bassist|music|idol|orchestra|ensemble|entertainer|artist/i;
type TitlePage = { title?: string; missing?: string; description?: string; pageimage?: string; pageprops?: { wikibase_item?: string; disambiguation?: string } };
/** Picks the artist's page from a titles lookup: an existing, non-disambiguation page described as a musician, the plain name first. */
export function pickTitlePage(json: unknown, name: string): { qid: string | null; pageimage: string | null } | null {
  const q = (json as { query?: { pages?: Record<string, TitlePage>; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } })?.query;
  const pages = Object.values(q?.pages ?? {}).filter(p => p.missing === undefined && p.title && !p.pageprops?.disambiguation && MUSIC.test(p.description ?? ''));
  if (!pages.length) return null;
  // Resolve each requested title through normalization and redirects, then keep the requested order.
  const hop = (t: string) => { let x = t; for (const m of [...(q?.normalized ?? []), ...(q?.redirects ?? [])]) if (m.from === x) x = m.to; return x; };
  for (const qual of QUALIFIERS) {
    const target = hop(name + qual);
    const page = pages.find(p => p.title === target);
    if (page) return { qid: page.pageprops?.wikibase_item ?? null, pageimage: page.pageimage ?? null };
  }
  return null;
}

/** Looks up a photo for an artist by name. Returns null when Wikipedia has no confident match or no free image. */
export async function findArtistPhoto(name: string, fetchJson: FetchJson): Promise<ArtistPhoto | null> {
  try {
    let qid: string | null = null; let pageimage: string | null = null;
    const direct = pickTitlePage(await fetchJson(wikiTitlesUrl(name)).catch(() => null), name);
    if (direct) { qid = direct.qid; pageimage = direct.pageimage; }
    else qid = pickPage(await fetchJson(wikiSearchUrl(name)), name);
    if (!qid && !pageimage) return null;
    // Wikidata's chosen image first; the Wikipedia lead image when Wikidata has none. Either way it must live on Commons.
    const file = (qid ? pickImageFile(await fetchJson(wikidataImageUrl(qid)).catch(() => null)) : null) ?? pageimage;
    if (!file) return null;
    return pickPhoto(await fetchJson(commonsInfoUrl(file)));
  } catch {
    return null;
  }
}

/** Header Wikimedia asks API clients to send (browsers can't set User-Agent). */
export const WIKI_HEADERS = { 'Api-User-Agent': 'Melo/1.0 (music social app; https://github.com/ayalmeyers/melo)' };
