import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ago, flag, type FeedPost, type Target } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { cachedItem, fail, go, loadArtists, loadItems, shareMenu, targetHref, targetLabel } from '../lib/hooks';
import { Avatar, Empty, Icon, ItemCover, ArtistCover, GenreCover, Stars, T, type IconName } from './ui';
import { C, F, shadow } from './theme';
import { Loading } from './skeleton';

const KIND_LABEL: Record<string, string> = { album: 'Album', episode: 'Episode', show: 'Podcast' };
/** Small inline reference (comments, chats). */
export function TargetChip({ t }: { t: Target }) {
  return <Pressable onPress={() => go(targetHref(t))} style={s.chip} accessibilityRole="link">
    {t.type === 'item' ? <ItemCover item={{ id: t.id, title: targetLabel(t), type: 'album' }} size={22} radius={5} /> : t.type === 'artist' ? <ArtistCover id={t.id} size={22} /> : <GenreCover id={t.id} size={22} radius={5} />}
    <Text style={s.chipText} numberOfLines={1}>{targetLabel(t)}</Text>
  </Pressable>;
}

/** What a post is about, shown as a card with the real cover: kind, title, who made it. Tapping opens it. */
export function RefCard({ t, rating }: { t: Target; rating?: number | null }) {
  const it = t.type === 'item' ? cachedItem(t.id) : undefined;
  const kind = t.type === 'artist' ? 'Artist' : t.type === 'genre' ? 'Genre' : KIND_LABEL[it?.type ?? 'album'] ?? 'Album';
  const sub = t.type === 'item' ? [it?.artist_name, it?.year].filter(Boolean).join(' · ') : t.type === 'artist' ? 'Discussion and wiki' : 'Community';
  const icon: IconName = t.type === 'artist' ? 'mic' : t.type === 'genre' ? 'waveform' : it?.type === 'album' || !it ? 'disc' : 'headphones';
  return <Pressable onPress={() => go(targetHref(t))} accessibilityRole="link" accessibilityLabel={`${kind}: ${targetLabel(t)}${sub ? ', ' + sub : ''}`} style={({ pressed }) => [s.ref, pressed && { backgroundColor: C.card2 }]}>
    {t.type === 'item' ? <ItemCover item={{ id: t.id, title: targetLabel(t), type: it?.type ?? 'album', artwork_url: it?.artwork_url }} size={54} radius={10} /> : t.type === 'artist' ? <ArtistCover id={t.id} size={54} /> : <GenreCover id={t.id} size={54} radius={10} />}
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name={icon} size={12} color={C.blue} weight={2.4} /><Text style={s.refKind}>{kind}</Text></View>
      <Text style={s.refTitle} numberOfLines={1}>{targetLabel(t)}</Text>
      {!!sub && <Text style={s.refSub} numberOfLines={1}>{sub}</Text>}
    </View>
    {rating != null ? <View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={s.refScore}>{(rating / 2).toFixed(1)}</Text><Stars r10={rating} size={11} /></View> : <Icon name="chevron.right" size={18} color={C.faint} />}
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

  const verb = post.kind === 'review' ? 'reviewed' : post.kind === 'take' ? 'hot take' : 'started a thread';
  return <Pressable disabled={full} onPress={() => go(`/post/${post.id}`)} style={({ pressed }) => [s.card, full && s.full, pressed && !full && { opacity: 0.94 }]}>
    <View style={s.head}>
      <Pressable onPress={() => go(`/user/${post.author_handle}`)} accessibilityLabel={`${post.author_name}, @${post.author_handle}`}><Avatar name={post.author_name} color={post.author_color} size={40} /></Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1} onPress={() => go(`/user/${post.author_handle}`)}>{post.author_name} <Text style={s.handle}>@{post.author_handle}{post.author_cc ? ' ' + flag(post.author_cc) : ''}</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[s.kind, post.kind === 'take' && { backgroundColor: '#FFF1E6' }, post.kind === 'thread' && { backgroundColor: C.card2 }]}>
            <Icon name={post.kind === 'review' ? 'star' : post.kind === 'take' ? 'flame' : 'bubble.left'} size={11} color={post.kind === 'take' ? '#E06A12' : post.kind === 'review' ? C.blue : C.dim} weight={2.4} />
            <Text style={[s.kindText, post.kind === 'take' && { color: '#E06A12' }, post.kind === 'thread' && { color: C.dim }]}>{verb}</Text>
          </View>
          <Text style={s.handle}>{ago(post.created_at)}</Text>
        </View>
      </View>
      <Pressable hitSlop={12} accessibilityLabel="More options" onPress={() => moderate({ kind: 'post', id: post.id, authorId: post.author, authorHandle: post.author_handle, mine, onDeleted: () => api.deletePost(post.id).then(() => { onChange?.({ _gone: true }); toast('Deleted'); }).catch(fail), onBlocked: () => { onChange?.({ _gone: true }); toast('Blocked'); } })}>
        <Icon name="ellipsis" size={18} color={C.faint} />
      </Pressable>
    </View>
    {target && !hideTarget && <RefCard t={target} rating={post.kind === 'review' ? post.rating : null} />}
    {hideTarget && post.kind === 'review' && post.rating != null && <Stars r10={post.rating} size={15} />}
    {post.title ? <Text style={s.title}>{post.title}</Text> : null}
    {reveal
      ? <Text style={[s.body, post.kind === 'take' && s.take, full && { fontSize: 17, lineHeight: 26 }]} numberOfLines={full ? undefined : 7}>{post.body}</Text>
      : <Pressable onPress={() => setReveal(true)} style={s.spoiler}><Icon name="eye.slash" size={16} color={C.dim} /><Text style={s.handle}>Contains spoilers. Tap to read.</Text></Pressable>}
    {post.kind === 'take' && <View style={{ gap: 6 }}>
      <View style={s.voteRow}>
        {(['agree', 'disagree'] as const).map(v => {
          const n = v === 'agree' ? post.agree : post.disagree; const pct = total ? Math.round((n / total) * 100) : 0; const on = vote === v;
          return <Pressable key={v} onPress={() => doVote(v)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.vote, on && { borderColor: v === 'agree' ? C.blue : C.text }]}>
            {total > 0 && <View style={[s.voteFill, { width: `${pct}%`, backgroundColor: v === 'agree' ? C.blueSoft : C.card2 }]} />}
            <Text style={[s.voteText, on && { color: v === 'agree' ? C.blue : C.text }]}>{v === 'agree' ? 'Agree' : 'Disagree'}</Text>
            {total > 0 && <Text style={[s.votePct, on && { color: v === 'agree' ? C.blue : C.text }]}>{pct}%</Text>}
          </Pressable>;
        })}
      </View>
      {total > 0 && <Text style={s.handle}>{total} {total === 1 ? 'vote' : 'votes'}</Text>}
    </View>}
    <View style={s.actions}>
      <Pressable hitSlop={8} onPress={() => react('like')} style={s.act} accessibilityRole="button" accessibilityLabel={`Like, ${post.likes} ${post.likes === 1 ? 'like' : 'likes'}`} accessibilityState={{ selected: !!liked }}><Icon name={liked ? 'heart.fill' : 'heart'} size={19} color={liked ? C.heart : C.dim} /><Text style={[s.count, liked && { color: C.heart }]}>{post.likes || ''}</Text></Pressable>
      <Pressable hitSlop={8} onPress={() => react('laugh')} style={s.act} accessibilityRole="button" accessibilityLabel={`Funny, ${post.laughs} ${post.laughs === 1 ? 'laugh' : 'laughs'}`} accessibilityState={{ selected: !!laughed }}><Icon name="laugh" size={19} color={laughed ? '#E0A100' : C.dim} weight={laughed ? 2.4 : 1.9} /><Text style={[s.count, laughed && { color: '#E0A100' }]}>{post.laughs || ''}</Text></Pressable>
      <Pressable hitSlop={8} onPress={() => go(`/post/${post.id}`)} style={s.act} accessibilityRole="button" accessibilityLabel={`${post.comment_count} comments`}><Icon name="bubble.left" size={18} color={C.dim} /><Text style={s.count}>{post.comment_count || ''}</Text></Pressable>
      <View style={{ flex: 1 }} />
      <Pressable hitSlop={8} onPress={() => go(`/chats/new?share=post:${post.id}`)} accessibilityLabel="Send in a chat"><Icon name="paperplane" size={18} color={C.dim} /></Pressable>
      <Pressable hitSlop={8} onPress={() => shareMenu({ path: `/p/${post.id}`, storyPath: `/p/${post.id}/story`, message: `${post.author_name} on Melo` })} accessibilityLabel="Share"><Icon name="square.and.arrow.up" size={18} color={C.dim} /></Pressable>
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
  if (!posts) return <Loading kind="post" n={3} />;
  if (!list.length) return <Empty text={empty} />;
  return <View style={{ gap: 12 }}>{list.map(p => render(p, { hideTarget }))}</View>;
}

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
  <T.H2>{title}</T.H2>{action && <Text onPress={onAction} style={{ fontFamily: F.semibold, color: C.blue, fontSize: 15 }}>{action}</Text>}
