import { describe, expect, it } from 'vitest';
import { appleArt, appleMeloId, appleSearchUrl, createApple, parseApple } from './apple';

// Shapes follow Apple's documented Search API responses.
const albums = { resultCount: 3, results: [
  { wrapperType: 'collection', collectionType: 'Album', artistId: 1235597, collectionId: 1146195596, artistName: 'Frank Ocean', collectionName: 'Blonde',
    collectionViewUrl: 'https://music.apple.com/us/album/blonde/1146195596?uo=4', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/aa/bb/cc/x.jpg/100x100bb.jpg',
    trackCount: 17, country: 'USA', releaseDate: '2016-08-20T07:00:00Z', primaryGenreName: 'R&B/Soul' },
  { wrapperType: 'collection', collectionType: 'Album', artistId: 1, collectionId: 2, artistName: 'X', collectionName: 'Nikes - Single', artworkUrl100: 'https://is1-ssl.mzstatic.com/a/100x100bb.jpg' },
  { wrapperType: 'track', kind: 'song', trackId: 3, trackName: 'Nights' },
] };
const podcasts = { results: [{ wrapperType: 'track', kind: 'podcast', collectionId: 934552872, trackId: 934552872, artistName: 'Vulture', collectionName: 'Switched On Pop',
  artworkUrl600: 'https://is2-ssl.mzstatic.com/image/thumb/Podcasts/x/600x600bb.jpg', collectionViewUrl: 'https://podcasts.apple.com/us/podcast/id934552872', trackCount: 400, primaryGenreName: 'Music' }] };
const episodes = { results: [
  { wrapperType: 'track', kind: 'podcast', collectionId: 934552872, collectionName: 'Switched On Pop' },
  { wrapperType: 'podcastEpisode', kind: 'podcast-episode', trackId: 1000650000001, trackName: 'Why Everyone Is Covering This Song', collectionId: 934552872,
    collectionName: 'Switched On Pop', trackTimeMillis: 2580000, releaseDate: '2026-10-28T09:00:00Z', artworkUrl600: 'https://is3-ssl.mzstatic.com/x/600x600bb.jpg',
    trackViewUrl: 'https://podcasts.apple.com/us/podcast/x/id934552872?i=1000650000001' },
] };

describe('apple catalog', () => {
  it('keeps albums, drops singles and songs, upsizes art', () => {
    const r = parseApple(albums);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'album', apple_id: 1146195596, title: 'Blonde', artist: 'Frank Ocean', artist_apple_id: 1235597, track_count: 17, genre: 'R&B/Soul' });
    expect(r[0].artwork).toBe('https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/aa/bb/cc/x.jpg/600x600bb.jpg');
    expect(appleMeloId(r[0])).toBe('am1146195596');
  });
  it('parses podcasts and episodes with their show', () => {
    expect(parseApple(podcasts)[0]).toMatchObject({ kind: 'show', apple_id: 934552872, title: 'Switched On Pop' });
    const ep = parseApple(episodes);
    expect(ep).toHaveLength(2);
    expect(ep[1]).toMatchObject({ kind: 'episode', show_apple_id: 934552872, dur_min: 43 });
    expect(appleMeloId(ep[1])).toBe('ep1000650000001');
  });
  it('builds URLs and survives bad responses', async () => {
    expect(appleSearchUrl('bad bunny', 'album')).toBe('https://itunes.apple.com/search?term=bad+bunny&entity=album&media=music&limit=15&country=US');
    expect(appleSearchUrl("Don't (Live)", 'album')).toMatch(/^https:\/\/itunes\.apple\.com\/(search|lookup)\?[\w=&+%.,-]+$/);
    expect(appleArt('https://is1-ssl.mzstatic.com/x/100x100bb.png', 300)).toBe('https://is1-ssl.mzstatic.com/x/300x300bb.jpg');
    const apple = createApple(async () => { throw new Error('offline'); });
    expect(await apple.search('blonde', 'album')).toEqual([]);
    expect(parseApple('nonsense')).toEqual([]);
    const eps = await createApple(async () => episodes).episodes(934552872);
    expect(eps.map(e => e.kind)).toEqual(['episode']);
  });
});
