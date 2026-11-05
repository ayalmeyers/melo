import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { FeedMode, Target } from '@melo/core';
import { api, configured } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { go, useLoad } from '../../lib/hooks';
import { Screen, Seg } from '../../components/screen';
import { PostList } from '../../components/post';
import { Avatar, Band, Button, Icon, Sheet, T } from '../../components/ui';
import { C, F } from '../../components/theme';
import { ErrorView } from '../../components/skeleton';

const PAGE = 30;

export default function Home() {
  const { user, profile, follows, ready, unread } = useSession();
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

  return <Screen onRefresh={() => { setPages(1); return feed.reload(); }}>
    <Band>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: F.heavy, fontSize: 30, color: '#fff', letterSpacing: -1 }}>melo<Text style={{ color: C.blue }}>.</Text></Text>
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          {user && <Pressable hitSlop={10} onPress={() => go('/activity')} accessibilityLabel={unread ? `Activity, ${unread} new` : 'Activity'}>
            <Icon name={unread ? 'bell.badge' : 'bell'} size={22} color="#fff" />
            {unread > 0 && <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 11 }}>{unread > 99 ? '99+' : unread}</Text></View>}
          </Pressable>}
          {user && <Pressable hitSlop={10} onPress={() => go('/chats')} accessibilityLabel="Chats"><Icon name="bubble.left.and.bubble.right" size={22} color="#fff" /></Pressable>}
          {user && profile ? <Pressable onPress={() => go('/me')}><Avatar name={profile.name} color={profile.color} size={32} /></Pressable> : <Button small title="Sign in" onPress={() => go('/login')} />}
        </View>
      </View>
      <T.Display>What the world{'\n'}is listening to.</T.Display>
      <Seg value={mode} onChange={m => { setMode(m); setPages(1); }} options={[['hot', 'Hot'], ['new', 'Newest'], ['following', 'Following']]} />
    </Band>
    <Sheet>
      {!configured && <T.Dim>This build has no server configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</T.Dim>}
      <Pressable onPress={() => go(user ? '/compose' : '/login')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.mist, borderRadius: 18, padding: 14 }}>
        <Icon name="square.and.pencil" size={20} color={C.blue} />
        <Text style={{ fontFamily: F.medium, fontSize: 16, color: C.dim, flex: 1 }}>Review, hot take, or start a thread</Text>
      </Pressable>
      {feed.error ? <ErrorView message={feed.error} onRetry={feed.reload} /> : <PostList posts={feed.data} empty={mode === 'following' ? 'Follow people, artists and genres and their posts land here.' : 'Nothing posted yet. Be the first take this place ever had.'} />}
      {feed.data?.length === limit && pages < 10 && <Button kind="ghost" title="Load more" loading={feed.loading} onPress={() => setPages(p => p + 1)} />}
    </Sheet>
  </Screen>;
}
