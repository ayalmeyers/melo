import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { fail, go } from '../../lib/hooks';
import { Button, Input, T } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function NewList() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const { user, toast } = useSession();
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [ranked, setRanked] = useState(true); const [busy, setBusy] = useState(false);
  if (!user) return <View style={{ padding: 20, gap: 12 }}><T.Body>Sign in to make lists.</T.Body><Button title="Sign in" onPress={() => go('/login')} /></View>;
  const create = async () => {
    setBusy(true);
    try {
      const id = await api.createList({ title: title.trim(), description: desc.trim(), ranked });
      if (add) await api.addToList(id, add);
      toast('List created'); router.back(); setTimeout(() => go(`/list/${id}`), 250);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return <ScrollView style={{ backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
    <T.Dim>A list is a shelf you curate: "Best debut albums", "Songs for a 6am flight", "Every Frank Ocean record, ranked".</T.Dim>
    <Input value={title} onChangeText={setTitle} placeholder="Title" maxLength={100} autoFocus style={{ fontFamily: F.bold, fontSize: 18 }} />
    <Input value={desc} onChangeText={setDesc} placeholder="What ties these together? (optional)" maxLength={1000} multiline />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Switch value={ranked} onValueChange={setRanked} trackColor={{ true: C.blue }} /><Text style={{ fontFamily: F.medium, color: C.text, fontSize: 15 }}>Ranked (numbered in order)</Text></View>
    <Button title={add ? 'Create and add' : 'Create list'} disabled={!title.trim()} loading={busy} onPress={create} />
  </ScrollView>;
}
