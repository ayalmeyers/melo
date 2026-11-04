import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ago, flag, type FeedPost, type Target } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go, loadArtists, loadItems, shareMenu, targetHref, targetLabel } from '../lib/hooks';
import { Avatar, Empty, Icon, ItemCover, ArtistCover, GenreCover, Stars, T } from './ui';
import { C, F } from './theme';

export function TargetChip({ t }: { t: Target }) {
  return <Pressable onPress={() => go(targetHref(t))} style={s.chip} accessibilityRole="link">
    {t.type === 'item' ? <ItemCover item={{ id: t.id, title: targetLabel(t), type: 'album' }} size={22} radius={5} /> : t.type === 'artist' ? <ArtistCover id={t.id} size={22} /> : <GenreCover id={t.id} size={22} radius={5} />}
    <Text style={s.chipText} numberOfLines={1}>{targetLabel(t)}</Text>
  </Pressable>;
}

/** Opens the moderation menu: report, block, or delete your own. App Store guideline 1.2 needs report and block on every piece of user content. */
export function moderate(opts: { kind: 'post' | 'comment' | 'message' | 'profile' | 'moment'; id: string; authorId: string; authorHandle?: string; mine: boolean; onDeleted?: () => void; onBlocked?: () => void }) {
  const actions: { label: string; destructive?: boolean; run: () => void }[] = [];
  if (opts.mine && opts.onDeleted) actions.push({ label: 'Delete', destructive: true, run: () => Alert.alert('Delete this?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => opts.onDeleted?.() }]) });
  if (!opts.mine) {
    actions.push({ label: 'Report', run: () => api.report(opts.kind, opts.id, 'reported from iOS').then(() => Alert.alert('Reported', 'Thanks. A moderator will review it within 24 hours.')).catch(fail) });
    actions.push({ label: `Block ${opts.authorHandle ? '@' + opts.authorHandle : 'this person'}`, destructive: true, run: () => Alert.alert('Block?', 'You will stop seeing their posts, comments and messages.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => api.block(opts.authorId, true).then(() => opts.onBlocked?.()).catch(fail) }]) });
  }
  if (!actions.length) return;
  if (Platform.OS === 'ios') {
    const labels = [...actions.map(a => a.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions({ options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: actions.map((a, i) => (a.destructive ? i : -1)).filter(i => i >= 0) }, i => { actions[i]?.run(); });
  } else Alert.alert('Options', undefined, [...actions.map(a => ({ text: a.label, onPress: a.run, style: a.destructive ? 'destructive' as const : 'default' as const })), { text: 'Cancel', style: 'cancel' }]);
}

export function PostCard({ post, liked, laughed, vote, onChange, full, hideTarget }: {
  post: FeedPost; liked?: boolean; laughed?: boolean; vote?: 'agree' | 'disagree'; full?: boolean; hideTarget?: boolean;
  onChange?: (p: Partial<FeedPost> & { _liked?: boolean; _laughed?: boolean; _vote?: 'agree' | 'disagree' | null; _gone?: boolean }) => void;
}) {
  const { user, toast } = useSession();
  const [reveal, setReveal] = useState(!post.spoiler);
  const target = post.target_type && post.target_id ? { type: post.target_type, id: post.target_id } as Target : null;
  const mine = user?.id === post.author;
  const needUser = () => { if (!user) { go('/login'); return false; } return true; };

  const react = (kind: 'like' | 'laugh') => {
    if (!needUser()) return;
    const on = kind === 'like' ? !liked : !laughed;
    Haptics.selectionAsync().catch(() => {});
    onChange?.(kind === 'like' ? { likes: post.likes + (on ? 1 : -1), _liked: on } : { laughs: post.laughs + (on ? 1 : -1), _laughed: on });
    api.react('post', post.id, kind, on).catch(fail);
  };
  const doVote = (v: 'agree' | 'disagree') => {
    if (!needUser()) return;
    const next = vote === v ? null : v;
    const d = { agree: post.agree - (vote === 'agree' ? 1 : 0) + (next === 'agree' ? 1 : 0), disagree: post.disagree - (vote === 'disagree' ? 1 : 0) + (next === 'disagree' ? 1 : 0) };
    onChange?.({ ...d, _vote: next });
    api.vote(post.id, next).catch(fail);
  };
  const total = post.agree + post.disagree;

  return <Pressable disabled={full} onPress={() => go(`/post/${post.id}`)} style={[s.card, full && { backgroundColor: 'transparent', padding: 0 }]}>
    <View style={s.head}>
      <Pressable onPress={() => go(`/user/${post.author_handle}`)} style={s.author}>
        <Avatar name={post.author_name} color={post.author_color} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{post.author_name} <Text style={s.handle}>@{post.author_handle} {flag(post.author_cc)}</Text></Text>
          <Text style={s.handle}>{post.kind === 'review' ? 'Review' : post.kind === 'take' ? 'Take' : 'Thread'} · {ago(post.created_at)}</Text>
        </View>
      </Pressable>
      <Pressable hitSlop={12} accessibilityLabel="More options" onPress={() => moderate({ kind: 'post', id: post.id, authorId: post.author, authorHandle: post.author_handle, mine, onDeleted: () => api.deletePost(post.id).then(() => { onChange?.({ _gone: true }); toast('Deleted'); }).catch(fail), onBlocked: () => { onChange?.({ _gone: true }); toast('Blocked'); } })}>
        <Icon name="ellipsis" size={18} color={C.dim} />
      </Pressable>
    </View>
    {target && !hideTarget && <TargetChip t={target} />}
    {post.kind === 'review' && post.rating != null && <Stars r10={post.rating} size={16} color={C.blue} />}
    {post.title ? <Text style={s.title}>{post.title}</Text> : null}
    {reveal
      ? <Text style={[s.body, post.kind === 'take' && s.take]} numberOfLines={full ? undefined : 8}>{post.body}</Text>
      : <Pressable onPress={() => setReveal(true)} style={s.spoiler}><Icon name="eye.slash" size={16} color={C.dim} /><Text style={s.handle}>Contains spoilers. Tap to read.</Text></Pressable>}
    {post.kind === 'take' && <View style={{ gap: 6 }}>
      <View style={s.voteRow}>
        <Pressable onPress={() => doVote('agree')} style={[s.vote, vote === 'agree' && { backgroundColor: C.blue }]}><Text style={[s.voteText, vote === 'agree' && { color: '#fff' }]}>Agree {total ? Math.round((post.agree / total) * 100) + '%' : ''}</Text></Pressable>
        <Pressable onPress={() => doVote('disagree')} style={[s.vote, vote === 'disagree' && { backgroundColor: C.ink }]}><Text style={[s.voteText, vote === 'disagree' && { color: '#fff' }]}>Disagree {total ? Math.round((post.disagree / total) * 100) + '%' : ''}</Text></Pressable>
      </View>
      {total > 0 && <Text style={s.handle}>{total} {total === 1 ? 'vote' : 'votes'}</Text>}
    </View>}
    <View style={s.actions}>
      <Pressable hitSlop={8} onPress={() => react('like')} style={s.act} accessibilityLabel="Like"><Icon name={liked ? 'heart.fill' : 'heart'} size={18} color={liked ? '#e0245e' : C.dim} /><Text style={s.count}>{post.likes || ''}</Text></Pressable>
      <Pressable hitSlop={8} onPress={() => react('laugh')} style={s.act} accessibilityLabel="Funny"><Text style={{ fontSize: 16, opacity: laughed ? 1 : 0.55 }}>😂</Text><Text style={s.count}>{post.laughs || ''}</Text></Pressable>
      <Pressable hitSlop={8} onPress={() => go(`/post/${post.id}`)} style={s.act} accessibilityLabel="Comments"><Icon name="bubble.left" size={17} color={C.dim} /><Text style={s.count}>{post.comment_count || ''}</Text></Pressable>
      <View style={{ flex: 1 }} />
      <Pressable hitSlop={8} onPress={() => go(`/chats/new?share=post:${post.id}`)} accessibilityLabel="Send in a chat"><Icon name="paperplane" size={17} color={C.dim} /></Pressable>
      <Pressable hitSlop={8} onPress={() => shareMenu({ path: `/p/${post.id}`, storyPath: `/p/${post.id}/story`, message: `${post.author_name} on Melo` })} accessibilityLabel="Share"><Icon name="square.and.arrow.up" size={17} color={C.dim} /></Pressable>
    </View>
  </Pressable>;
}

/** A list of posts that keeps likes, laughs and votes in sync. */
export function usePostState(posts: FeedPost[] | null) {
  const [list, setList] = useState<FeedPost[]>([]);
  const [mine, setMine] = useState<{ reacts: Set<string>; votes: Record<string, 'agree' | 'disagree'> }>({ reacts: new Set(), votes: {} });
  const { user } = useSession();
  useEffect(() => {
    const ps = posts ?? [];
    setList(ps);
    const ids = ps.map(p => p.id);
    Promise.all([
      loadItems(ps.filter(p => p.target_type === 'item' && p.target_id).map(p => p.target_id!)),
      loadArtists(ps.filter(p => p.target_type === 'artist' && p.target_id).map(p => p.target_id!)),
    ]).then(() => setList(l => [...l]));
    if (user && ids.length) Promise.all([api.myReactions(ids), api.myVotes(ids)]).then(([reacts, votes]) => setMine({ reacts, votes })).catch(() => {});
  }, [posts, user]);
  const render = (p: FeedPost, extra: { full?: boolean; hideTarget?: boolean } = {}) => <PostCard key={p.id} post={p} {...extra}
    liked={mine.reacts.has(`${p.id}:like`)} laughed={mine.reacts.has(`${p.id}:laugh`)} vote={mine.votes[p.id]}
    onChange={ch => {
      const { _liked, _laughed, _vote, _gone, ...rest } = ch;
      if (_gone) { setList(l => l.filter(x => x.id !== p.id)); return; }
      setList(l => l.map(x => (x.id === p.id ? { ...x, ...rest } : x)));
      setMine(m => {
        const reacts = new Set(m.reacts); const votes = { ...m.votes };
        if (_liked !== undefined) { if (_liked) reacts.add(`${p.id}:like`); else reacts.delete(`${p.id}:like`); }
        if (_laughed !== undefined) { if (_laughed) reacts.add(`${p.id}:laugh`); else reacts.delete(`${p.id}:laugh`); }
        if (_vote !== undefined) { if (_vote) votes[p.id] = _vote; else delete votes[p.id]; }
        return { reacts, votes };
      });
    }} />;
  return { list, render };
}

export function PostList({ posts, empty = 'Nothing here yet. Start it.', hideTarget }: { posts: FeedPost[] | null; empty?: string; hideTarget?: boolean }) {
  const { list, render } = usePostState(posts);
  if (posts && !list.length) return <Empty text={empty} />;
  return <View style={{ gap: 12 }}>{list.map(p => render(p, { hideTarget }))}</View>;
}

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
  <T.H2>{title}</T.H2>{action && <Text onPress={onAction} style={{ fontFamily: F.semibold, color: C.blue, fontSize: 15 }}>{action}</Text>}
</View>;

const s = StyleSheet.create({
  card: { backgroundColor: C.mist, borderRadius: 22, padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  name: { fontFamily: F.bold, fontSize: 15, color: C.text },
  handle: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.paper, borderRadius: 10, paddingRight: 10, paddingLeft: 4, paddingVertical: 4, maxWidth: '100%' },
  chipText: { fontFamily: F.semibold, fontSize: 13.5, color: C.text, flexShrink: 1 },
  title: { fontFamily: F.bold, fontSize: 19, color: C.text, lineHeight: 24 },
  body: { fontFamily: F.regular, fontSize: 15.5, lineHeight: 23, color: C.text },
  take: { fontFamily: F.semibold, fontSize: 18, lineHeight: 25 },
  spoiler: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.paper, borderRadius: 12, padding: 14 },
  voteRow: { flexDirection: 'row', gap: 8 },
  vote: { flex: 1, height: 40, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  voteText: { fontFamily: F.semibold, fontSize: 14.5, color: C.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 2 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 34 },
  count: { fontFamily: F.semibold, fontSize: 13.5, color: C.dim },
});
