import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Profile, ShareType } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { fail, go, useLoad } from '../../lib/hooks';
import { Avatar, Button, Empty, Icon, Input, T } from '../../components/ui';
import { C, F } from '../../components/theme';

/** New group or DM. With ?share=type:id it sends that album, post or board into an existing or new chat. */
export default function NewChat() {
  const { share } = useLocalSearchParams<{ share?: string }>();
  const { user, follows, toast } = useSession();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [found, setFound] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const following = useLoad(() => api.profilesByIds([...follows.users]), [follows.users.size]);
  const existing = useLoad(() => (share && user ? api.chats() : Promise.resolve([])), [share, user?.id]);
  useEffect(() => { const s = q.trim(); if (s.length < 2) { setFound([]); return; } const t = setTimeout(() => api.searchPeople(s).then(setFound).catch(() => {}), 220); return () => clearTimeout(t); }, [q]);
  if (!user) return <View style={{ padding: 20, gap: 14 }}><T.Body>Sign in to chat.</T.Body><Button title="Sign in" onPress={() => go('/login')} /></View>;

  const [sType, sId] = (share ?? '').split(':') as [ShareType, string];
  const sendShare = async (chatId: string) => { if (share) await api.send(chatId, { share: { type: sType, id: sId } }); };
  const toExisting = async (chatId: string) => { try { await sendShare(chatId); toast('Sent'); router.back(); } catch (e) { fail(e); } };
  const create = async () => {
    setBusy(true);
    try {
      const id = picked.length === 1 && !name.trim() ? await api.openDm(picked[0].id) : await api.createChat(name.trim(), picked.map(p => p.id));
      await sendShare(id);
      router.back();
      setTimeout(() => go(`/chats/${id}`), 250);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const toggle = (p: Profile) => setPicked(picked.some(x => x.id === p.id) ? picked.filter(x => x.id !== p.id) : [...picked, p]);
  const people = (q.trim().length >= 2 ? found : following.data ?? []).filter(p => p.id !== user.id);

  return <ScrollView style={{ backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
    {share && !!existing.data?.length && <View style={{ gap: 10 }}>
      <T.Label>Send to a chat</T.Label>
      {existing.data.slice(0, 6).map(c => <Pressable key={c.id} onPress={() => toExisting(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="bubble.left.and.bubble.right.fill" size={22} color={C.blue} /><Text style={{ fontFamily: F.semibold, fontSize: 16, color: C.text, flex: 1 }} numberOfLines={1}>{c.name || c.last_message_preview || 'Chat'}</Text></Pressable>)}
      <T.Label>Or start a new one</T.Label>
    </View>}
    {picked.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{picked.map(p => <Pressable key={p.id} onPress={() => toggle(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.blueSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ fontFamily: F.semibold, color: C.blue }}>{p.name}</Text><Icon name="xmark" size={12} color={C.blue} /></Pressable>)}</View>}
    {picked.length > 1 && <Input value={name} onChangeText={setName} placeholder="Group name (optional)" maxLength={60} />}
    <Input value={q} onChangeText={setQ} placeholder="Search people" autoCapitalize="none" autoCorrect={false} />
    {!people.length ? <Empty text={q.trim().length >= 2 ? 'No one found.' : 'Search for people, or follow some first.'} /> : people.map(p => {
      const on = picked.some(x => x.id === p.id);
      return <Pressable key={p.id} onPress={() => toggle(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={p.name} color={p.color} size={42} />
        <View style={{ flex: 1 }}><T.Bold>{p.name}</T.Bold><T.Dim>@{p.handle}</T.Dim></View>
        <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? C.blue : C.line} />
      </Pressable>;
    })}
    <Button title={share ? 'Send' : picked.length > 1 ? 'Start group' : 'Start chat'} disabled={!picked.length} loading={busy} onPress={create} />
  </ScrollView>;
}
