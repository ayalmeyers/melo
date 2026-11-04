import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ago, genreName, LIMITS, type Message, type Profile } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { cachedItem, fail, go, loadArtists, loadItems, targetLabel, useLoad } from '../../lib/hooks';
import { moderate } from '../../components/post';
import { ArtistCover, Avatar, GenreCover, Icon, Input, ItemCover } from '../../components/ui';
import { C, F } from '../../components/theme';

function Share({ m, mine }: { m: Message; mine: boolean }) {
  if (!m.share_type || !m.share_id) return null;
  const id = m.share_id;
  const [href, label, art] =
    m.share_type === 'item' ? [`/item/${id}`, cachedItem(id)?.title ?? 'An album', <ItemCover key="a" item={{ id, title: cachedItem(id)?.title ?? id, type: 'album' }} size={44} radius={8} />]
    : m.share_type === 'artist' ? [`/artist/${id}`, targetLabel({ type: 'artist', id }), <ArtistCover key="a" id={id} size={44} />]
    : m.share_type === 'genre' ? [`/genre/${id}`, genreName(id), <GenreCover key="a" id={id} size={44} radius={8} />]
    : m.share_type === 'forecast' ? [`/forecast/${id}`, 'A forecast', <Icon key="a" name="chart.line.uptrend.xyaxis" size={28} color={C.blue} />]
    : [`/post/${id}`, 'A post', <Icon key="a" name="text.bubble" size={28} color={C.blue} />];
  return <Pressable onPress={() => go(href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: 8, minWidth: 180 }}>{art}<Text style={{ fontFamily: F.bold, fontSize: 14.5, color: mine ? '#fff' : C.text, flexShrink: 1 }} numberOfLines={2}>{label}</Text></Pressable>;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, toast } = useSession();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const meta = useLoad(async () => {
    const c = (await api.chats()).find(x => x.id === id);
    if (!c) return null;
    const ps = await api.profilesByIds(c.members.map(m => m.user_id));
    return { chat: c, people: Object.fromEntries(ps.map(p => [p.id, p])) as Record<string, Profile> };
  }, [id]);

  useEffect(() => {
    let alive = true;
    api.messages(id).then(async m => { await Promise.all([loadItems(m.filter(x => x.share_type === 'item').map(x => x.share_id!)), loadArtists(m.filter(x => x.share_type === 'artist').map(x => x.share_id!))]); if (alive) setMsgs(m); }).catch(fail);
    api.markRead(id).catch(() => {});
    const off = api.onMessages(id, m => { setMsgs(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m])); api.markRead(id).catch(() => {}); });
    return () => { alive = false; off(); };
  }, [id]);

  const blocked = useLoad(() => api.blocked(), []);
  const shown = useMemo(() => msgs.filter(m => !blocked.data?.has(m.author)).slice().reverse(), [msgs, blocked.data]);
  const others = meta.data ? Object.values(meta.data.people).filter(p => p.id !== user?.id) : [];
  const title = meta.data?.chat.name || others.map(o => o.name).join(', ') || 'Chat';

  const send = async () => {
    const b = body.trim(); if (!b) return;
    setBody('');
    try { await api.send(id, { body: b }); } catch (e) { setBody(b); fail(e); }
  };
  const leave = () => Alert.alert('Leave chat?', 'You will stop getting messages here.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => api.leaveChat(id).then(() => router.back()).catch(fail) }]);

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
    <Stack.Screen options={{ title, headerRight: () => <Pressable hitSlop={10} onPress={leave} accessibilityLabel="Leave chat"><Icon name="rectangle.portrait.and.arrow.right" size={20} color="#fff" /></Pressable> }} />
    <FlatList ref={list} inverted data={shown} keyExtractor={m => m.id} contentContainerStyle={{ padding: 16, gap: 6 }} keyboardDismissMode="interactive"
      renderItem={({ item: m, index }) => {
        const mine = m.author === user?.id;
        const who = meta.data?.people[m.author];
        const next = shown[index - 1];
        const showWho = !mine && others.length > 1 && shown[index + 1]?.author !== m.author;
        return <Pressable onLongPress={() => moderate({ kind: 'message', id: m.id, authorId: m.author, authorHandle: who?.handle, mine, onBlocked: () => { toast('Blocked'); blocked.reload(); } })}
          style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          {!mine && <View style={{ width: 28 }}>{(!next || next.author !== m.author) && who && <Avatar name={who.name} color={who.color} size={28} />}</View>}
          <View style={{ gap: 3 }}>
            {showWho && who && <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.dim, marginLeft: 4 }}>{who.name}</Text>}
            <View style={{ backgroundColor: mine ? C.blue : C.mist, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}>
              <Share m={m} mine={mine} />
              {!!m.body && <Text style={{ fontFamily: F.medium, fontSize: 16, lineHeight: 22, color: mine ? '#fff' : C.text }}>{m.body}</Text>}
            </View>
            {(!next || next.author !== m.author) && <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.dim, alignSelf: mine ? 'flex-end' : 'flex-start', marginHorizontal: 4 }}>{ago(m.created_at)}</Text>}
          </View>
        </Pressable>;
      }} />
    <View style={{ flexDirection: 'row', gap: 8, padding: 10, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'flex-end' }}>
      <Input value={body} onChangeText={setBody} placeholder="Message" multiline maxLength={LIMITS.message} style={{ flex: 1, minHeight: 44, maxHeight: 140, paddingVertical: 11 }} />
      <Pressable onPress={send} disabled={!body.trim()} accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: body.trim() ? C.blue : C.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow.up" size={20} color="#fff" /></Pressable>
    </View>
  </KeyboardAvoidingView>;
}
