import { Pressable, Text, View } from 'react-native';
import { ago } from '@melo/core';
import { api } from '../lib/supabase';
import { useSession } from '../lib/session';
import { go, useLoad } from '../lib/hooks';
import { Screen } from '../components/screen';
import { Avatar, Button, Empty, Sheet } from '../components/ui';
import { C, F } from '../components/theme';

export default function Activity() {
  const { user } = useSession();
  const act = useLoad(async () => {
    if (!user) return null;
    const a = await api.activity(50);
    const ps = Object.fromEntries((await api.profilesByIds(a.followers.map(f => f.follower))).map(p => [p.id, p]));
    const rows = [
      ...a.replies.map(c => ({ at: c.created_at, key: 'c' + c.id, name: c.author_name, color: c.author_color, text: `commented: ${c.body}`, href: `/post/${c.post_id}` })),
      ...a.followers.filter(f => ps[f.follower]).map(f => ({ at: f.created_at, key: 'f' + f.follower, name: ps[f.follower].name, color: ps[f.follower].color, text: 'followed you', href: `/user/${ps[f.follower].handle}` })),
    ];
    return rows.sort((x, y) => y.at.localeCompare(x.at));
  }, [user?.id]);
  return <Screen top={false} onRefresh={act.reload}>
    <Sheet style={{ marginTop: 0 }}>
      {!user ? <Button title="Sign in" onPress={() => go('/login')} /> : act.data && !act.data.length ? <Empty text="Replies and new followers show up here." /> : (act.data ?? []).map(r =>
        <Pressable key={r.key} onPress={() => go(r.href)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Avatar name={r.name} color={r.color} size={40} />
          <View style={{ flex: 1 }}><Text style={{ fontFamily: F.medium, fontSize: 15, color: C.text }} numberOfLines={2}><Text style={{ fontFamily: F.bold }}>{r.name}</Text> {r.text}</Text><Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.dim }}>{ago(r.at)}</Text></View>
        </Pressable>)}
    </Sheet>
  </Screen>;
}
