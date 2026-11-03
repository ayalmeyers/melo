import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { compact, type CatalogItem, type FollowKind, type Target } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { go, rememberItem, shareLink, useLoad } from '../lib/hooks';
import { Screen, Seg } from './screen';
import { PostList } from './post';
import { FollowButton, WikiBox } from './social';
import { ItemRow } from './rows';
import { Band, Button, Empty, Icon, Sheet, T } from './ui';
import { C, F } from './theme';

/** Shared page for artists and genres: a community board, a wiki, and the catalog. Like a subreddit with a record shelf. */
export function Board({ kind, id, name, sub, art, wikiKey, wikiFallback, sharePath, items }: {
  kind: Extract<FollowKind, 'artist' | 'genre'>; id: string; name: string; sub: string; art: React.ReactNode;
  wikiKey: string; wikiFallback: string; sharePath: string; items: () => Promise<CatalogItem[]>;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState<'board' | 'records' | 'wiki'>('board');
  const [sort, setSort] = useState<'hot' | 'new'>('hot');
  const target: Target = { type: kind, id };
  const posts = useLoad(() => api.feed(sort, { target, limit: 60 }), [id, sort]);
  const records = useLoad(async () => { const r = await items(); r.forEach(rememberItem); return r; }, [id]);
  const followers = useLoad(() => api.followCount(kind, id), [id]);

  return <Screen top={false} onRefresh={() => Promise.all([posts.reload(), records.reload(), followers.reload()])}>
    <Stack.Screen options={{ title: '', headerRight: () => <Pressable hitSlop={10} onPress={() => shareLink(sharePath, `${name} on Melo`)}><Icon name="square.and.arrow.up" size={20} color="#fff" /></Pressable> }} />
    <Band>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {art}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 12.5, letterSpacing: 1, color: C.blue, textTransform: 'uppercase' }}>{kind === 'artist' ? 'Artist' : 'Genre'}</Text>
          <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 31, color: '#fff' }}>{name}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.onInkDim }}>{sub}{followers.data != null ? ` · ${compact(followers.data)} following` : ''}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><FollowButton kind={kind} target={id} small={false} onDark /></View>
        <Button style={{ flex: 1 }} kind="dark" title="Post" icon="square.and.pencil" onPress={() => go(user ? `/compose?kind=thread&target=${kind}:${id}` : '/login')} />
        <Button kind="dark" title="" icon="paperplane" accessibilityLabel="Send in a chat" onPress={() => go(`/chats/new?share=${kind}:${id}`)} />
      </View>
      <Seg value={tab} onChange={setTab} options={[['board', 'Board'], ['records', kind === 'artist' ? 'Discography' : 'Records'], ['wiki', 'Wiki']]} />
    </Band>
    <Sheet>
      {tab === 'board' && <>
        <Seg dark={false} value={sort} onChange={setSort} options={[['hot', 'Hot'], ['new', 'Newest']]} />
        <PostList posts={posts.data} hideTarget empty={`No posts on the ${name} board yet. Start the first thread.`} />
      </>}
      {tab === 'records' && (records.data && !records.data.length ? <Empty text="Nothing in the catalog yet." /> : (records.data ?? []).map(it => <ItemRow key={it.id} it={it} />))}
      {tab === 'wiki' && <WikiBox wkey={wikiKey} fallback={wikiFallback} />}
      {tab === 'records' && <Button kind="ghost" icon="plus" title="Add a record" onPress={() => go(`/add-item${kind === 'artist' ? `?artist=${id}` : `?genre=${id}`}`)} />}
    </Sheet>
  </Screen>;
}
