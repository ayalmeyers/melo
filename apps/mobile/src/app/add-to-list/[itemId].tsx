import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { cachedItem, fail, go, useLoad } from '../../lib/hooks';
import { Button, Empty, Icon, T } from '../../components/ui';
import { C } from '../../components/theme';

/** Toggle an album on or off any of your lists. */
export default function AddToList() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { user, toast } = useSession();
  const mine = useLoad(async () => (user ? api.lists({ owner: user.id, limit: 100 }) : []), [user?.id]);
  const containing = useLoad(async () => new Set((await api.lists({ containing: itemId, limit: 200 })).map(l => l.id)), [itemId]);
  const [busy, setBusy] = useState<string | null>(null);
  if (!user) return <View style={{ padding: 20, gap: 12 }}><T.Body>Sign in to make lists.</T.Body><Button title="Sign in" onPress={() => go('/login')} /></View>;
  const toggle = async (listId: string, on: boolean) => {
    setBusy(listId);
    try { if (on) await api.removeFromList(listId, itemId); else await api.addToList(listId, itemId); toast(on ? 'Removed' : 'Added'); await containing.reload(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };
  return <ScrollView style={{ backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, gap: 14 }}>
    <T.H2>{cachedItem(itemId)?.title ?? 'Add to a list'}</T.H2>
    <Button kind="ghost" icon="plus" title="New list" onPress={() => go(`/list/new?add=${itemId}`)} />
    {mine.data && !mine.data.length ? <Empty text="You haven't made a list yet." /> : (mine.data ?? []).map(l => {
      const on = containing.data?.has(l.id) ?? false;
      return <Pressable key={l.id} disabled={busy === l.id} onPress={() => toggle(l.id, on)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
        <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? C.blue : C.line} />
        <View style={{ flex: 1 }}><T.Bold>{l.title}</T.Bold><T.Dim>{l.item_count} records</T.Dim></View>
      </Pressable>;
    })}
  </ScrollView>;
}
