import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { fail, go, shareLink, useLoad } from '../../lib/hooks';
import { Screen } from '../../components/screen';
import { Comments } from '../../components/social';
import { TargetChip } from '../../components/post';
import { Band, Button, Empty, Sheet, T } from '../../components/ui';
import { C, F } from '../../components/theme';

function Slider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const w = useRef(1);
  const set = (x: number) => { const v = Math.max(1, Math.min(99, Math.round((x / w.current) * 100))); if (v !== value) { if (v % 5 === 0) Haptics.selectionAsync().catch(() => {}); onChange(v); } };
  return <View accessibilityRole="adjustable" accessibilityLabel="Your probability" accessibilityValue={{ min: 1, max: 99, now: value, text: `${value} percent` }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => onChange(Math.max(1, Math.min(99, value + (e.nativeEvent.actionName === 'increment' ? 5 : -5))))}
    onLayout={e => { w.current = e.nativeEvent.layout.width; }} onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled}
    onResponderGrant={e => set(e.nativeEvent.locationX)} onResponderMove={e => set(e.nativeEvent.locationX)}
    style={{ height: 44, justifyContent: 'center' }}>
    <View style={{ height: 10, borderRadius: 5, backgroundColor: C.line }}><View style={{ width: `${value}%`, height: '100%', borderRadius: 5, backgroundColor: C.blue }} /></View>
    <View pointerEvents="none" style={{ position: 'absolute', left: `${value}%`, marginLeft: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', borderWidth: 3, borderColor: C.blue }} />
  </View>;
}

export default function ForecastScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile, toast } = useSession();
  const f = useLoad(() => api.forecast(id), [id]);
  const [p, setP] = useState(50);
  const [saving, setSaving] = useState(false);
  const mine = f.data?.preds.find(x => x.user_id === user?.id);
  useEffect(() => { if (mine) setP(mine.p); }, [mine?.p]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = f.data;
  if (!d) return <Screen top={false}><Band><T.Display>{f.loading ? '' : 'Not found.'}</T.Display></Band></Screen>;
  const closed = new Date(d.closes_on).getTime() < Date.now() || !!d.c?.outcome;
  const dist = d.c?.distribution ?? [];
  const max = Math.max(1, ...dist);

  const save = async () => {
    if (!user) return go('/login');
    setSaving(true);
    try { await api.predict(id, p); toast('Forecast saved'); f.reload(); } catch (e) { fail(e); } finally { setSaving(false); }
  };
  const resolve = () => Alert.alert('Resolve forecast', 'This scores everyone who forecast.', [
    { text: 'Yes, it happened', onPress: () => api.resolve(id, 'yes').then(f.reload).catch(fail) },
    { text: 'No, it did not', onPress: () => api.resolve(id, 'no').then(f.reload).catch(fail) },
    ...(d.c?.outcome ? [{ text: 'Reopen', style: 'destructive' as const, onPress: () => api.resolve(id, null).then(f.reload).catch(fail) }] : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  return <Screen top={false} keyboard onRefresh={f.reload}>
    <Stack.Screen options={{ title: 'Forecast' }} />
    <Band>
      <Text style={{ fontFamily: F.bold, fontSize: 26, lineHeight: 31, color: '#fff' }}>{d.question}</Text>
      {d.target_type && d.target_id && <TargetChip t={{ type: d.target_type, id: d.target_id }} />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18 }}>
        <View>
          <Text style={{ fontFamily: F.heavy, fontSize: 52, color: d.c?.outcome ? (d.c.outcome === 'yes' ? C.good : C.bad) : C.blue, letterSpacing: -1 }}>{d.c?.crowd_p == null ? '—' : d.c.crowd_p + '%'}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.onInkDim }}>{d.c?.outcome ? `Resolved ${d.c.outcome.toUpperCase()}` : 'Crowd, weighted by Ear score'}</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 54 }}>
          {Array.from({ length: 10 }, (_, i) => <View key={i} style={{ flex: 1, height: Math.max(3, ((dist[i] ?? 0) / max) * 54), backgroundColor: '#fff', opacity: 0.2 + ((dist[i] ?? 0) / max) * 0.6, borderRadius: 2 }} />)}
        </View>
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: C.onInkDim }}>{d.c?.forecasters ?? 0} forecasters · closes {new Date(d.closes_on).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      <Button small kind="dark" title="Share" icon="square.and.arrow.up" onPress={() => shareLink(`/forecasts/${id}`, `${d.question} The Melo crowd says ${d.c?.crowd_p ?? '?'}%.`)} style={{ alignSelf: 'flex-start' }} />
    </Band>
    <Sheet>
      {!!d.detail && <View style={{ gap: 6 }}><T.Label>How it resolves</T.Label><T.Body>{d.detail}</T.Body></View>}
      {closed ? <T.Dim>{d.c?.outcome ? 'This forecast has resolved.' : 'Forecasting has closed. Waiting on the result.'}{mine ? ` You said ${mine.p}%.` : ''}</T.Dim> : <View style={{ backgroundColor: C.mist, borderRadius: 22, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><T.Label>Your call</T.Label><Text style={{ fontFamily: F.heavy, fontSize: 30, color: C.text }}>{p}%</Text></View>
        <Slider value={p} onChange={setP} />
        <T.Dim>Chance it happens. Scored with a Brier score when it resolves. You can change it until it closes.</T.Dim>
        <Button title={mine ? 'Update my forecast' : 'Lock it in'} loading={saving} onPress={save} />
      </View>}
      {profile?.is_admin && <Button kind="ghost" title="Resolve (admin)" onPress={resolve} />}
      {d.preds.length === 0 && <Empty text="No one has called this yet." />}
      <Comments on={{ forecast: id }} />
    </Sheet>
  </Screen>;
}
