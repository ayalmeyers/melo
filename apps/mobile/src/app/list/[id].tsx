import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { cachedItem, fail, go, loadItems, shareLink, useLoad } from '../../lib/hooks';
import { moderate } from '../../components/post';
import { Screen } from '../../components/screen';
import { Avatar, Band, Button, Empty, Icon, Input, ItemCover, Sheet, T } from '../../components/ui';
import { C, F } from '../../components/theme';

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, toast } = useSession();
  const data = useLoad(async () => { const d = await api.list(id); if (d) await loadItems(d.entries.map(e => e.item_id)); return d; }, [id]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [ranked, setRanked] = useState(true);
  if (!data.data) return <Screen top={false}><Band><T.Display>{data.loading ? '' : 'List not found.'}</T.Display></Band></Screen>;
  const { list, entries } = data.data;
  const mine = user?.id === list.owner;

  const startEdit = () => { setTitle(list.title); setDesc(list.description); setRanked(list.ranked); setEditing(true); };
  const save = async () => { try { await api.updateList(id, { title: title.trim() || list.title, description: desc.trim(), ranked }); setEditing(false); data.reload(); } catch (e) { fail(e); } };
  const move = async (i: number, d: -1 | 1) => {
    const ids = entries.map(e => e.item_id); const j = i + d; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    data.setData({ list, entries: ids.map((x, k) => ({ ...entries.find(e => e.item_id === x)!, position: k })) });
    api.reorderList(id, ids).catch(fail);
  };
  const remove = (itemId: string) => api.removeFromList(id, itemId).then(data.reload).catch(fail);
  const note = (itemId: string, current: string) => Alert.prompt?.('Note', 'Why it’s here (280 characters)', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: v => api.setListNote(id, itemId, (v ?? '').slice(0, 280)).then(data.reload).catch(fail) }], 'plain-text', current);
  const del = () => Alert.alert('Delete this list?', 'The list goes away; the albums stay on Melo.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => api.deleteList(id).then(() => { toast('List deleted'); router.back(); }).catch(fail) }]);

  return <Screen top={false} keyboard onRefresh={data.reload}>
    <Stack.Screen options={{ title: '', headerRight: () => <Pressable hitSlop={10} onPress={() => shareLink(`/lists/${id}`, `${list.title}, a list by ${list.owner_name} on Melo`)}><Icon name="square.and.arrow.up" size={20} color="#fff" /></Pressable> }} />
    <Band>
      {editing ? <View style={{ gap: 10 }}>
        <Input dark value={title} onChangeText={setTitle} maxLength={100} placeholder="Title" />
        <Input dark value={desc} onChangeText={setDesc} maxLength={1000} placeholder="What ties these together?" multiline />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Switch value={ranked} onValueChange={setRanked} trackColor={{ true: C.blue }} /><Text style={{ color: '#fff', fontFamily: F.medium }}>Ranked list</Text></View>
        <View style={{ flexDirection: 'row', gap: 10 }}><Button small title="Save" onPress={save} /><Button small kind="dark" title="Cancel" onPress={() => setEditing(false)} /><Button small kind="danger" title="Delete list" onPress={del} /></View>
      </View> : <>
        <Text style={{ fontFamily: F.semibold, fontSize: 12.5, letterSpacing: 1, color: C.blue }}>{list.ranked ? 'RANKED LIST' : 'LIST'}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 28, lineHeight: 32, color: '#fff' }}>{list.title}</Text>
        {!!list.description && <Text style={{ fontFamily: F.medium, fontSize: 15.5, lineHeight: 22, color: C.onInk }}>{list.description}</Text>}
        <Pressable onPress={() => go(`/user/${list.owner_handle}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Avatar name={list.owner_name} color={list.owner_color} size={26} /><Text style={{ color: C.onInkDim, fontFamily: F.semibold }}>{list.owner_name} · {list.item_count} records</Text></Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {mine ? <Button small kind="dark" title="Edit list" icon="pencil" onPress={startEdit} />
            : <Button small kind="dark" title="Report" onPress={() => moderate({ kind: 'profile', id: list.owner, authorId: list.owner, authorHandle: list.owner_handle, mine: false })} />}
        </View>
      </>}
    </Band>
    <Sheet>
      {mine && <Button kind="ghost" title="Add albums" icon="plus" onPress={() => go(`/list/add?list=${id}`)} />}
      {!entries.length ? <Empty text={mine ? 'Empty so far. Add albums from here or from any album page.' : 'Nothing on this list yet.'} /> : entries.map((e, i) => {
        const it = cachedItem(e.item_id);
        return <View key={e.item_id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {list.ranked && <Text style={{ fontFamily: F.heavy, fontSize: 20, color: i === 0 ? C.blue : C.text, width: 30, textAlign: 'center' }}>{i + 1}</Text>}
          <Pressable onPress={() => go(`/item/${e.item_id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
            {it && <ItemCover item={it} size={58} radius={10} />}
            <View style={{ flex: 1 }}>
              <T.Bold numberOfLines={1}>{it?.title ?? e.item_id}</T.Bold>
              <T.Dim numberOfLines={1}>{it?.artist_name}{it?.year ? ` · ${it.year}` : ''}</T.Dim>
              {!!e.note && <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.text, marginTop: 3 }}>{e.note}</Text>}
            </View>
          </Pressable>
          {mine && editing && <View style={{ gap: 6 }}>
            <Pressable hitSlop={6} onPress={() => move(i, -1)} accessibilityLabel="Move up"><Icon name="chevron.up" size={16} color={C.dim} /></Pressable>
            <Pressable hitSlop={6} onPress={() => move(i, 1)} accessibilityLabel="Move down"><Icon name="chevron.down" size={16} color={C.dim} /></Pressable>
          </View>}
          {mine && editing && <View style={{ gap: 6 }}>
            <Pressable hitSlop={6} onPress={() => note(e.item_id, e.note)} accessibilityLabel="Edit note"><Icon name="text.bubble" size={16} color={C.dim} /></Pressable>
            <Pressable hitSlop={6} onPress={() => remove(e.item_id)} accessibilityLabel="Remove"><Icon name="minus.circle" size={16} color={C.bad} /></Pressable>
          </View>}
        </View>;
      })}
    </Sheet>
  </Screen>;
}
