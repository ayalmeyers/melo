export interface SeedItemArt { apple_id: number; artwork_url: string; apple_url?: string; release_date?: string; track_count?: number }
export interface SeedArtistArt { apple_id?: number; image_url?: string; image_credit?: string; image_source?: string; artwork_url?: string }
export interface SeedExtraAlbum { id: string; title: string; artist_id: string; artist_name: string; artist_apple_id?: number; year: number | null; genre: string | null; art: SeedItemArt; charts: string[] }
export interface SeedExtraShow { id: string; title: string; host: string; art: SeedItemArt; charts: string[] }
export interface SeedExtraArtist { id: string; name: string; apple_id: number; genres: string[] }
export declare const CATALOG_ART: {
  built: string | null;
  items: Record<string, SeedItemArt>;
  artists: Record<string, SeedArtistArt>;
  extraAlbums: SeedExtraAlbum[];
  extraShows: SeedExtraShow[];
  extraArtists: SeedExtraArtist[];
};
