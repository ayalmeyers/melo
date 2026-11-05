import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ChartKind, ChartScope } from '@melo/core';
import { useSession } from '../lib/session';
import { go, shareLink, useLoad } from '../lib/hooks';
import { ChartRowView, loadChart } from '../components/chart';
import { Screen, Seg } from '../components/screen';
import { Band, Button, Empty, Sheet, T } from '../components/ui';
import { C, F } from '../components/theme';
import { ErrorView, Loading } from '../components/skeleton';

/** This week on Melo: what everyone, or just the people you follow, logged most. */
export default function Charts() {
  const { user, follows } = useSession();
  const [scope, setScope] = useState<ChartScope>('public');
  const [kind, setKind] = useState<ChartKind>('albums');
  const chart = useLoad(() => (scope === 'friends' && !user ? Promise.resolve([]) : loadChart(scope, kind)), [scope, kind, user?.id]);
  return <Screen top={false} onRefresh={chart.reload}>
    <Band>
      <T.Display>This week</T.Display>
      <Text style={{ fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: C.onInkDim }}>Ranked by how many people logged it in the last 7 days, then by rating. Arrows compare with the week before.</Text>
      <Seg value={scope} onChange={setScope} options={[['public', 'Everyone'], ['friends', 'Friends']]} />
      <Seg value={kind} onChange={setKind} options={[['albums', 'Albums'], ['artists', 'Artists'], ['podcasts', 'Podcasts']]} />
    </Band>
    <Sheet>
      {scope === 'friends' && !user ? <Button title="Sign in to see your friends' chart" onPress={() => go('/login')} />
        : scope === 'friends' && !follows.users.size ? <View style={{ gap: 12 }}><Empty text="Follow people to build your friends' chart. It counts you and everyone you follow." /><Button kind="ghost" title="Find people" onPress={() => go('/discover')} /></View>
        : chart.data && !chart.data.length ? <Empty text={scope === 'friends' ? 'Nobody in your circle has logged anything this week. Be the first.' : 'The chart fills up as people log what they listen to this week.'} />
        : chart.error ? <ErrorView message={chart.error} onRetry={chart.reload} />
        : !chart.data ? <Loading n={8} />
        : <View style={{ gap: 14 }}>{(chart.data ?? []).map(r => <ChartRowView key={r.subject_id} r={r} />)}</View>}
      {scope === 'public' && !!chart.data?.length && <Button kind="ghost" title="Share this chart" icon="square.and.arrow.up" onPress={() => shareLink(`/charts?kind=${kind}`, `This week's ${kind} chart on Melo`)} />}
    </Sheet>
  </Screen>;
}
