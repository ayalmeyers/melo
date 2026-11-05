import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ago, type FeedMode, type LogEntry, type Profile, type Target } from '@melo/core';
import { api, configured } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { go, loadItems, useLoad } from '../../lib/hooks';
import { Screen, Seg } from '../../components/screen';
import { PostList } from '../../components/post';
import { Avatar, Band, Button, Icon, ItemCover, Sheet, T } from '../../components/ui';
import { C, F, shadow } from '../../components/theme';
import { ErrorView } from '../../components/skeleton';

const PAGE = 30;
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/** "Listening now": the latest thing each person you follow logged this week, cover first. */
function Listening({ ids }: { ids: string[] }) {
  const row = useLoad(async () => {
    if (!ids.length) return null;
    const logs = await api.recentLogs(ids, 15);
    const [people] = await Promise.all([api.profilesByIds(logs.map(l => l.user_id)), loadItems(logs.map(l => l.item_id))]);
    const byId = Object.fromEntries(people.map(p => [p.id, p]));
    return logs.map(l => ({ log: l, who: byId[l.user_id] as Profile | undefined })).filter(x => x.who);
  }, [ids.join(',')]);
  if (!row.data?.length) return null;
  return <View style={{ gap: 10, marginTop: 18 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20 }}>
      <View style={s.live} /><Text style={s.rowTitle}>Friends are listening</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
      {row.data.map(({ log, who }) => <NowCard key={log.id} log={log} who={who!} />)}
    </ScrollView>
  </View>;
}
function NowCard({ log, who }: { log: LogEntry; who: Profile }) {
  return <Pressable onPress={() => go(`/item/${log.item_id}`)} style={{ width: 92, gap: 6 }} accessibilityLabel={`${who.name} listened ${ago(log.listened_at)} ago`}>
    <View style={[{ borderRadius: 18 }, shadow(1)]}>
      <ItemCover item={{ id: log.item_id, title: '', type: 'album' }} size={92} radius={18} />
      <View style={s.nowAvatar}><Avatar name={who.name} color={who.color} size={28} /></View>
    </View>
    <Text style={s.nowName} numberOfLines={1}>{who.name.split(' ')[0]}</Text>
  </Pressable>;
}

export default function Home() {
  const { user, profile, follows, ready } = useSession();
  const [mode, setMode] = useState<FeedMode>('hot');
  // Paging: each "Load more" asks for one more page of 30 (up to 300), keeping the order stable.
  const [pages, setPages] = useState(1);
  const limit = PAGE * pages;
  const feed = useLoad(async () => {
    if (!configured || !ready) return null;
    if (mode !== 'following') return api.feed(mode, { limit });
    const targets: Target[] = [...[...follows.artists].map(id => ({ type: 'artist' as const, id })), ...[...follows.genres].map(id => ({ type: 'genre' as const, id }))];
    return api.feed('following', { authors: user ? [...follows.users, user.id] : [], targets, limit });
  }, [mode, ready, follows, user, limit]);
  const first = profile?.name.split(' ')[0];

  return <Screen onRefresh={() => { setPages(1); return feed.reload(); }}>
    <Band style={{ paddingBottom: 2 }}>
      <View style={s.top}>
        <Text style={s.logo}>melo<Text style={{ color: C.blue }}>.</Text></Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Pressable hitSlop={6} onPress={() => go('/discover')} accessibilityLabel="Search" style={s.round}><Icon name="magnifyingglass" size={19} /></Pressable>
          {user && <Pressable hitSlop={6} onPress={() => go('/chats')} accessibilityLabel="Chats" style={s.round}><Icon name="paperplane" size={18} /></Pressable>}
          {user && profile ? <Pressable onPress={() => go('/me')} accessibilityLabel="Your profile"><Avatar name={profile.name} color={profile.color} size={40} /></Pressable> : <Button small title="Sign in" onPress={() => go('/login')} />}
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <T.Dim>{greeting()}{first ? `, ${first}` : ''}</T.Dim>
        <T.Display>What everyone{'\n'}is hearing.</T.Display>
      </View>
    </Band>
    {user && <Listening ids={[...follows.users]} />}
    <Band style={{ paddingTop: 16, paddingBottom: 0 }}>
      <Seg value={mode} onChange={m => { setMode(m); setPages(1); }} options={[['hot', 'For you'], ['following', 'Following'], ['new', 'Newest']]} />
    </Band>
    <Sheet>
      {!configured && <T.Dim>This build has no server configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</T.Dim>}
      <Pressable onPress={() => go(user ? '/compose' : '/login')} style={({ pressed }) => [s.compose, pressed && { opacity: 0.9 }]}>
        {profile ? <Avatar name={profile.name} color={profile.color} size={34} /> : <View style={[s.round, { width: 34, height: 34 }]}><Icon name="square.and.pencil" size={16} color={C.blue} /></View>}
        <Text style={s.composeText}>Review an album, drop a take…</Text>
        <View style={s.composeBtn}><Icon name="star" size={15} color={C.blue} weight={2.4} /></View>
      </Pressable>
      {feed.error ? <ErrorView message={feed.error} onRetry={feed.reload} /> : <PostList posts={feed.data} empty={mode === 'following' ? 'Follow people, artists and genres and their posts land here.' : 'Nothing posted yet. Be the first take this place ever had.'} />}
      {feed.data?.length === limit && pages < 10 && <Button kind="ghost" title="Load more" loading={feed.loading} onPress={() => setPages(p => p + 1)} />}
    </Sheet>
  </Screen>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  logo: { fontFamily: F.heavy, fontSize: 30, color: C.text, letterSpacing: -1.2 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  rowTitle: { fontFamily: F.bold, fontSize: 15, color: C.text },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.good },
  nowAvatar: { position: 'absolute', right: -4, bottom: -4, borderRadius: 16, borderWidth: 2, borderColor: C.bg },
  nowName: { fontFamily: F.semibold, fontSize: 13, color: C.text, textAlign: 'center' },
  compose: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 22, padding: 10, paddingLeft: 12, ...shadow(1) },
  composeText: { fontFamily: F.medium, fontSize: 15.5, color: C.faint, flex: 1 },
  composeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
});
