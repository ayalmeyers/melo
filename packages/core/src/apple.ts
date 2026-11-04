/**
 * Apple's public catalog (iTunes Search API): albums, podcasts and podcast episodes with real artwork.
 * Docs: https://performance-partners.apple.com/search-api · about 20 requests a minute per IP, so the
 * phone calls Apple directly and the website goes through a cached route.
 * Apple's terms allow its art when it promotes the content, so every page that shows it links back to Apple.
 */
export type AppleKind = 'album' | 'show' | 'episode';

export interface AppleResult {
  kind: AppleKind;
  apple_id: number;
  title: string;
  artist: string;
  artist_apple_id?: number;
  artwork?: string;
  url?: string;
  release_date?: string;
  genre?: string;
  track_count?: number;
  dur_min?: number;
  show_apple_id?: number;
  show_title?: string;
  show_artwork?: string;
  show_url?: string;
}

/** Melo id the import will produce, so a result can link straight to its page once imported. */
export const appleMeloId = (r: Pick<AppleResult, 'kind' | 'apple_id'>) => (r.kind === 'album' ? 'am' : r.kind === 'show' ? 'pc' : 'ep') + r.apple_id;

/** Apple serves any size by rewriting the size in the URL. */
export const appleArt = (url: string | null | undefined, size = 600) => (url ? url.replace(/\/\d+x\d+(bb)?(-\d+)?\.(jpg|png|webp)$/, `/${size}x${size}bb.jpg`) : undefined);

const ENTITY: Record<AppleKind, string> = { album: 'entity=album&media=music', show: 'entity=podcast&media=podcast', episode: 'entity=podcastEpisode&media=podcast' };
export const appleSearchUrl = (term: string, kind: AppleKind, limit = 15, country = 'US') =>
  `https://itunes.apple.com/search?term=${encodeURIComponent(term.trim()).replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g, '+')}&${ENTITY[kind]}&limit=${limit}&country=${country}`;
export const appleLookupUrl = (id: number, entity: 'album' | 'podcastEpisode', limit = 50, country = 'US') =>
  `https://itunes.apple.com/lookup?id=${id}&entity=${entity}&limit=${limit}&country=${country}${entity === 'podcastEpisode' ? '&sort=recent' : ''}`;

type Raw = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Turns one raw Apple result into an AppleResult, or null for anything Melo doesn't keep (songs, singles, artists). */
export function parseAppleItem(r: Raw): AppleResult | null {
  const wrapper = s(r.wrapperType), kind = s(r.kind), ctype = s(r.collectionType);
  if (wrapper === 'collection' && ctype === 'Album') {
    const title = s(r.collectionName); const id = n(r.collectionId);
    if (!title || !id || / - Single$/.test(title)) return null;
    return { kind: 'album', apple_id: id, title, artist: s(r.artistName) ?? '', artist_apple_id: n(r.artistId), artwork: appleArt(s(r.artworkUrl100)),
      url: s(r.collectionViewUrl), release_date: s(r.releaseDate), genre: s(r.primaryGenreName), track_count: n(r.trackCount) };
  }
  if (kind === 'podcast') {
    const id = n(r.collectionId) ?? n(r.trackId); const title = s(r.collectionName) ?? s(r.trackName);
    if (!id || !title) return null;
    return { kind: 'show', apple_id: id, title, artist: s(r.artistName) ?? '', artwork: appleArt(s(r.artworkUrl600) ?? s(r.artworkUrl100)),
      url: s(r.collectionViewUrl) ?? s(r.trackViewUrl), release_date: s(r.releaseDate), genre: s(r.primaryGenreName), track_count: n(r.trackCount) };
  }
  if (kind === 'podcast-episode' || wrapper === 'podcastEpisode') {
    const id = n(r.trackId); const title = s(r.trackName); const show = n(r.collectionId);
    if (!id || !title || !show) return null;
    const ms = n(r.trackTimeMillis);
    return { kind: 'episode', apple_id: id, title, artist: s(r.collectionName) ?? '', artwork: appleArt(s(r.artworkUrl600) ?? s(r.artworkUrl160)),
      url: s(r.trackViewUrl), release_date: s(r.releaseDate), dur_min: ms ? Math.max(1, Math.round(ms / 60000)) : undefined,
      show_apple_id: show, show_title: s(r.collectionName), show_artwork: appleArt(s(r.artworkUrl600)), show_url: s(r.collectionViewUrl) };
  }
  return null;
}

export function parseApple(json: unknown): AppleResult[] {
  const results = (json as { results?: Raw[] })?.results;
  if (!Array.isArray(results)) return [];
  const out: AppleResult[] = []; const seen = new Set<string>();
  for (const r of results) { const p = parseAppleItem(r); if (p && !seen.has(p.kind + p.apple_id)) { seen.add(p.kind + p.apple_id); out.push(p); } }
  return out;
}

export type FetchJson = (url: string) => Promise<unknown>;

/** Apple catalog client. Pass a fetcher: plain fetch on the phone, the site's cached route on the web. */
export function createApple(fetchJson: FetchJson) {
  const get = async (url: string) => { try { return parseApple(await fetchJson(url)); } catch { return []; } };
  return {
    search: (term: string, kind: AppleKind, limit = 15) => (term.trim().length < 2 ? Promise.resolve([]) : get(appleSearchUrl(term, kind, limit))),
    /** An artist's albums, newest first. */
    discography: async (artistAppleId: number) => (await get(appleLookupUrl(artistAppleId, 'album', 100))).filter(r => r.kind === 'album')
      .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '')),
    /** A podcast's most recent episodes. */
    episodes: async (showAppleId: number, limit = 30) => (await get(appleLookupUrl(showAppleId, 'podcastEpisode', limit))).filter(r => r.kind === 'episode'),
  };
}
export type AppleClient = ReturnType<typeof createApple>;
