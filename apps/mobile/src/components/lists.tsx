import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { appleArt, itemCover, type ListCard } from '@melo/core';
import { go } from '../lib/hooks';
import { Cover, T } from './ui';
import { C, F } from './theme';

/** A list shown as its first four covers, fanned like a stack of records. */
export function ListCardView({ l, showOwner = true }: { l: ListCard; showOwner?: boolean }) {
  const s = 64;
  return <Pressable onPress={() => go(`/list/${l.id}`)} style={{ backgroundColor: C.mist, borderRadius: 20, padding: 14, gap: 10 }}>
    <View style={{ flexDirection: 'row', height: s }}>
      {l.preview.length ? l.preview.map((p, i) => <View key={p.id} style={{ marginLeft: i ? -18 : 0, zIndex: 4 - i, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: C.mist }}>
        {p.artwork_url ? <Image source={{ uri: appleArt(p.artwork_url, 200) }} style={{ width: s, height: s }} contentFit="cover" /> : <Cover cover={itemCover(p)} size={s} radius={0} />}
      </View>) : <View style={{ width: s, height: s, borderRadius: 10, backgroundColor: C.line }} />}
    </View>
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 16.5, color: C.text }} numberOfLines={2}>{l.title}</Text>
      <T.Dim numberOfLines={1}>{showOwner ? `${l.owner_name} · ` : ''}{l.item_count} {l.item_count === 1 ? 'record' : 'records'}{l.ranked ? ' · ranked' : ''}</T.Dim>
    </View>
  </Pressable>;
}
