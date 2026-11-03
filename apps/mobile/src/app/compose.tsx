import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LIMITS, type PostKind, type Target, type TargetType } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, loadItems } from '../lib/hooks';
import { Seg } from '../components/screen';
import { TargetPicker } from '../components/target-picker';
import { Button, Input, Stars, T } from '../components/ui';
import { C, F } from '../components/theme';

export default function Compose() {
  const params = useLocalSearchParams<{ kind?: PostKind; target?: string }>();
  const { toast } = useSession();
  const [kind, setKind] = useState<PostKind>(params.kind ?? 'take');
  const [target, setTarget] = useState<Target | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!params.target) return;
    const [type, id] = params.target.split(':') as [TargetType, string];
    if (type === 'item') loadItems([id]).then(() => force(n => n + 1));
    setTarget({ type, id });
  }, [params.target]);

  const limit = kind === 'take' ? LIMITS.take : kind === 'review' ? LIMITS.review : LIMITS.thread;
  const valid = body.trim().length > 0 && body.length <= limit && (kind !== 'review' || (target?.type === 'item' && rating > 0)) && (kind !== 'thread' || title.trim().length > 0);

  const post = async () => {
    setBusy(true);
    try {
      const id = await api.createPost({ kind, target, rating: kind === 'review' ? rating : null, title: kind === 'thread' ? title.trim() : null, body: body.trim(), spoiler });
      if (kind === 'review' && target?.type === 'item') await api.log(target.id, rating).catch(() => {});
      toast('Posted');
      router.back();
      setTimeout(() => router.push(`/post/${id}` as never), 250);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={60}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Seg dark={false} value={kind} onChange={setKind} options={[['take', 'Hot take'], ['review', 'Review'], ['thread', 'Thread']]} />
      <T.Dim>{kind === 'take' ? 'One opinion, 280 characters. People vote agree or disagree.' : kind === 'review' ? 'Rate it and say why. Reviews also log it to your diary.' : 'Start a longer discussion on a board.'}</T.Dim>
      <TargetPicker value={target} onChange={setTarget} itemsOnly={kind === 'review'} />
      {kind === 'review' && <View style={{ gap: 6 }}><T.Label>Your rating {rating ? `· ${(rating / 2).toFixed(1)}` : ''}</T.Label><Stars r10={rating} size={36} color={C.blue} onChange={setRating} /></View>}
      {kind === 'thread' && <Input value={title} onChangeText={setTitle} placeholder="Title" maxLength={LIMITS.threadTitle} style={{ fontFamily: F.bold, fontSize: 18 }} />}
      <Input value={body} onChangeText={setBody} multiline autoFocus={kind === 'take'} placeholder={kind === 'take' ? 'Say the thing.' : kind === 'review' ? 'What did it do to you?' : 'Kick it off.'} style={{ minHeight: kind === 'take' ? 120 : 220, fontSize: kind === 'take' ? 19 : 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setSpoiler(!spoiler)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Switch value={spoiler} onValueChange={setSpoiler} trackColor={{ true: C.blue }} /><Text style={{ fontFamily: F.medium, color: C.text, fontSize: 15 }}>Spoilers</Text></Pressable>
        <Text style={{ fontFamily: F.semibold, color: body.length > limit ? C.bad : C.dim }}>{limit - body.length}</Text>
      </View>
      <Button title="Post" loading={busy} disabled={!valid} onPress={post} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
