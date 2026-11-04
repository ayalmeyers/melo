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
  if (!url || !url.startsWith('https://upload.wikimedia.org/')) return null;
  const meta = info?.extmetadata ?? {};
  const author = strip(meta.Artist?.value).slice(0, 120);
  const license = strip(meta.LicenseShortName?.value).slice(0, 60);
  const credit = ['Photo', author && `by ${author}`, license && `(${license})`, 'via Wikimedia Commons'].filter(Boolean).join(' ');
  return { url, credit, source: info?.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page?.title ?? '')}` };
}

/** Looks up a photo for an artist by name. Returns null when Wikipedia has no confident match or no free image. */
export async function findArtistPhoto(name: string, fetchJson: FetchJson): Promise<ArtistPhoto | null> {
  try {
    const qid = pickPage(await fetchJson(wikiSearchUrl(name)), name);
    if (!qid) return null;
    const file = pickImageFile(await fetchJson(wikidataImageUrl(qid)));
    if (!file) return null;
    return pickPhoto(await fetchJson(commonsInfoUrl(file)));
  } catch {
    return null;
  }
}

/** Header Wikimedia asks API clients to send (browsers can't set User-Agent). */
export const WIKI_HEADERS = { 'Api-User-Agent': 'Melo/1.0 (music social app; https://github.com/ayalmeyers/melo)' };
