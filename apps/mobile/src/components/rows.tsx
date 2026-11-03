import { Pressable, Text, View } from 'react-native';
import { flag, type CatalogItem, type Forecast, type ForecastConsensus } from '@melo/core';
import { go, rememberItem } from '../lib/hooks';
import { ItemCover, T } from './ui';
import { C, F } from './theme';

export function ItemRow({ it, right }: { it: CatalogItem; right?: React.ReactNode }) {
  return <Pressable onPress={() => { rememberItem(it); go(`/item/${it.id}`); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <ItemCover item={it} size={56} radius={10} />
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }} numberOfLines={1}>{it.title}</Text>
      <T.Dim numberOfLines={1}>{it.artist_name}{it.year ? ` · ${it.year}` : ''} {flag(it.cc)}</T.Dim>
    </View>
    {right}
  </Pressable>;
}

export function ForecastCard({ f }: { f: Forecast & { c: ForecastConsensus | null } }) {
  const p = f.c?.crowd_p;
  return <Pressable onPress={() => go(`/forecast/${f.id}`)} style={{ backgroundColor: C.mist, borderRadius: 22, padding: 16, gap: 12 }}>
    <Text style={{ fontFamily: F.bold, fontSize: 18, lineHeight: 23, color: C.text }}>{f.question}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' }}><View style={{ width: `${p ?? 0}%`, height: '100%', backgroundColor: f.c?.outcome ? (f.c.outcome === 'yes' ? C.good : C.bad) : C.blue }} /></View>
      <Text style={{ fontFamily: F.heavy, fontSize: 22, color: C.text, minWidth: 54, textAlign: 'right' }}>{p == null ? '—' : p + '%'}</Text>
    </View>
    <T.Dim>{f.c?.outcome ? `Resolved ${f.c.outcome.toUpperCase()}` : `Closes ${new Date(f.closes_on).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`} · {f.c?.forecasters ?? 0} forecasters</T.Dim>
  </Pressable>;
}

