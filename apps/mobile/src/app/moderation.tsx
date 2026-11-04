import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { ago, type QueuedReport, type ReportAction } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { fail, go, useLoad } from '../lib/hooks';
import { Screen, Seg } from '../components/screen';
import { Button, Empty, Sheet, T } from '../components/ui';
import { C, F } from '../components/theme';

/** Admin report queue. Apple expects reports on user content to be handled within 24 hours. */
export default function Moderation() {
  const { profile, toast } = useSession();
  const [status, setStatus] = useState<'open' | 'actioned' | 'dismissed'>('open');
  const q = useLoad(() => (profile?.is_admin ? api.reportQueue(status) : Promise.resolve([])), [status, profile?.is_admin]);
  if (!profile?.is_admin) return <Screen top={false}><Sheet style={{ marginTop: 0 }}><Empty text="Moderation is for admins." /></Sheet></Screen>;

  const act = (r: QueuedReport, action: ReportAction) => {
    const run = () => api.moderate(r.id, action).then(() => { toast(action === 'dismiss' ? 'Dismissed' : action === 'unban' ? 'Unbanned' : action === 'ban' ? 'Removed and banned' : 'Removed'); q.reload(); }).catch(fail);
    if (action === 'ban') Alert.alert(`Ban @${r.author_handle}?`, 'Removes this content and stops them from posting, commenting or messaging.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Ban', style: 'destructive', onPress: run }]);
    else run();
  };

  return <Screen top={false} onRefresh={q.reload}>
    <Sheet style={{ marginTop: 0 }}>
      <Seg dark={false} value={status} onChange={setStatus} options={[['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed']]} />
      {q.data && !q.data.length ? <Empty text={status === 'open' ? 'Nothing to review. Nice.' : 'Nothing here.'} /> : (q.data ?? []).map(r => <View key={r.id} style={{ backgroundColor: C.mist, borderRadius: 20, padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T.Label>{r.target_type}{r.reports_on_target > 1 ? ` · ${r.reports_on_target} reports` : ''}</T.Label>
          <T.Dim>{ago(r.created_at)}</T.Dim>
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 15.5, lineHeight: 22, color: r.content ? C.text : C.dim }} numberOfLines={8}>{r.content ?? 'Already deleted.'}</Text>
        <T.Dim>by {r.author_handle ? `@${r.author_handle}` : 'unknown'}{r.author_banned ? ' (banned)' : ''} · reported by {r.reporter_handle ? `@${r.reporter_handle}` : 'someone'}{r.reason ? ` · "${r.reason}"` : ''}</T.Dim>
        {r.link && r.link.startsWith('/p/') && <Text onPress={() => go(r.link!.replace('/p/', '/post/'))} style={{ fontFamily: F.semibold, color: C.blue }}>Open in context</Text>}
        {status === 'open' && <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {r.target_type !== 'profile' && <Button small kind="danger" title="Remove" onPress={() => act(r, 'remove')} />}
          {!r.author_banned && <Button small kind="dark" title="Ban author" onPress={() => act(r, 'ban')} />}
          {r.author_banned && <Button small kind="ghost" title="Unban" onPress={() => act(r, 'unban')} />}
          <Button small kind="ghost" title="Dismiss" onPress={() => act(r, 'dismiss')} />
        </View>}
      </View>)}
    </Sheet>
  </Screen>;
}
