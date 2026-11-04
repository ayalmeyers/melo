import { describe, expect, it } from 'vitest';
import { parseCsv, readHistory } from './history';

const extended = JSON.stringify([
  { ts: '2025-03-01T10:00:00Z', ms_played: 240000, master_metadata_track_name: 'Nights', master_metadata_album_artist_name: 'Frank Ocean', master_metadata_album_album_name: 'Blonde' },
  { ts: '2025-03-02T10:00:00Z', ms_played: 200000, master_metadata_track_name: 'Ivy', master_metadata_album_artist_name: 'Frank Ocean', master_metadata_album_album_name: 'Blonde' },
  { ts: '2025-03-03T10:00:00Z', ms_played: 5000, master_metadata_track_name: 'Skip', master_metadata_album_artist_name: 'Frank Ocean', master_metadata_album_album_name: 'Blonde' },
  { ts: '2025-03-04T10:00:00Z', ms_played: 180000, master_metadata_album_artist_name: 'Tems', master_metadata_album_album_name: 'Born in the Wild' },
  { ts: '2025-03-05T10:00:00Z', ms_played: 1800000, episode_name: 'Ep 1', episode_show_name: 'Switched On Pop' },
]);
const account = JSON.stringify([{ endTime: '2025-01-01 12:00', artistName: 'SZA', trackName: 'Snooze', msPlayed: 200000 }]);
const appleCsv = 'Album Name,Song Name,Artist Name,Event Start Timestamp,Play Duration Milliseconds,Media Type\n"Blonde","Nights","Frank Ocean",2025-04-01T10:00:00Z,240000,AUDIO\n"Blonde","Nikes","Frank Ocean",2025-04-02T10:00:00Z,10000,AUDIO\n"A, Comma","Song ""Quoted""","Someone",2025-04-03T10:00:00Z,100000,AUDIO\n';

describe('history import', () => {
  it('reads Spotify extended history into albums, artists and podcasts', () => {
    const h = readHistory([{ name: 'Streaming_History_Audio_2025.json', text: extended }, { name: 'notes.txt', text: 'x' }])!;
    expect(h.source).toBe('spotify');
    expect(h.plays).toBe(4);
    expect(h.albums[0]).toMatchObject({ title: 'Blonde', artist: 'Frank Ocean', plays: 2, last: '2025-03-02T10:00:00.000Z' });
    expect(h.artists.map(a => a.name)).toEqual(['Frank Ocean', 'Tems']);
    expect(h.shows[0]).toMatchObject({ title: 'Switched On Pop', plays: 1 });
    expect(h.from).toBe('2025-03-01T10:00:00.000Z');
  });
  it('reads Spotify account data (artists only)', () => {
    const h = readHistory([{ name: 'StreamingHistory_music_0.json', text: account }])!;
    expect(h.albums).toHaveLength(0);
    expect(h.artists[0].name).toBe('SZA');
  });
  it('reads Apple Music CSVs with quoted fields', () => {
    expect(parseCsv(appleCsv)[2]['Album Name']).toBe('A, Comma');
    const h = readHistory([{ name: 'Apple Music Play Activity.csv', text: appleCsv }])!;
    expect(h.source).toBe('apple');
    expect(h.albums.map(a => a.title)).toEqual(['Blonde', 'A, Comma']);
    expect(h.albums.find(a => a.title === 'Blonde')!.plays).toBe(1);
  });
  it('reads the Apple daily tracks format (artist inside the description)', () => {
    const daily = 'Track Description,Date Played,Play Duration Milliseconds,Play Count,Media type\nKendrick Lamar - squabble up,20250105,190000,2,AUDIO\n';
    const h = readHistory([{ name: 'Apple Music - Play History Daily Tracks.csv', text: daily }])!;
    expect(h.artists[0]).toMatchObject({ name: 'Kendrick Lamar', plays: 2 });
  });
  it('ignores files it does not understand', () => {
    expect(readHistory([{ name: 'a.json', text: '{"not":"history"}' }, { name: 'b.csv', text: 'x,y\n1,2' }])).toBeNull();
  });
});
