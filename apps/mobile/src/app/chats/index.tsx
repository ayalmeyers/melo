import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { ago, type Profile } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { go, useLoad } from '../../lib/hooks';
import { Screen } from '../../components/screen';
import { Avatar, Button, Empty, Icon, Sheet } from '../../components/ui';
import { C, F } from '../../components/theme';
import { ErrorView, Loading } from '../../components/skeleton';

export default function Chats() {
  const { user } = useSession();
  const chats = useLoad(async () => {
    if (!user) return null;
    const cs = await api.chats();
    const ids = [...new Set(cs.flatMap(c => c.members.map(m => m.user_id)))];
    const ps = Object.fromEntries((await api.profilesByIds(ids)).map(p => [p.id, p])) as Record<string, Profile>;
    return cs.map(c => {
      const others = c.members.filter(m => m.user_id !== user.id).map(m => ps[m.user_id]).filter(Boolean);
      const me = c.members.find(m => m.user_id === user.id);
      const unread = !!c.last_message_at && c.last_message_by !== user.id && (!me || new Date(c.last_message_at) > new Date(me.last_read_at));
      return { ...c, others, unread, label: c.name || others.map(o => o.name).join(', ') || 'Just you' };
    });
  }, [user?.id]);

  return <Screen top={false} onRefresh={chats.reload}>
    <Stack.Screen options={{ title: 'Chats', headerRight: () => <Pressable hitSlop={10} onPress={() => go('/chats/new')} accessibilityLabel="New chat"><Icon name="square.and.pencil" size={20} color={C.text} /></Pressable> }} />
    <Sheet style={{ marginTop: 0 }}>
      {!user ? <Button title="Sign in to chat" onPress={() => go('/login')} />
        : chats.error ? <ErrorView message={chats.error} onRetry={chats.reload} />
        : !chats.data ? <Loading n={6} round />
        : !chats.data.length ? <><Empty text="No chats yet. Start one with people you follow, or send an album to a friend." /><Button title="New chat" onPress={() => go('/chats/new')} /></>
          : (chats.data ?? []).map(c => <Pressable key={c.id} onPress={() => go(`/chats/${c.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View>{c.others[0] ? <Avatar name={c.others[0].name} color={c.others[0].color} size={50} /> : <Avatar name={c.label} size={50} />}
              {c.others.length > 1 && <View style={{ position: 'absolute', right: -4, bottom: -4, backgroundColor: C.ink, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 11 }}>{c.others.length}</Text></View>}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: c.unread ? F.heavy : F.bold, fontSize: 16, color: C.text }} numberOfLines={1}>{c.label}</Text>
              <Text style={{ fontFamily: c.unread ? F.semibold : F.medium, fontSize: 14, color: c.unread ? C.text : C.dim }} numberOfLines={1}>{c.last_message_preview ?? 'Say hi'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {c.last_message_at && <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.dim }}>{ago(c.last_message_at)}</Text>}
              {c.unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue }} />}
            </View>
          </Pressable>)}
    </Sheet>
  </Screen>;
}
