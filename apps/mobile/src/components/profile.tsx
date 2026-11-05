import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ago, flag, type LogEntry, type Profile } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go, loadItems, cachedItem, shareLink, useLoad } from '../lib/hooks';
import { Screen, Seg } from './screen';
import { moderate, PostList } from './post';
import { FollowButton } from './social';
import { ListCardView } from './lists';
import { Loading } from './skeleton';
import { Avatar, Band, Button, Empty, Icon, ItemCover, Sheet, Stars, T } from './ui';
import { C, F, shadow } from './theme';

export function ProfileView({ profile, top = true }: { profile: Profile; top?: boolean }) {
  const { user, toast } = useSession();
  const mine = user?.id === profile.id;
  const [tab, setTab] = useState<'posts' | 'diary' | 'lists' | 'top4'>('posts');
  const stats = useLoad(() => api.stats(profile.id), [profile.id]);
  const posts = useLoad(() => api.feed('new', { author: profile.id, limit: 50 }), [profile.id]);
  const diary = useLoad(async () => { const d = await api.diary(profile.id, 200); await loadItems([...d.map(l => l.item_id), ...profile.top4]); return d; }, [profile.id, profile.top4.join()]);
  const lists = useLoad(() => api.lists({ owner: profile.id, limit: 50 }), [profile.id]);
  // How close your taste is to theirs, with what you share.
  const match = useLoad(async () => {
    if (!user || mine) return null;
    const m = await api.tasteMatch(user.id, profile.id);
    if (m?.both_loved?.length || m?.top_shared?.length) await loadItems([...(m.both_loved ?? []), ...(m.top_shared ?? [])]);
    return m;
  }, [user?.id, profile.id]);
  const st = stats.data;

  const insets = useSafeAreaInsets();
  const dm = async () => { if (!user) return go('/login'); try { go(`/chats/${await api.openDm(profile.id)}`); } catch (e) { fail(e); } };

  const W = Math.min(useWindowDimensions().width, 600); const pad = top ? insets.top : 0;
  return <Screen top={false} onRefresh={() => Promise.all([stats.reload(), posts.reload(), diary.reload(), lists.reload()])}>
    {/* Banner: their Top 4, edge to edge. */}
    <View style={{ flexDirection: 'row', height: W / 4 + 24 + pad, paddingTop: pad, overflow: 'hidden', backgroundColor: profile.color }}>
      {(profile.top4 ?? []).slice(0, 4).map(iid => <ItemCover key={iid} item={{ id: iid, title: '', type: 'album' }} size={W / 4 + 24} radius={0} />)}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, backgroundColor: C.bg, opacity: 0.35 }} />
      <View style={{ position: 'absolute', top: pad + 10, right: 16, flexDirection: 'row', gap: 8 }}>
        {mine
          ? <Pressable hitSlop={10} onPress={() => go('/settings')} accessibilityLabel="Settings" style={s.glass}><Icon name="gearshape" size={19} color={C.text} /></Pressable>
          : <Pressable hitSlop={10} accessibilityLabel="More" style={s.glass} onPress={() => moderate({ kind: 'profile', id: profile.id, authorId: profile.id, authorHandle: profile.handle, mine: false, onBlocked: () => toast('Blocked') })}><Icon name="ellipsis" size={19} color={C.text} /></Pressable>}
      </View>
    </View>
    <Band style={{ marginTop: -44 }}>
      <View style={{ borderRadius: 46, borderWidth: 4, borderColor: C.bg, alignSelf: 'flex-start' }}><Avatar name={profile.name} color={profile.color} size={84} /></View>
      <View style={{ gap: 2, marginTop: -6 }}>
        <Text style={{ fontFamily: F.heavy, fontSize: 26, color: C.text, letterSpacing: -0.5 }} numberOfLines={1}>{profile.name}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.dim }}>@{profile.handle} {flag(profile.cc)}{profile.city ? ` · ${profile.city}` : ''}</Text>
      </View>
      {!!profile.bio && <Text style={{ fontFamily: F.medium, fontSize: 15.5, lineHeight: 22, color: C.text }}>{profile.bio}</Text>}
      <View style={s.stats}>
        {[['Logged', st?.logged], ['Posts', st?.posts], ['Followers', st?.followers], ['Following', st?.following], ['Ear', st?.ear != null ? Math.round(st.ear) : '—']].map(([l, v], i) => <View key={String(l)} style={[{ flex: 1, alignItems: 'center' }, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
          <Text style={{ fontFamily: F.heavy, fontSize: 18, color: l === 'Ear' ? C.blue : C.text }}>{v ?? 0}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.dim }}>{l}</Text>
        </View>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {mine ? <Button small kind="dark" title="Edit profile" onPress={() => go('/settings')} style={{ flex: 1 }} /> : <><View style={{ flex: 1 }}><FollowButton kind="user" target={profile.id} onDark /></View><Button small kind="dark" title="Message" icon="paperplane" onPress={dm} style={{ flex: 1 }} /></>}
        <Button small kind="dark" title="" icon="square.and.arrow.up" accessibilityLabel="Share profile" onPress={() => shareLink(`/u/${profile.handle}`, `${profile.name} on Melo`)} />
      </View>
      {match.data && match.data.shared_items + match.data.shared_artists > 0 && <View style={{ backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 10, ...shadow(1) }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: F.heavy, fontSize: 30, color: C.blue }}>{match.data.score}%</Text>
          <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text, flex: 1 }}>taste match · {match.data.shared_items} albums and {match.data.shared_artists} artists in common</Text>
        </View>
        {!!(match.data.both_loved ?? match.data.top_shared)?.length && <View style={{ flexDirection: 'row', gap: 8 }}>
          {(match.data.both_loved?.length ? match.data.both_loved : match.data.top_shared ?? []).slice(0, 5).map(iid => { const it = cachedItem(iid); return it ? <Pressable key={iid} onPress={() => go(`/item/${iid}`)}><ItemCover item={it} size={48} radius={8} /></Pressable> : null; })}
        </View>}
        {!!match.data.both_loved?.length && <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.onInkDim }}>You both rated these 4 stars or more</Text>}
      </View>}
      <Seg value={tab} onChange={setTab} options={[['posts', 'Posts'], ['diary', 'Diary'], ['lists', `Lists${lists.data?.length ? ` ${lists.data.length}` : ''}`], ['top4', 'Top 4']]} />
    </Band>
    <Sheet>
      {tab === 'posts' && <PostList posts={posts.data} empty={mine ? 'Your reviews, takes and threads land here.' : 'No posts yet.'} />}
      {tab === 'diary' && (!diary.data ? <Loading n={5} /> : !diary.data.length ? <Empty text={mine ? 'Log what you listen to. Open any album and tap Log.' : 'Nothing logged yet.'} /> : (diary.data ?? []).map(l => <DiaryRow key={l.id} l={l} mine={mine} onGone={diary.reload} />))}
      {tab === 'lists' && <View style={{ gap: 12 }}>
        {mine && <Button kind="ghost" icon="plus" title="New list" onPress={() => go('/list/new')} />}
        {!lists.data ? <Loading n={2} kind="post" /> : !lists.data.length ? <Empty text={mine ? 'Make a list: your Top 10 of the year, a road-trip shelf, every album by one artist ranked.' : 'No lists yet.'} /> : (lists.data ?? []).map(l => <ListCardView key={l.id} l={l} showOwner={false} />)}
      </View>}
      {tab === 'top4' && (profile.top4.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {profile.top4.map(id => { const it = cachedItem(id); return <Pressable key={id} onPress={() => go(`/item/${id}`)} style={{ width: '47%', gap: 6 }}>{it && <ItemCover item={it} size={156} radius={16} />}<T.Bold>{it?.title ?? id}</T.Bold><T.Dim>{it?.artist_name}</T.Dim></Pressable>; })}
      </View> : <Empty text="No Top 4 picked yet." />)}
    </Sheet>
  </Screen>;
}

function DiaryRow({ l, mine, onGone }: { l: LogEntry; mine: boolean; onGone: () => void }) {
  const it = cachedItem(l.item_id);
  return <Pressable onPress={() => go(`/item/${l.item_id}`)} onLongPress={() => mine && api.deleteLog(l.id).then(onGone).catch(fail)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    {it && <ItemCover item={it} size={50} radius={9} />}
    <View style={{ flex: 1, gap: 3 }}>
      <T.Bold>{it?.title ?? l.item_id}</T.Bold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{l.rating != null && <Stars r10={l.rating} size={12} color={C.blue} />}{l.liked && <Icon name="heart.fill" size={12} color="#e0245e" />}<T.Dim>{l.source && l.source !== 'melo' ? `${l.plays ?? ''} plays on ${l.source === 'spotify' ? 'Spotify' : 'Apple Music'} · last ` : ''}{ago(l.listened_at)}</T.Dim></View>
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  glass: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 20, paddingVertical: 12, ...shadow(1) },
});