</View>;

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, padding: 16, gap: 12, ...shadow(1) },
  full: { backgroundColor: 'transparent', padding: 0, borderRadius: 0, shadowOpacity: 0, elevation: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  name: { fontFamily: F.bold, fontSize: 15.5, color: C.text },
  handle: { fontFamily: F.medium, fontSize: 13.5, color: C.dim },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.blueSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  kindText: { fontFamily: F.bold, fontSize: 11.5, color: C.blue },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.card2, borderRadius: 10, paddingRight: 10, paddingLeft: 4, paddingVertical: 4, maxWidth: '100%' },
  chipText: { fontFamily: F.semibold, fontSize: 13.5, color: C.text, flexShrink: 1 },
  ref: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card2, borderRadius: 16, padding: 8, paddingRight: 14 },
  refKind: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, color: C.blue, textTransform: 'uppercase' },
  refTitle: { fontFamily: F.bold, fontSize: 16, color: C.text },
  refSub: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  refScore: { fontFamily: F.heavy, fontSize: 18, color: C.text, letterSpacing: -0.3 },
  title: { fontFamily: F.heavy, fontSize: 20, color: C.text, lineHeight: 25, letterSpacing: -0.3 },
  body: { fontFamily: F.medium, fontSize: 16, lineHeight: 24, color: C.text },
  take: { fontFamily: F.bold, fontSize: 20, lineHeight: 27, letterSpacing: -0.3 },
  spoiler: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, padding: 14 },
  voteRow: { flexDirection: 'row', gap: 8 },
  vote: { flex: 1, height: 42, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', paddingHorizontal: 14, overflow: 'hidden' },
  voteFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  voteText: { fontFamily: F.bold, fontSize: 14.5, color: C.text },
  votePct: { fontFamily: F.semibold, fontSize: 13.5, color: C.dim },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 2 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 36 },
  count: { fontFamily: F.semibold, fontSize: 13.5, color: C.dim },
});
