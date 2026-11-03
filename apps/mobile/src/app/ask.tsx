import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LIMITS, type Target } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go } from '../lib/hooks';
import { TargetPicker } from '../components/target-picker';
import { Button, Chip, Input, T } from '../components/ui';
import { C, F } from '../components/theme';

const OPTIONS: [string, number][] = [['1 month', 30], ['3 months', 91], ['6 months', 182], ['1 year', 365]];

export default function Ask() {
  const { toast } = useSession();
  const [question, setQuestion] = useState('');
  const [detail, setDetail] = useState('');
  const [days, setDays] = useState(91);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const closes = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const valid = question.trim().length >= 10 && question.trim().endsWith('?') && detail.trim().length >= 10;

  const save = async () => {
    setBusy(true);
    try { const id = await api.ask({ question: question.trim(), detail: detail.trim(), closes_on: closes, target }); toast('Question is live'); router.back(); setTimeout(() => go(`/forecast/${id}`), 250); }
    catch (e) { fail(e); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
      <T.Dim>Ask a yes-or-no question about the future of music that will have a clear answer.</T.Dim>
      <Input value={question} onChangeText={setQuestion} placeholder="Will a K-pop album top the Billboard 200 this year?" multiline maxLength={LIMITS.question} style={{ minHeight: 80, fontFamily: F.bold, fontSize: 18 }} />
      <Input value={detail} onChangeText={setDetail} placeholder="How it resolves: what source, what counts, what doesn't." multiline maxLength={LIMITS.detail} />
      <T.Label>Closes in</T.Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{OPTIONS.map(([l, d]) => <Chip key={d} dark={false} label={l} on={days === d} onPress={() => setDays(d)} />)}</View>
      <Text style={{ fontFamily: F.medium, color: C.dim }}>Closes {closes}</Text>
      <TargetPicker value={target} onChange={setTarget} />
      {!question.trim().endsWith('?') && question.length > 8 && <T.Dim>End it with a question mark.</T.Dim>}
      <Button title="Ask the crowd" disabled={!valid} loading={busy} onPress={save} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
