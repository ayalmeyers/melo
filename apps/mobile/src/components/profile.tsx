import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ago, flag, type LogEntry, type Profile } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go, loadItems, cachedItem, shareLink, useLoad } from '../lib/hooks';
import { Screen, Seg } from './screen';
import { moderate, PostList } from './post';
import { FollowButton } from './social';
import { Avatar, Band, Button, Empty, Icon, ItemCover, Sheet, Stars, T } from './ui';
import { C, F } from './theme';

export function ProfileView({ profile, top = true }: { profile: Profile; top?: boolean }) {
  const { user, toast } = useSession();
  const mine = user?.id === profile.id;
  const [tab, setTab] = useState<'posts' | 'diary' | 'top4'>('posts');
  const stats = useLoad(() => api.stats(profile.id), [profile.id]);
  const posts = useLoad(() => api.feed('new', { author: profile.id, limit: 50 }), [profile.id]);
  const diary = useLoad(async () => { const d = await api.diary(profile.id, 200); await loadItems([...d.map(l => l.item_id), ...profile.top4]); return d; }, [profile.id, profile.top4.join()]);
  const st = stats.data;

  const dm = async () => { if (!user) return go('/login'); try { go(`/chats/${await api.openDm(profile.id)}`); } catch (e) { fail(e); } };

  return <Screen top={top} onRefresh={() => Promise.all([stats.reload(), posts.reload(), diary.reload()])}>
    <Band>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={profile.name} color={profile.color} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: '#fff' }} numberOfLines={1}>{profile.name}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.onInkDim }}>@{profile.handle} {flag(profile.cc)}{profile.city ? ` · ${profile.city}` : ''}</Text>
        </View>
        {mine
          ? <Pressable hitSlop={10} onPress={() => go('/settings')} accessibilityLabel="Settings"><Icon name="gearshape" size={22} color="#fff" /></Pressable>
          : <Pressable hitSlop={10} accessibilityLabel="More" onPress={() => moderate({ kind: 'profile', id: profile.id, authorId: profile.id, authorHandle: profile.handle, mine: false, onBlocked: () => toast('Blocked') })}><Icon name="ellipsis.circle" size={22} color="#fff" /></Pressable>}
      </View>
      {!!profile.bio && <Text style={{ fontFamily: F.medium, fontSize: 15.5, lineHeight: 22, color: C.onInk }}>{profile.bio}</Text>}
      <View style={{ flexDirection: 'row', gap: 22 }}>
        {[['Logged', st?.logged], ['Posts', st?.posts], ['Followers', st?.followers], ['Following', st?.following], ['Ear', st?.ear != null ? Math.round(st.ear) : '—']].map(([l, v]) => <View key={String(l)}>
          <Text style={{ fontFamily: F.heavy, fontSize: 19, color: l === 'Ear' ? C.blue : '#fff' }}>{v ?? 0}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.onInkDim }}>{l}</Text>
        </View>)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {mine ? <Button small kind="dark" title="Edit profile" onPress={() => go('/settings')} style={{ flex: 1 }} /> : <><View style={{ flex: 1 }}><FollowButton kind="user" target={profile.id} onDark /></View><Button small kind="dark" title="Message" icon="paperplane" onPress={dm} style={{ flex: 1 }} /></>}
        <Button small kind="dark" title="" icon="square.and.arrow.up" accessibilityLabel="Share profile" onPress={() => shareLink(`/u/${profile.handle}`, `${profile.name} on Melo`)} />
      </View>
      <Seg value={tab} onChange={setTab} options={[['posts', 'Posts'], ['diary', 'Diary'], ['top4', 'Top 4']]} />
    </Band>
    <Sheet>
      {tab === 'posts' && <PostList posts={posts.data} empty={mine ? 'Your reviews, takes and threads land here.' : 'No posts yet.'} />}
      {tab === 'diary' && (diary.data && !diary.data.length ? <Empty text={mine ? 'Log what you listen to. Open any album and tap Log.' : 'Nothing logged yet.'} /> : (diary.data ?? []).map(l => <DiaryRow key={l.id} l={l} mine={mine} onGone={diary.reload} />))}
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
