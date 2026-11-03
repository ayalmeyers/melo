import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ago, flag, genreName, LIMITS, mmss, parseTimestamp, starsText, type Target } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { fail, go, rememberItem, shareLink, useLoad } from '../../lib/hooks';
import { Screen, Seg } from '../../components/screen';
import { moderate, PostList } from '../../components/post';
import { WikiBox } from '../../components/social';
import { ItemRow } from '../../components/rows';
import { Band, Button, Empty, Icon, Input, ItemCover, Sheet, T } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, toast } = useSession();
  const [tab, setTab] = useState<'reviews' | 'threads' | 'moments' | 'about'>('reviews');
  const item = useLoad(async () => { const it = await api.item(id); if (it) rememberItem(it); return it; }, [id]);
  const rating = useLoad(async () => (await api.ratings([id]))[id] ?? null, [id]);
  const posts = useLoad(() => api.feed('hot', { target: { type: 'item', id }, limit: 60 }), [id]);
  const episodes = useLoad(() => (item.data?.type === 'show' ? api.itemsBy({ show: id }, 100) : Promise.resolve([])), [id, item.data?.type]);
  const moments = useLoad(() => api.moments(id), [id]);
  const [mBody, setMBody] = useState(''); const [mT, setMT] = useState('');

  const it = item.data;
  if (item.loading && !it) return <Screen top={false}><Band><T.Dim>Loading…</T.Dim></Band></Screen>;
  if (!it) return <Screen top={false}><Band><T.Display>Not found.</T.Display></Band><Sheet><Empty text="This album or episode isn't on Melo." /></Sheet></Screen>;
  const target: Target = { type: 'item', id };
  const reviews = (posts.data ?? []).filter(p => p.kind === 'review');
  const threads = (posts.data ?? []).filter(p => p.kind !== 'review');
  const q = encodeURIComponent(`${it.title} ${it.artist_name}`);
  const hist = rating.data?.histogram ?? [];
  const max = Math.max(1, ...hist);

  const addMoment = async () => {
    if (!user) return go('/login');
    const t = parseTimestamp(mT); if (t == null) return toast('Use a time like 1:23');
    if (!mBody.trim()) return;
    try { await api.addMoment(id, t, mBody.trim()); setMBody(''); setMT(''); moments.reload(); } catch (e) { fail(e); }
  };

  return <Screen top={false} keyboard onRefresh={() => Promise.all([rating.reload(), posts.reload(), moments.reload()])}>
    <Stack.Screen options={{ title: '', headerRight: () => <Pressable hitSlop={10} onPress={() => shareLink(`/album/${id}`, `${it.title} by ${it.artist_name} on Melo`)}><Icon name="square.and.arrow.up" size={20} color="#fff" /></Pressable> }} />
    <Band>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <ItemCover item={it} size={132} radius={18} />
        <View style={{ flex: 1, gap: 6, justifyContent: 'flex-end' }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 12.5, letterSpacing: 1, color: C.blue, textTransform: 'uppercase' }}>{it.type === 'show' ? 'Podcast' : it.type === 'episode' ? 'Episode' : 'Album'}</Text>
          <Text style={{ fontFamily: F.bold, fontSize: 24, lineHeight: 27, color: '#fff' }} numberOfLines={3}>{it.title}</Text>
          <Text onPress={() => it.artist_id ? go(`/artist/${it.artist_id}`) : it.show_id ? go(`/item/${it.show_id}`) : undefined} style={{ fontFamily: F.semibold, fontSize: 15.5, color: C.onInk }}>{it.artist_name}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: C.onInkDim }}>{[it.year, genreName(it.genre), flag(it.cc)].filter(Boolean).join(' · ')}{it.dur_min ? ` · ${it.dur_min} min` : ''}</Text>
        </View>
      </View>
      {it.type !== 'show' && <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
        <View><Text style={{ fontFamily: F.heavy, fontSize: 34, color: '#fff' }}>{rating.data ? starsText(Math.round(rating.data.avg_stars * 2)) : '—'}</Text><Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.onInkDim }}>{rating.data ? `${rating.data.n} ratings` : 'No ratings yet'}</Text></View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 }}>
          {Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: Math.max(3, ((hist[i] ?? 0) / max) * 44), backgroundColor: C.blue, opacity: 0.35 + (i / 10) * 0.65, borderRadius: 2 }} />)}
        </View>
      </View>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {it.type !== 'show' && <Button style={{ flex: 1 }} title="Log" icon="plus" onPress={() => go(user ? `/log/${id}` : '/login')} />}
        <Button style={{ flex: 1 }} kind="dark" title={it.type === 'show' ? 'Start a thread' : 'Review'} icon="square.and.pencil" onPress={() => go(user ? `/compose?kind=${it.type === 'show' ? 'thread' : 'review'}&target=item:${id}` : '/login')} />
        <Button kind="dark" title="" icon="paperplane" accessibilityLabel="Send in a chat" onPress={() => go(`/chats/new?share=item:${id}`)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button small kind="dark" style={{ flex: 1 }} title="Spotify" icon="play.circle" onPress={() => Linking.openURL(`https://open.spotify.com/search/${q}`)} />
        <Button small kind="dark" style={{ flex: 1 }} title="Apple Music" icon="music.note" onPress={() => Linking.openURL(it.type === 'album' ? `https://music.apple.com/search?term=${q}` : `https://podcasts.apple.com/search?term=${q}`)} />
      </View>
      <Seg value={tab} onChange={setTab} options={[['reviews', `Reviews ${reviews.length || ''}`], ['threads', `Board ${threads.length || ''}`], ['moments', 'Moments'], ['about', it.type === 'show' ? 'Episodes' : 'Wiki']]} />
    </Band>
    <Sheet>
      {tab === 'reviews' && <PostList posts={posts.data ? reviews : null} hideTarget empty="No reviews yet. Write the first one." />}
      {tab === 'threads' && <>
        <Button kind="ghost" title="Post to this board" icon="plus" onPress={() => go(user ? `/compose?kind=thread&target=item:${id}` : '/login')} />
        <PostList posts={posts.data ? threads : null} hideTarget empty="No threads or takes yet." />
      </>}
      {tab === 'moments' && <>
        <T.Dim>Timestamped reactions. The moment the beat drops, the line that got you.</T.Dim>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input value={mT} onChangeText={setMT} placeholder="1:23" keyboardType="numbers-and-punctuation" style={{ width: 80 }} />
          <Input value={mBody} onChangeText={setMBody} placeholder="What happens here?" maxLength={LIMITS.moment} style={{ flex: 1 }} returnKeyType="send" onSubmitEditing={addMoment} />
        </View>
        {moments.data && !moments.data.length ? <Empty text="No moments yet." /> : (moments.data ?? []).map(m => <Pressable key={m.id} onLongPress={() => moderate({ kind: 'moment', id: m.id, authorId: m.author, mine: m.author === user?.id, onDeleted: () => api.deleteMoment(m.id).then(moments.reload).catch(fail), onBlocked: moments.reload })} style={{ flexDirection: 'row', gap: 12 }}>
          <Text style={{ fontFamily: F.bold, color: C.blue, fontSize: 15, width: 52 }}>{mmss(m.t_seconds)}</Text>
          <View style={{ flex: 1 }}><T.Body>{m.body}</T.Body><T.Dim>{ago(m.created_at)}</T.Dim></View>
        </Pressable>)}
      </>}
      {tab === 'about' && (it.type === 'show'
        ? <>{episodes.data && !episodes.data.length ? <Empty text="No episodes added yet." /> : (episodes.data ?? []).map(e => <ItemRow key={e.id} it={e} />)}
          <Button kind="ghost" title="Add an episode" icon="plus" onPress={() => go(`/add-item?type=episode&show=${id}`)} /></>
        : <WikiBox wkey={`a:${id}`} />)}
    </Sheet>
  </Screen>;
}
