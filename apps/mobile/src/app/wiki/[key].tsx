import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ago, ARTISTS, GENRES } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { cachedArtist, cachedItem, fail, go, useLoad } from '../../lib/hooks';
import { Button, Input, T } from '../../components/ui';

export default function WikiEdit() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const k = decodeURIComponent(key);
  const { user, toast } = useSession();
  const page = useLoad(() => api.wiki(k), [k]);
  const hist = useLoad(() => api.wikiHistory(k), [k]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, id] = k.split(':');
  const fallback = kind === 'r' ? ARTISTS[id]?.wiki : kind === 'g' ? GENRES[id]?.wiki : '';
  const label = kind === 'r' ? cachedArtist(id)?.name ?? ARTISTS[id]?.name : kind === 'g' ? GENRES[id]?.name : cachedItem(id)?.title ?? id;
  useEffect(() => { if (!page.loading) setBody(page.data?.body ?? fallback ?? ''); }, [page.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!user) return go('/login');
    if (body.trim().length < 20) return toast('Write at least 20 characters.');
    setBusy(true);
    try { const rev = await api.editWiki(k, body.trim()); toast(`Saved revision ${rev}`); router.back(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
    <Stack.Screen options={{ title: label ? `Wiki: ${label}` : 'Edit wiki' }} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
      <T.Dim>Anyone can edit. Keep it factual, cite what you can, and leave opinions for the board. Every version is kept.</T.Dim>
      <Input value={body} onChangeText={setBody} multiline maxLength={20000} style={{ minHeight: 320 }} placeholder="Write what someone new should know." />
      <Button title="Save revision" loading={busy} onPress={save} />
      {!!hist.data?.length && <View style={{ gap: 6 }}>
        <T.Label>History</T.Label>
        {hist.data.map(h => <T.Dim key={h.rev}>Revision {h.rev} · {ago(h.edited_at)}</T.Dim>)}
      </View>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
