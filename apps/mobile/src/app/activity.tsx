import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ago, type MeloNotification, type Profile } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { go, useLoad } from '../lib/hooks';
import { pushStatus, registerPush } from '../lib/push';
import { Screen } from '../components/screen';
import { Avatar, Button, Empty, Icon, Sheet } from '../components/ui';
import { C, F } from '../components/theme';
import { ErrorView, Loading } from '../components/skeleton';

const VERB: Record<string, string> = { comment: 'commented on your post', reply: 'replied to you', follow: 'followed you', like: 'liked your post', laugh: 'laughed at your post', resolved: 'A forecast you made resolved' };
const hrefOf = (n: MeloNotification, actor?: Profile) => n.forecast_id ? `/forecast/${n.forecast_id}` : n.post_id ? `/post/${n.post_id}` : actor ? `/user/${actor.handle}` : '/';

export default function Activity() {
  const { user, refreshUnread } = useSession();
  const [push, setPush] = useState<'on' | 'off' | 'unavailable' | null>(null);
  useEffect(() => { pushStatus().then(setPush); }, []);
  const list = useLoad(async () => {
    if (!user) return null;
    const ns = await api.notifications(80);
    const people = Object.fromEntries((await api.profilesByIds([...new Set(ns.map(n => n.actor).filter((a): a is string => !!a))])).map(p => [p.id, p]));
    return { ns, people };
  }, [user?.id]);
  // Opening the list marks everything read; the dots stay until the next visit so you can see what was new.
  useEffect(() => { if (list.data?.ns.some(n => !n.read_at)) api.markNotificationsRead().then(refreshUnread).catch(() => {}); }, [list.data, refreshUnread]);

  return <Screen top={false} onRefresh={list.reload}>
    <Sheet style={{ marginTop: 0 }}>
      {!user ? <Button title="Sign in" onPress={() => go('/login')} /> : <>
        {push === 'off' && <View style={{ backgroundColor: C.blueSoft, borderRadius: 18, padding: 16, gap: 10 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Know when people reply</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 14.5, color: C.dim }}>Get a notification for replies, new followers, messages and resolved forecasts.</Text>
          <Button small title="Turn on notifications" onPress={async () => setPush(await registerPush(true))} style={{ alignSelf: 'flex-start' }} />
        </View>}
        {list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : !list.data ? <Loading n={6} round /> : !list.data.ns.length ? <Empty text="Replies, likes, new followers and resolved forecasts show up here." /> : (list.data?.ns ?? []).map(n => {
          const who = n.actor ? list.data!.people[n.actor] : undefined;
          return <Pressable key={n.id} onPress={() => go(hrefOf(n, who))} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {who ? <Avatar name={who.name} color={who.color} size={42} /> : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}><Icon name="chart.line.uptrend.xyaxis" size={20} color="#fff" /></View>}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.text }} numberOfLines={3}>
                {who && <Text style={{ fontFamily: F.bold }}>{who.name} </Text>}{who ? VERB[n.kind] : VERB.resolved}{n.body ? <Text style={{ color: C.dim }}>{`: ${n.body}`}</Text> : null}
              </Text>
              <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.dim }}>{ago(n.created_at)}</Text>
            </View>
            {!n.read_at && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.blue }} />}
          </Pressable>;
        })}
      </>}
    </Sheet>
  </Screen>;
}
