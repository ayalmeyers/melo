import { useLocalSearchParams } from 'expo-router';
import { ARTISTS, countryName, flag, genreName } from '@melo/core';
import { api } from '../../lib/supabase';
import { Board } from '../../components/board';
import { Screen } from '../../components/screen';
import { ArtistCover, Band, T } from '../../components/ui';

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = ARTISTS[id];
  if (!a) return <Screen top={false}><Band><T.Display>Not found.</T.Display></Band></Screen>;
  return <Board kind="artist" id={id} name={a.name} sub={`${flag(a.cc)} ${countryName(a.cc)} · ${a.genres.map(genreName).filter(Boolean).join(', ')}`}
    art={<ArtistCover id={id} size={96} />} wikiKey={`r:${id}`} wikiFallback={a.wiki} sharePath={`/artist/${id}`}
    items={() => api.itemsBy({ artist: id }, 100)} />;
}
