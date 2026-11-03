import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EMAIL_RE } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { errText, openWeb } from '../lib/hooks';
import { Button, Icon, Input, T } from '../components/ui';
import { C, F } from '../components/theme';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { reload } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) return setErr('Enter a valid email address.');
    setBusy(true); setErr(null);
    try { await api.sendCode(email.trim().toLowerCase()); setSent(true); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    try {
      await api.verifyCode(email.trim().toLowerCase(), code.trim());
      await reload();
      const me = await api.me();
      router.dismissAll?.();
      if (!me || !me.accepted_terms_at) router.replace('/onboarding'); else router.back();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.ink, paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 20 }}>
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={{ alignSelf: 'flex-end' }}><Icon name="xmark" size={20} color="#fff" /></Pressable>
    <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
      <Text style={{ fontFamily: F.heavy, fontSize: 44, color: '#fff', letterSpacing: -1.5 }}>melo<Text style={{ color: C.blue }}>.</Text></Text>
      <T.Display>{sent ? 'Check your email.' : 'Sign in or join.'}</T.Display>
      <T.Body style={{ color: C.onInkDim }}>{sent ? `We sent a 6-digit code to ${email.trim()}. It expires in an hour.` : 'No password. We email you a code.'}</T.Body>
      {!sent
        ? <Input dark value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus returnKeyType="send" onSubmitEditing={send} />
        : <Input dark value={code} onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="123456" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoFocus style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center', fontFamily: F.bold }} />}
      {err && <Text style={{ color: '#ff8a8a', fontFamily: F.medium, fontSize: 14.5 }}>{err}</Text>}
      <Button title={sent ? 'Continue' : 'Email me a code'} loading={busy} disabled={sent ? code.length !== 6 : !email.trim()} onPress={sent ? verify : send} />
      {sent && <Text onPress={() => { setSent(false); setCode(''); }} style={{ color: C.onInkDim, fontFamily: F.semibold, textAlign: 'center', fontSize: 15 }}>Use a different email</Text>}
    </View>
    <Text style={{ color: C.onInkDim, fontFamily: F.medium, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>
      By continuing you agree to the <Text style={{ color: '#fff' }} onPress={() => openWeb('/terms')}>Terms</Text> and <Text style={{ color: '#fff' }} onPress={() => openWeb('/privacy')}>Privacy Policy</Text>.
    </Text>
  </KeyboardAvoidingView>;
}
