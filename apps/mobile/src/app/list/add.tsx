import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { Target } from '@melo/core';
import { api } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { fail, targetLabel } from '../../lib/hooks';
import { TargetPicker } from '../../components/target-picker';
import { T } from '../../components/ui';
import { C } from '../../components/theme';

/** Search and add albums to a list, one after another. */
export default function AddToThisList() {
  const { list } = useLocalSearchParams<{ list: string }>();
  const { toast } = useSession();
  const [added, setAdded] = useState<string[]>([]);
  const pick = async (t: Target | null) => {
    if (!t || t.type !== 'item') return;
    try { await api.addToList(list, t.id); setAdded(a => [targetLabel(t), ...a]); toast(`Added ${targetLabel(t)}`); }
    catch (e) { fail(e); }
  };
  return <ScrollView style={{ backgroundColor: C.paper }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
    <TargetPicker value={null} onChange={pick} itemsOnly />
    {!!added.length && <T.Dim>Added: {added.join(', ')}</T.Dim>}
  </ScrollView>;
}
