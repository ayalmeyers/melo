import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EMAIL_RE } from '@melo/core';
import { api, WEB_URL } from '../lib/supabase';
import { useSession } from '../lib/session';
import { errText, openWeb } from '../lib/hooks';
import { Button, Icon, Input, T } from '../components/ui';
import { C, F } from '../components/theme';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { reload } = useSession();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return setErr('Enter a valid email address.');
    setBusy(true); setErr(null);
    try {
      if (mode === 'up') await api.signUp(em, password, `${WEB_URL.replace(/\/$/, '')}/confirmed`); else await api.signIn(em, password);
      await reload();
      const me = await api.me();
      if (!me || !me.accepted_terms_at) router.replace('/onboarding'); else router.back();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.ink, paddingTop: insets.top + 12, paddingHorizontal: 22, paddingBottom: insets.bottom + 20 }}>
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={{ alignSelf: 'flex-end' }}><Icon name="xmark" size={20} color="#fff" /></Pressable>
    <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontFamily: F.heavy, fontSize: 44, color: '#fff', letterSpacing: -1.5 }}>melo<Text style={{ color: C.blue }}>.</Text></Text>
      <T.Display>{mode === 'in' ? 'Welcome back.' : 'Join Melo.'}</T.Display>
      <Input dark value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
      <Input dark value={password} onChangeText={setPassword} placeholder={mode === 'up' ? 'Password (8+ characters)' : 'Password'} secureTextEntry autoCapitalize="none" textContentType={mode === 'up' ? 'newPassword' : 'password'} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} returnKeyType="go" onSubmitEditing={submit} />
      {err && <Text style={{ color: '#ff8a8a', fontFamily: F.medium, fontSize: 14.5 }}>{err}</Text>}
      <Button title={mode === 'in' ? 'Sign in' : 'Create account'} loading={busy} disabled={!email.trim() || !password} onPress={submit} />
      {mode === 'in' && <Text onPress={() => openWeb('/login?mode=forgot')} style={{ color: C.onInkDim, fontFamily: F.semibold, textAlign: 'center', fontSize: 15 }}>Forgot password?</Text>}
      <Text onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(null); }} style={{ color: C.onInkDim, fontFamily: F.semibold, textAlign: 'center', fontSize: 15 }}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</Text>
    </View>
    <Text style={{ color: C.onInkDim, fontFamily: F.medium, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>
      By continuing you agree to the <Text style={{ color: '#fff' }} onPress={() => openWeb('/terms')}>Terms</Text> and <Text style={{ color: '#fff' }} onPress={() => openWeb('/privacy')}>Privacy Policy</Text>.
    </Text>
  </KeyboardAvoidingView>;
}
