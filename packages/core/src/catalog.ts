import { ALBUMS, ARTISTS, GENRES } from './catalog-data.js';
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
