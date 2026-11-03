import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Forecast, ForecastConsensus } from '@melo/core';
import { api, configured } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { go, useLoad } from '../../lib/hooks';
import { Screen, Seg } from '../../components/screen';
import { ForecastCard } from '../../components/rows';
import { Avatar, Band, Button, Empty, Sheet, T } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function Forecasts() {
  const { user } = useSession();
  const [tab, setTab] = useState<'open' | 'resolved' | 'ears'>('open');
  const list = useLoad(() => (configured && tab !== 'ears' ? api.forecasts(tab) : Promise.resolve(null)), [tab]);
  const ears = useLoad(async () => {
    if (!configured || tab !== 'ears') return null;
    const board = await api.earBoard(50);
    const ps = await api.profilesByIds(board.map(b => b.user_id));
    const byId = Object.fromEntries(ps.map(p => [p.id, p]));
    return board.map(b => ({ ...b, p: byId[b.user_id] })).filter(b => b.p);
  }, [tab]);

  return <Screen onRefresh={() => (tab === 'ears' ? ears.reload() : list.reload())}>
    <Band>
      <T.Display>Forecasts</T.Display>
      <Text style={{ fontFamily: F.medium, fontSize: 15.5, lineHeight: 22, color: C.onInkDim }}>Call what happens next in music. The crowd's number weights people by how often they've been right. That's your Ear score.</Text>
      <Seg value={tab} onChange={setTab} options={[['open', 'Open'], ['resolved', 'Resolved'], ['ears', 'Best Ears']]} />
    </Band>
    <Sheet>
      {tab !== 'ears' && <Button title="Ask the crowd" icon="plus" kind="ghost" onPress={() => go(user ? '/ask' : '/login')} />}
      {tab === 'ears'
        ? ears.data && !ears.data.length ? <Empty text="Ear scores appear once forecasts resolve." />
          : (ears.data ?? []).map((b, i) => <Pressable key={b.user_id} onPress={() => go(`/user/${b.p.handle}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontFamily: F.heavy, fontSize: 18, color: C.dim, width: 26 }}>{i + 1}</Text>
            <Avatar name={b.p.name} color={b.p.color} size={40} />
            <View style={{ flex: 1 }}><T.Bold>{b.p.name}</T.Bold><T.Dim>{b.resolved} resolved</T.Dim></View>
            <Text style={{ fontFamily: F.heavy, fontSize: 24, color: C.blue }}>{Math.round(b.ear)}</Text>
          </Pressable>)
        : list.data && !list.data.length ? <Empty text={tab === 'open' ? 'No open questions. Ask one.' : 'Nothing has resolved yet.'} />
          : <View style={{ gap: 12 }}>{(list.data ?? []).map(f => <ForecastCard key={f.id} f={f} />)}</View>}
    </Sheet>
  </Screen>;
}
