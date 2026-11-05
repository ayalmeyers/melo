import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { compact, type CatalogItem, type FollowKind, type Target } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { go, rememberItem, shareLink, useLoad } from '../lib/hooks';
import { Screen, Seg } from './screen';
import { PostList } from './post';
import { FollowButton, WikiBox } from './social';
import { ItemRow } from './rows';
import { Band, Button, Card, Empty, Icon, ItemCover, Sheet } from './ui';
import { Loading } from './skeleton';
import { C, F, shadow } from './theme';

/** Shared page for artists and genres: a community board, a wiki, and the catalog. Like a subreddit with a record shelf. */
export function Board({ kind, id, name, sub, art, credit, wikiKey, wikiFallback, sharePath, items, recordsExtra }: {
  kind: Extract<FollowKind, 'artist' | 'genre'>; id: string; name: string; sub: string; art: React.ReactNode; credit?: React.ReactNode;
  wikiKey: string; wikiFallback: string; sharePath: string; items: () => Promise<CatalogItem[]>;
  /** Shown under the records tab, e.g. the rest of an artist's discography from Apple. */
  recordsExtra?: (have: Set<string>) => React.ReactNode;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState<'board' | 'records' | 'wiki'>('board');
  const [sort, setSort] = useState<'hot' | 'new'>('hot');
  const target: Target = { type: kind, id };
  const posts = useLoad(() => api.feed(sort, { target, limit: 60 }), [id, sort]);
  const records = useLoad(async () => { const r = await items(); r.forEach(rememberItem); return r; }, [id]);
  const followers = useLoad(() => api.followCount(kind, id), [id]);

  return <Screen top={false} onRefresh={() => Promise.all([posts.reload(), records.reload(), followers.reload()])}>
    <Stack.Screen options={{ title: '', headerRight: () => <Pressable hitSlop={10} accessibilityLabel="Share" onPress={() => shareLink(sharePath, `${name} on Melo`)}><Icon name="square.and.arrow.up" size={20} color={C.text} /></Pressable> }} />
    <Band style={{ alignItems: 'center', gap: 12 }}>
      <View style={[{ borderRadius: 999 }, shadow(2)]}>{art}</View>
      <View style={{ alignItems: 'center', gap: 3 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 12, letterSpacing: 1, color: C.blue, textTransform: 'uppercase' }}>{kind === 'artist' ? 'Artist' : 'Genre'}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: F.heavy, fontSize: 30, lineHeight: 34, color: C.text, textAlign: 'center', letterSpacing: -0.6 }}>{name}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.dim, textAlign: 'center' }}>{sub}{followers.data != null ? ` · ${compact(followers.data)} following` : ''}</Text>
      </View>
      {credit}
      <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}><FollowButton kind={kind} target={id} small={false} onDark /></View>
        <Button style={{ flex: 1 }} kind="dark" title="Post" icon="square.and.pencil" onPress={() => go(user ? `/compose?kind=thread&target=${kind}:${id}` : '/login')} />
        <Button kind="dark" title="" icon="paperplane" accessibilityLabel="Send in a chat" onPress={() => go(`/chats/new?share=${kind}:${id}`)} />
      </View>
    </Band>
    {/* The shelf: their records as covers, always one swipe away. */}
    {!!records.data?.length && <View style={{ gap: 10, marginTop: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{kind === 'artist' ? 'Records' : 'Records people are logging'}</Text>
        <Text onPress={() => setTab('records')} style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.blue }}>See all</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
        {records.data.slice(0, 12).map(it => <Pressable key={it.id} onPress={() => go(`/item/${it.id}`)} style={{ width: 128, gap: 6 }} accessibilityLabel={`${it.title}, ${it.artist_name}`}>
          <View style={[{ borderRadius: 16 }, shadow(1)]}><ItemCover item={it} size={128} radius={16} /></View>
          <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }} numberOfLines={1}>{it.title}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.dim, marginTop: -4 }} numberOfLines={1}>{kind === 'artist' ? it.year ?? '' : it.artist_name}</Text>
        </Pressable>)}
      </ScrollView>
    </View>}
    <Band style={{ paddingTop: 16 }}>
      <Seg value={tab} onChange={setTab} options={[['board', 'Board'], ['records', kind === 'artist' ? 'Discography' : 'Records'], ['wiki', 'Wiki']]} />
    </Band>
    <Sheet>
      {tab === 'board' && <>
        <Seg dark={false} value={sort} onChange={setSort} options={[['hot', 'Hot'], ['new', 'Newest']]} />
        {posts.data && !posts.data.length
          ? <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="bubble.left.and.bubble.right" size={24} color={C.blue} /></View>
              <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.text, textAlign: 'center' }}>The {name} board is open</Text>
              <Text style={{ fontFamily: F.medium, fontSize: 14.5, color: C.dim, textAlign: 'center', lineHeight: 21 }}>{kind === 'artist' ? 'Best record, most overrated song, the feature nobody talks about. Start it.' : `Where ${name} is going, who is next, what everyone is sleeping on. Start it.`}</Text>
              <Button title="Start the first thread" icon="square.and.pencil" onPress={() => go(user ? `/compose?kind=thread&target=${kind}:${id}` : '/login')} />
            </Card>
          : <PostList posts={posts.data} hideTarget />}
      </>}
      {tab === 'records' && (!records.data ? <Loading n={5} /> : !records.data.length ? <Empty text="Nothing in the catalog yet." /> : (records.data ?? []).map(it => <ItemRow key={it.id} it={it} />))}
      {tab === 'wiki' && <WikiBox wkey={wikiKey} fallback={wikiFallback} />}
      {tab === 'records' && recordsExtra?.(new Set((records.data ?? []).map(r => r.id)))}
      {tab === 'records' && <Button kind="ghost" icon="plus" title="Add a record" onPress={() => go(`/add-item${kind === 'artist' ? `?artist=${id}` : `?genre=${id}`}`)} />}
    </Sheet>
  </Screen>;
}
