/**
 * Fills in missing images the first time a signed-in person opens a page; everyone after sees them.
 * Albums and podcasts: Apple's artwork, matched by exact title and artist. Artists: a Wikimedia Commons photo.
 */
import type { AppleClient, AppleResult, FetchJson } from './apple';
import type { MeloApi } from './api';
import type { Artist, CatalogItem } from './types';
import { findArtistPhoto } from './images';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '');

/** The Apple result that is clearly the same record: same title (ignoring "(Deluxe)" and punctuation) and same artist. */
export function matchApple(results: AppleResult[], title: string, artist: string): AppleResult | null {
  const t = norm(title), a = norm(artist);
  return results.find(r => norm(r.title) === t && (!a || norm(r.artist) === a || norm(r.artist).includes(a) || a.includes(norm(r.artist))))
    ?? results.find(r => norm(r.title).startsWith(t) && t.length >= 4 && norm(r.artist) === a)
    ?? null;
}

const tried = new Set<string>();

export function createArtworkFixer(api: MeloApi, apple: AppleClient, wikiFetch: FetchJson) {
  return {
    /** Returns the item with art attached, or null when nothing changed. */
    async item(it: CatalogItem): Promise<CatalogItem | null> {
      if (it.artwork_url || it.type === 'episode' || tried.has('i' + it.id)) return null;
      tried.add('i' + it.id);
      if (!(await api.uid())) return null;
      const hits = await apple.search(`${it.title} ${it.artist_name}`, it.type === 'show' ? 'show' : 'album', 10);
      const m = matchApple(hits, it.title, it.type === 'show' ? '' : it.artist_name);
      if (!m) return null;
      try { const id = await api.importApple(m); return id === it.id ? await api.item(id) : null; } catch { return null; }
    },
    /** Returns the artist with a photo attached, or null when nothing changed. */
    async artist(a: Artist): Promise<Artist | null> {
      if (a.image_url || tried.has('a' + a.id)) return null;
      if (a.image_checked_at && Date.now() - Date.parse(a.image_checked_at) < 30 * 864e5) return null;
      tried.add('a' + a.id);
      if (!(await api.uid())) return null;
      const photo = await findArtistPhoto(a.name, wikiFetch);
      try { await api.setArtistImage(a.id, photo); } catch { return null; }
      return photo ? { ...a, image_url: photo.url, image_credit: photo.credit, image_source: photo.source } : null;
    },
  };
}
export type ArtworkFixer = ReturnType<typeof createArtworkFixer>;
