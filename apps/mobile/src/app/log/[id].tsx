import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { cachedItem, fail, go } from '../../lib/hooks';
import { Button, Icon, ItemCover, Stars, T } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function LogSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toast } = useSession();
  const it = cachedItem(id);
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (thenReview = false) => {
    setBusy(true);
    try {
      await api.log(id, rating || null, liked);
      toast('Logged to your diary');
      router.back();
      if (thenReview) setTimeout(() => go(`/compose?kind=review&target=item:${id}`), 300);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return <View style={{ flex: 1, padding: 22, gap: 20, backgroundColor: C.paper }}>
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      {it && <ItemCover item={it} size={64} radius={12} />}
      <View style={{ flex: 1 }}><T.H2>{it?.title ?? 'Log it'}</T.H2><T.Dim>{it?.artist_name}</T.Dim></View>
    </View>
    <View style={{ gap: 8, alignItems: 'center' }}>
      <Stars r10={rating} size={44} color={C.blue} onChange={setRating} />
      <T.Dim>{rating ? `${(rating / 2).toFixed(1)} stars` : 'Drag to rate, or skip'}</T.Dim>
    </View>
    <Pressable onPress={() => setLiked(!liked)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' }}>
      <Icon name={liked ? 'heart.fill' : 'heart'} size={28} color={liked ? '#e0245e' : C.dim} /><Text style={{ fontFamily: F.semibold, fontSize: 16, color: C.text }}>{liked ? 'Loved it' : 'Love it?'}</Text>
    </Pressable>
    <Button title="Log" loading={busy} onPress={() => save(false)} />
    <Button kind="ghost" title="Log and write a review" onPress={() => save(true)} disabled={!rating} />
  </View>;
}
