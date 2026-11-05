import { ALBUMS, ARTISTS, GENRES } from './catalog-data.js';
import { CATALOG_ART } from './catalog-art.js';
import { cover, type Cover, type Motif } from './cover';
import type { CatalogItem } from './types';

const LOOKS: Record<string, { motif?: Motif; glyph?: string; pal?: [string, string, string] }> = {};
for (const row of ALBUMS) { const look = row[6]; if (look) LOOKS[row[0]] = look as never; }

export const itemCover = (it: Pick<CatalogItem, 'id' | 'title' | 'type'>): Cover => cover(it.id, it.title, { ...LOOKS[it.id], episode: it.type === 'episode' });
export const artistCover = (id: string, name?: string): Cover => cover('artist-' + id, name ?? ARTISTS[id]?.name ?? id, { motif: 'rings' });
export const genreCover = (id: string): Cover => cover('genre-' + id, GENRES[id]?.name ?? id);
export const genreName = (id: string | null | undefined) => (id && GENRES[id]?.name) || '';
export const artistName = (id: string) => ARTISTS[id]?.name ?? id;
export { ARTISTS, GENRES };

/* Real artwork bundled with the app (scripts/build-catalog.mts), so the starting catalog never shows a placeholder. */
const EXTRA_ART = new Map<string, string>([...CATALOG_ART.extraAlbums, ...CATALOG_ART.extraShows].map(e => [e.id, e.art.artwork_url]));
export const seedItemArt = (id: string): string | undefined => CATALOG_ART.items[id]?.artwork_url ?? EXTRA_ART.get(id);
/** A Commons photo when there is one, else the artist's newest cover. */
export const seedArtistArt = (id: string): string | undefined => CATALOG_ART.artists[id]?.image_url ?? CATALOG_ART.artists[id]?.artwork_url;
export { CATALOG_ART };
/** Up to four bundled covers for a genre, newest charting records last, for the genre mosaic. */
export function seedGenreArt(genre: string): string[] {
  const out: string[] = [];
  for (const row of ALBUMS) if (row[4] === genre) { const u = CATALOG_ART.items[row[0] as string]?.artwork_url; if (u) out.push(u); }
  for (const e of CATALOG_ART.extraAlbums) if (e.genre === genre) out.push(e.art.artwork_url);
  return out.slice(0, 4);
}
