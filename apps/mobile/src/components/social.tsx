import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ago, LIMITS, type Comment, type FollowKind } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go, useLoad } from '../lib/hooks';
import { moderate } from './post';
import { Loading } from './skeleton';
import { Avatar, Button, Empty, Icon, Input, T } from './ui';
import { C, F } from './theme';

export function FollowButton({ kind, target, small = true, onDark }: { kind: FollowKind; target: string; small?: boolean; onDark?: boolean }) {
  const { user, follows, setFollows, toast } = useSession();
  const key = kind === 'user' ? 'users' : kind === 'artist' ? 'artists' : 'genres';
  const on = follows[key].has(target);
  if (user?.id === target) return null;
  return <Button small={small} kind={on ? (onDark ? 'dark' : 'ghost') : 'primary'} title={on ? 'Following' : 'Follow'} onPress={() => {
    if (!user) return go('/login');
    const next = new Set(follows[key]); if (on) next.delete(target); else next.add(target);
    setFollows({ ...follows, [key]: next });
    api.follow(kind, target, !on).then(() => !on && toast('Following')).catch(e => { setFollows(follows); fail(e); });
  }} />;
}

export function Comments({ on }: { on: { post?: string; forecast?: string } }) {
  const { user, toast } = useSession();
  const { data, setData, reload } = useLoad(() => api.comments(on), [on.post, on.forecast]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  useEffect(() => { if (user && data?.length) api.myReactions(data.map(c => c.id)).then(setLiked).catch(() => {}); }, [data, user]);

  const send = async () => {
    if (!user) return go('/login');
    const b = body.trim(); if (!b) return;
    setBusy(true);
    try { await api.addComment(on, b, replyTo?.id); setBody(''); setReplyTo(null); await reload(); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const list = data ?? [];
  const top = list.filter(c => !c.reply_to);
  const replies = (id: string) => list.filter(c => c.reply_to === id);
  const row = (c: Comment, depth = 0) => {
    const isLiked = liked.has(c.id + ':like');
    return <View key={c.id} style={{ gap: 10, marginLeft: depth ? 22 : 0 }}>
      <View style={s.row}>
        <Pressable onPress={() => go(`/user/${c.author_handle}`)}><Avatar name={c.author_name} color={c.author_color} size={30} /></Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.meta}><Text style={s.name}>{c.author_name}</Text> · {ago(c.created_at)}</Text>
          <T.Body>{c.body}</T.Body>
          <View style={{ flexDirection: 'row', gap: 18, paddingTop: 2 }}>
            <Pressable hitSlop={8} style={s.act} accessibilityLabel={isLiked ? 'Unlike comment' : 'Like comment'} onPress={() => {
              if (!user) return go('/login');
              const n = new Set(liked); if (isLiked) n.delete(c.id + ':like'); else n.add(c.id + ':like'); setLiked(n);
              setData(list.map(x => (x.id === c.id ? { ...x, likes: x.likes + (isLiked ? -1 : 1) } : x)));
              api.react('comment', c.id, 'like', !isLiked).catch(fail);
            }}><Icon name={isLiked ? 'heart.fill' : 'heart'} size={14} color={isLiked ? '#e0245e' : C.dim} /><Text style={s.meta}>{c.likes || ''}</Text></Pressable>
            {depth === 0 && <Text style={s.link} onPress={() => setReplyTo(c)}>Reply</Text>}
            <Pressable hitSlop={8} accessibilityLabel="Comment options" onPress={() => moderate({ kind: 'comment', id: c.id, authorId: c.author, authorHandle: c.author_handle, mine: user?.id === c.author, onDeleted: () => api.deleteComment(c.id).then(reload).catch(fail), onBlocked: () => { toast('Blocked'); reload(); } })}><Icon name="ellipsis" size={14} color={C.dim} /></Pressable>
          </View>
        </View>
      </View>
      {depth === 0 && replies(c.id).map(r => row(r, 1))}
    </View>;
  };

  return <View style={{ gap: 16 }}>
    <T.H2>Discussion {list.length ? <Text style={{ color: C.dim }}>{list.length}</Text> : null}</T.H2>
    <View style={{ gap: 8 }}>
      {replyTo && <Text style={s.meta}>Replying to {replyTo.author_name} · <Text style={s.link} onPress={() => setReplyTo(null)}>cancel</Text></Text>}
      <Input value={body} onChangeText={setBody} placeholder={user ? 'Add to the discussion' : 'Sign in to join the discussion'} multiline maxLength={LIMITS.comment} editable={!!user} onPressIn={() => !user && go('/login')} />
      {!!body.trim() && <Button small title="Post" loading={busy} onPress={send} style={{ alignSelf: 'flex-end' }} />}
    </View>
    {!data ? <Loading n={2} round /> : !top.length ? <Empty text="No comments yet. Say the first thing." /> : top.map(c => row(c))}
  </View>;
}

export function WikiBox({ wkey, fallback }: { wkey: string; fallback?: string }) {
  const { data } = useLoad(() => api.wiki(wkey), [wkey]);
  const [open, setOpen] = useState(false);
  const body = data?.body ?? fallback ?? '';
  return <View style={s.wiki}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T.Label>Wiki{data ? ` · rev ${data.rev}` : ''}</T.Label>
      <Text style={s.link} onPress={() => go(`/wiki/${encodeURIComponent(wkey)}`)}>Edit</Text>
    </View>
    {body ? <Text style={s.wikiText} numberOfLines={open ? undefined : 5} onPress={() => setOpen(!open)}>{body}</Text> : <T.Dim>No wiki yet. Write the first version.</T.Dim>}
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  name: { fontFamily: F.bold, color: C.text },
  meta: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  link: { fontFamily: F.semibold, fontSize: 13.5, color: C.blue },
  act: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wiki: { backgroundColor: C.mist, borderRadius: 22, padding: 16, gap: 8 },
  wikiText: { fontFamily: F.regular, fontSize: 15, lineHeight: 22.5, color: C.text },
});
