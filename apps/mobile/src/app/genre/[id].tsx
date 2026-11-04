import { useLocalSearchParams } from 'expo-router';
import { ARTISTS, GENRES } from '@melo/core';
import { api } from '../../lib/supabase';
import { loadGenreArt, useLoad } from '../../lib/hooks';
import { Board } from '../../components/board';
import { Screen } from '../../components/screen';
import { Band, GenreCover, T } from '../../components/ui';

export default function GenreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = GENRES[id];
  const artists = useLoad(() => api.artistsByGenre(id, 200), [id]);
  const art = useLoad(() => loadGenreArt(), []);
  if (!g) return <Screen top={false}><Band><T.Display>Not found.</T.Display></Band></Screen>;
  const n = artists.data?.length ?? Object.values(ARTISTS).filter(a => a.genres.includes(id)).length;
  return <Board kind="genre" id={id} name={g.name} sub={`${n} artists`} art={<GenreCover key={art.loading ? 'g' : 'G'} id={id} size={96} radius={20} />}
    wikiKey={`g:${id}`} wikiFallback={g.wiki} sharePath={`/genre/${id}`} items={() => api.itemsBy({ genre: id }, 100)} />;
}
