import { useEffect } from 'react';
import { Linking, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ARTISTS, countryName, flag, genreName, type AppleResult, type Artist } from '@melo/core';
import { api } from '../../lib/supabase';
import { apple } from '../../lib/apple';
import { rememberArtist, useLoad } from '../../lib/hooks';
import { artwork } from '../../lib/artwork';
import { Board } from '../../components/board';
import { AppleSection } from '../../components/apple';
import { Screen } from '../../components/screen';
import { ArtistCover, Band, T } from '../../components/ui';

/** Albums by this artist on Apple Music: by Apple id when Melo has it, else by name. */
async function discography(a: Artist): Promise<AppleResult[]> {
  if (a.apple_id) return apple.discography(a.apple_id);
  const hits = await apple.search(a.name, 'album', 50);
  const same = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return hits.filter(h => same(h.artist) === same(a.name)).sort((x, y) => (y.release_date ?? '').localeCompare(x.release_date ?? ''));
}

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useLoad(async () => {
    const row = await api.artist(id).catch(() => null);
    const seeded = ARTISTS[id];
    const out: Artist | null = row ?? (seeded ? { id, name: seeded.name, cc: seeded.cc, genres: seeded.genres } : null);
    if (out) rememberArtist(out);
    return out;
  }, [id]);
  // First visit by a signed-in person looks up a photo for everyone.
  useEffect(() => {
    if (!a.data) return;
    artwork.artist(a.data).then(next => { if (next) { rememberArtist(next); a.setData(next); } });
  }, [a.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const more = useLoad(async () => (a.data ? discography(a.data) : []), [a.data?.id]);

  if (!a.data) return <Screen top={false}><Band><T.Display>{a.loading ? '' : 'Not found.'}</T.Display></Band></Screen>;
  const art = a.data;
  const where = art.cc ? `${flag(art.cc)} ${countryName(art.cc)}` : '';
  const genres = art.genres.map(genreName).filter(Boolean).join(', ');
  return <Board kind="artist" id={id} name={art.name} sub={[where, genres].filter(Boolean).join(' · ') || 'Artist'}
    art={<ArtistCover id={id} art={art.image_url ?? art.artwork_url} size={96} />}
    credit={art.image_credit ? <Text onPress={() => art.image_source && Linking.openURL(art.image_source)} style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }} numberOfLines={1}>{art.image_credit}</Text> : undefined} wikiKey={`r:${id}`} wikiFallback={ARTISTS[id]?.wiki ?? ''} sharePath={`/artist/${id}`}
    items={() => api.itemsBy({ artist: id }, 100)}
    recordsExtra={have => <AppleSection title="More on Apple Music" results={more.data?.filter(r => !have.has('am' + r.apple_id)) ?? null} />} />;
}
