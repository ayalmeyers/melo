import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ago, appleArt, flag, genreName, LIMITS, mmss, parseTimestamp, starsText, type Target } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { fail, go, rememberItem, shareMenu, useLoad } from '../../lib/hooks';
import { Screen, Seg } from '../../components/screen';
import { moderate, PostList } from '../../components/post';
import { WikiBox } from '../../components/social';
import { ItemRow } from '../../components/rows';
import { AppleSection } from '../../components/apple';
import { ListCardView } from '../../components/lists';
import { apple } from '../../lib/apple';
import { artwork } from '../../lib/artwork';
import { Band, Button, Card, Empty, Icon, Input, ItemCover, Sheet, Stars, T } from '../../components/ui';
import { C, F, shadow } from '../../components/theme';
import { ErrorView, Loading, Shimmer } from '../../components/skeleton';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, toast } = useSession();
  const [tab, setTab] = useState<'reviews' | 'threads' | 'moments' | 'about'>('reviews');
  const item = useLoad(async () => { const it = await api.item(id); if (it) rememberItem(it); return it; }, [id]);
  // Starter albums and hand-added items pick up Apple's artwork the first time someone signed in opens them.
  useEffect(() => { if (item.data) artwork.item(item.data).then(next => { if (next) { rememberItem(next); item.setData(next); } }); }, [item.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rating = useLoad(async () => (await api.ratings([id]))[id] ?? null, [id]);
  const posts = useLoad(() => api.feed('hot', { target: { type: 'item', id }, limit: 60 }), [id]);
  const episodes = useLoad(() => (item.data?.type === 'show' ? api.itemsBy({ show: id }, 100) : Promise.resolve([])), [id, item.data?.type]);
  // A podcast's newest episodes straight from Apple; tapping one adds it to Melo.
  const latest = useLoad(async () => {
    const show = item.data;
    if (!show || show.type !== 'show') return null;
    let appleId = show.apple_id ?? null;
    if (!appleId) appleId = (await apple.search(show.title, 'show', 5)).find(r => r.title.toLowerCase() === show.title.toLowerCase())?.apple_id ?? null;
    return appleId ? apple.episodes(appleId, 25) : [];
  }, [id, item.data?.type]);
  const inLists = useLoad(() => api.lists({ containing: id, limit: 10 }), [id]);
  const moments = useLoad(() => api.moments(id), [id]);
  const [mBody, setMBody] = useState(''); const [mT, setMT] = useState('');

  const it = item.data;
  if (item.error && !it) return <Screen top={false}><Sheet style={{ marginTop: 0 }}><ErrorView message={item.error} onRetry={item.reload} /></Sheet></Screen>;
  if (item.loading && !it) return <Screen top={false}><Band><View style={{ flexDirection: 'row', gap: 16 }}><Shimmer w={132} h={132} r={18} dark /><View style={{ flex: 1, gap: 10, justifyContent: 'flex-end' }}><Shimmer w="40%" h={11} dark /><Shimmer w="85%" h={24} dark /><Shimmer w="55%" h={14} dark /></View></View></Band><Sheet><Loading kind="post" n={2} /></Sheet></Screen>;
  if (!it) return <Screen top={false}><Band><T.Display>Not found.</T.Display></Band><Sheet><Empty text="This album or episode isn't on Melo." /></Sheet></Screen>;
  const target: Target = { type: 'item', id };
  const reviews = (posts.data ?? []).filter(p => p.kind === 'review');
  const threads = (posts.data ?? []).filter(p => p.kind !== 'review');
  const q = encodeURIComponent(`${it.title} ${it.artist_name}`);
  const hist = rating.data?.histogram ?? [];
  const max = Math.max(1, ...hist);
  const art = it.artwork_url;

  const addMoment = async () => {
    if (!user) return go('/login');
    const t = parseTimestamp(mT); if (t == null) return toast('Use a time like 1:23');
    if (!mBody.trim()) return;
    try { await api.addMoment(id, t, mBody.trim()); setMBody(''); setMT(''); moments.reload(); } catch (e) { fail(e); }
  };

  return <Screen top={false} keyboard onRefresh={() => Promise.all([rating.reload(), posts.reload(), moments.reload()])}>
    <Stack.Screen options={{ title: '', headerRight: () => <Pressable hitSlop={10} accessibilityLabel="Share" onPress={() => shareMenu({ path: `/album/${id}`, storyPath: `/album/${id}/story`, message: `${it.title} by ${it.artist_name} on Melo` })}><Icon name="square.and.arrow.up" size={20} color={C.text} /></Pressable> }} />
    <Band style={{ alignItems: 'center', gap: 16, paddingTop: 4 }}>
      {!!art && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -120, height: 420, overflow: 'hidden' }}>
        <Image source={{ uri: appleArt(art, 200) }} blurRadius={60} style={{ position: 'absolute', inset: 0, opacity: 0.55 } as never} contentFit="cover" />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, backgroundColor: C.bg, opacity: 0.85 }} />
      </View>}
      <View style={[{ borderRadius: 22 }, shadow(2)]}><ItemCover item={it} size={210} radius={22} /></View>
      <View style={{ alignItems: 'center', gap: 4, paddingHorizontal: 8 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 12, letterSpacing: 1, color: C.blue, textTransform: 'uppercase' }}>{it.type === 'show' ? 'Podcast' : it.type === 'episode' ? 'Episode' : 'Album'}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: F.heavy, fontSize: 28, lineHeight: 32, color: C.text, textAlign: 'center', letterSpacing: -0.6 }} numberOfLines={3}>{it.title}</Text>
        <Text onPress={() => it.artist_id ? go(`/artist/${it.artist_id}`) : it.show_id ? go(`/item/${it.show_id}`) : undefined} style={{ fontFamily: F.bold, fontSize: 16.5, color: C.blue }}>{it.artist_name}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: C.dim }}>{[it.year, genreName(it.genre), flag(it.cc)].filter(Boolean).join(' · ')}{it.dur_min ? ` · ${it.dur_min} min` : ''}</Text>
      </View>
    </Band>
    <Band>
      {it.type !== 'show' && <Card style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
        <View><Text style={{ fontFamily: F.heavy, fontSize: 36, color: C.text, letterSpacing: -1 }}>{rating.data ? rating.data.avg_stars.toFixed(1) : '—'}</Text>{rating.data && <Stars r10={Math.round(rating.data.avg_stars * 2)} size={12} />}<Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.dim, marginTop: 4 }}>{rating.data ? `${rating.data.n} ratings` : 'No ratings yet'}</Text></View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 56 }}>
          {Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: Math.max(4, ((hist[i] ?? 0) / max) * 56), backgroundColor: C.blue, opacity: 0.25 + (i / 10) * 0.75, borderRadius: 4 }} />)}
        </View>
      </Card>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {it.type !== 'show' && <Button style={{ flex: 1 }} title="Log" icon="plus" onPress={() => go(user ? `/log/${id}` : '/login')} />}
        <Button style={{ flex: 1 }} kind="dark" title={it.type === 'show' ? 'Start a thread' : 'Review'} icon="square.and.pencil" onPress={() => go(user ? `/compose?kind=${it.type === 'show' ? 'thread' : 'review'}&target=item:${id}` : '/login')} />
        <Button kind="dark" title="" icon="text.badge.plus" accessibilityLabel="Add to a list" onPress={() => go(user ? `/add-to-list/${id}` : '/login')} />
        <Button kind="dark" title="" icon="paperplane" accessibilityLabel="Send in a chat" onPress={() => go(`/chats/new?share=item:${id}`)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button small kind="dark" style={{ flex: 1 }} title="Spotify" icon="play.circle" onPress={() => Linking.openURL(`https://open.spotify.com/search/${q}`)} />
        <Button small kind="dark" style={{ flex: 1 }} title={it.type === 'album' ? 'Apple Music' : 'Apple Podcasts'} icon="music.note" onPress={() => Linking.openURL(it.apple_url ?? (it.type === 'album' ? `https://music.apple.com/search?term=${q}` : `https://podcasts.apple.com/search?term=${q}`))} />
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
        ? <>{!!episodes.data?.length && <T.H2>On Melo</T.H2>}
          {(episodes.data ?? []).map(e => <ItemRow key={e.id} it={e} />)}
          <AppleSection title="Latest episodes" results={latest.data ?? null} have={new Set((episodes.data ?? []).map(e => e.id))} />
          {episodes.data && !episodes.data.length && latest.data && !latest.data.length && <Empty text="No episodes yet." />}
          <Button kind="ghost" title="Add an episode" icon="plus" onPress={() => go(`/add-item?type=episode&show=${id}`)} /></>
        : <WikiBox wkey={`a:${id}`} />)}
      {!!inLists.data?.length && <View style={{ gap: 12 }}><T.H2>On lists</T.H2>{inLists.data.map(l => <ListCardView key={l.id} l={l} />)}</View>}
    </Sheet>
  </Screen>;
}
