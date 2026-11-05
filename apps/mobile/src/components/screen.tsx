import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';
import { Chip } from './ui';

/** Scrolling page: ink band on top (safe-area aware when there is no header), white sheet below, pull to refresh. */
export function Screen({ children, onRefresh, top = true, keyboard }: { children: React.ReactNode; onRefresh?: () => Promise<unknown>; top?: boolean; keyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const body = <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: top ? insets.top : 0 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
    refreshControl={onRefresh ? <RefreshControl tintColor={C.dim} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }} /> : undefined}>
    {children}
  </ScrollView>;
  return keyboard ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={top ? 0 : 100}>{body}</KeyboardAvoidingView> : body;
}

export function Seg<V extends string>({ value, options, onChange, dark = true }: { value: V; options: [V, string][]; onChange: (v: V) => void; dark?: boolean }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
    {options.map(([v, l]) => <Chip key={v} label={l} on={v === value} dark={dark} onPress={() => onChange(v)} />)}
  </ScrollView>;
}
