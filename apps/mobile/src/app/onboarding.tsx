import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALBUMS, AVATAR_COLORS, CNAME, FLAG, GENRES, HANDLE_RE, hash } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { errText, openWeb } from '../lib/hooks';
import { Button, Chip, Icon, Input, ItemCover, T } from '../components/ui';
import { C, F } from '../components/theme';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const cell = Math.floor((useWindowDimensions().width - 44 - 20) / 3);
  const { user, profile, reload } = useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? '');
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [cc, setCc] = useState(profile?.cc || 'US');
  const [terms, setTerms] = useState(false);
  const [avail, setAvail] = useState<boolean | null>(null);
  const [top4, setTop4] = useState<string[]>(profile?.top4 ?? []);
  const [genres, setGenres] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ccOpen, setCcOpen] = useState(false);

  useEffect(() => {
    const h = handle.toLowerCase();
    if (!HANDLE_RE.test(h)) { setAvail(null); return; }
    if (profile?.handle === h) { setAvail(true); return; }
    const t = setTimeout(() => api.handleAvailable(h).then(setAvail).catch(() => setAvail(null)), 300);
    return () => clearTimeout(t);
  }, [handle, profile?.handle]);

  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      await api.saveProfile({ name: name.trim(), handle: handle.toLowerCase(), cc, top4, color: profile?.color || AVATAR_COLORS[hash(user!.id) % AVATAR_COLORS.length], acceptTerms: true });
      await Promise.all([...genres].map(g => api.follow('genre', g, true)));
      await reload();
      router.replace('/');
    } catch (e) { setErr(errText(e)); setStep(0); } finally { setBusy(false); }
  };

  const okStep0 = name.trim().length >= 1 && HANDLE_RE.test(handle.toLowerCase()) && avail !== false && terms;

  return <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
    <ScrollView contentContainerStyle={{ padding: 22, gap: 18, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: F.semibold, color: C.blue, fontSize: 14 }}>Step {step + 1} of 3</Text>
      {step === 0 && <>
        <T.Display>Welcome to Melo.</T.Display>
        <T.Body style={{ color: C.onInkDim }}>Who's listening?</T.Body>
        <Input dark value={name} onChangeText={setName} placeholder="Your name" maxLength={50} textContentType="name" />
        <View>
          <Input dark value={handle} onChangeText={t => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} placeholder="username" autoCapitalize="none" autoCorrect={false} textContentType="username" style={{ paddingLeft: 32 }} />
          <Text style={{ position: 'absolute', left: 14, top: 13, fontSize: 16, color: C.onInkDim, fontFamily: F.medium }}>@</Text>
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: avail === false ? '#ff8a8a' : C.onInkDim }}>{avail === false ? 'That username is taken.' : avail ? 'Available.' : '3 to 20 letters, numbers or underscores.'}</Text>
        <Pressable onPress={() => setCcOpen(!ccOpen)} style={{ backgroundColor: C.ink2, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontFamily: F.medium, fontSize: 16 }}>Listening from: {FLAG[cc]} {CNAME[cc]}</Text><Icon name={ccOpen ? 'chevron.up' : 'chevron.down'} size={16} color={C.onInkDim} />
        </Pressable>
        {ccOpen && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.keys(FLAG).map(c => <Chip key={c} label={`${FLAG[c]} ${CNAME[c]}`} on={c === cc} onPress={() => { setCc(c); setCcOpen(false); }} />)}</View>}
        <Pressable onPress={() => setTerms(!terms)} accessibilityRole="checkbox" accessibilityState={{ checked: terms }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Icon name={terms ? 'checkmark.square.fill' : 'square'} size={24} color={terms ? C.blue : C.onInkDim} />
          <Text style={{ flex: 1, color: C.onInk, fontFamily: F.medium, fontSize: 14.5, lineHeight: 21 }}>
            I agree to the <Text style={{ color: C.blue }} onPress={() => openWeb('/terms')}>Terms</Text>, including that Melo has no tolerance for abusive or objectionable content, and to the <Text style={{ color: C.blue }} onPress={() => openWeb('/privacy')}>Privacy Policy</Text>.
          </Text>
        </Pressable>
        {err && <Text style={{ color: '#ff8a8a', fontFamily: F.medium }}>{err}</Text>}
      </>}
      {step === 1 && <>
        <T.Display>Pick your Top 4.</T.Display>
        <T.Body style={{ color: C.onInkDim }}>The four records that explain you. {top4.length}/4. You can change these later.</T.Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {ALBUMS.map(([id, title]) => { const i = top4.indexOf(id); return <Pressable key={id} accessibilityLabel={title} accessibilityState={{ selected: i >= 0 }} onPress={() => setTop4(i >= 0 ? top4.filter(x => x !== id) : top4.length < 4 ? [...top4, id] : top4)} style={{ width: cell, height: cell, borderRadius: 14, borderWidth: 3, borderColor: i >= 0 ? C.blue : 'transparent', overflow: 'hidden' }}>
            <ItemCover item={{ id, title, type: 'album' }} size={cell - 6} radius={11} />
            {i >= 0 && <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold }}>{i + 1}</Text></View>}
          </Pressable>; })}
        </View>
      </>}
      {step === 2 && <>
        <T.Display>Follow some genres.</T.Display>
        <T.Body style={{ color: C.onInkDim }}>Their boards and discussions show up in your Following feed.</T.Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(GENRES).map(([id, g]) => <Chip key={id} label={g.name} on={genres.has(id)} onPress={() => { const n = new Set(genres); if (n.has(id)) n.delete(id); else n.add(id); setGenres(n); }} />)}
        </View>
      </>}
    </ScrollView>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 22, paddingBottom: insets.bottom + 14, backgroundColor: C.bg, flexDirection: 'row', gap: 10 }}>
      {step > 0 && <Button kind="dark" title="Back" onPress={() => setStep(step - 1)} />}
      <Button style={{ flex: 1 }} loading={busy} disabled={step === 0 && !okStep0} title={step === 2 ? 'Start listening' : step === 1 && top4.length < 4 ? 'Skip for now' : 'Next'} onPress={() => (step === 2 ? finish() : setStep(step + 1))} />
    </View>
  </View>;
}
