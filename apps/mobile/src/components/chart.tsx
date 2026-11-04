import { Pressable, Text, View } from 'react-native';
import { type Artist, type CatalogItem, type ChartKind, type ChartRow, type ChartScope } from '@melo/core';
import { api } from '../lib/supabase';
import { go, loadArtists, rememberItem, cachedArtist, cachedItem } from '../lib/hooks';
import { ArtistCover, ItemCover, T } from './ui';
import { C, F } from './theme';

/** Loads a chart and the albums/artists it names. */
export async function loadChart(scope: ChartScope, kind: ChartKind, limit = 50): Promise<ChartRow[]> {
  const rows = await api.chart(scope, kind, 7, limit);
  if (kind === 'artists') await loadArtists(rows.map(r => r.subject_id));
  else (await api.items(rows.map(r => r.subject_id))).forEach(rememberItem);
  return rows;
}

/** ▲ climbed, ▼ fell, NEW first week on the chart, – held. */
export function Move({ r }: { r: ChartRow }) {
  if (r.prev_rank == null) return <Text style={{ fontFamily: F.heavy, fontSize: 10.5, color: C.blue, letterSpacing: 0.5 }}>NEW</Text>;
  const d = r.prev_rank - r.rank;
  if (d === 0) return <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.dim }}>–</Text>;
  return <Text style={{ fontFamily: F.bold, fontSize: 12, color: d > 0 ? C.good : C.bad }}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</Text>;
}

export function ChartRowView({ r }: { r: ChartRow }) {
  const isArtist = r.subject_type === 'artist';
  const it: CatalogItem | undefined = isArtist ? undefined : cachedItem(r.subject_id);
  const a: Artist | undefined = isArtist ? cachedArtist(r.subject_id) : undefined;
  const title = isArtist ? a?.name ?? 'Artist' : it?.title ?? '…';
  const sub = [isArtist ? '' : it?.artist_name, `${r.listeners} ${r.listeners === 1 ? 'listener' : 'listeners'}`, r.avg_rating != null ? `★ ${Number(r.avg_rating).toFixed(1)}` : ''].filter(Boolean).join(' · ');
  return <Pressable onPress={() => go(isArtist ? `/artist/${r.subject_id}` : `/item/${r.subject_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 34, alignItems: 'center' }}>
      <Text style={{ fontFamily: F.heavy, fontSize: r.rank < 10 ? 22 : 18, color: r.rank === 1 ? C.blue : C.text }}>{r.rank}</Text>
      <Move r={r} />
    </View>
    {isArtist ? <ArtistCover id={r.subject_id} size={54} /> : it ? <ItemCover item={it} size={54} radius={10} /> : <View style={{ width: 54, height: 54 }} />}
    <View style={{ flex: 1 }}><T.Bold numberOfLines={1}>{title}</T.Bold><T.Dim numberOfLines={1}>{sub}</T.Dim></View>
  </Pressable>;
}
