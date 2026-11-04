import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@melo/core';
import { api, configured } from './supabase';
import { registerPush } from './push';
import { C, F } from '../components/theme';

type Follows = { users: Set<string>; artists: Set<string>; genres: Set<string> };
interface Ctx {
  user: User | null; profile: Profile | null; ready: boolean;
  follows: Follows; setFollows: (f: Follows) => void;
  reload: () => Promise<void>; toast: (m: string) => void;
  unread: number; refreshUnread: () => void;
}
const Ctx = createContext<Ctx | null>(null);
export const useSession = () => { const c = useContext(Ctx); if (!c) throw new Error('useSession outside provider'); return c; };
const EMPTY: Follows = { users: new Set(), artists: new Set(), genres: new Set() };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [follows, setFollows] = useState<Follows>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(() => { api.unreadCount().then(setUnread).catch(() => {}); }, []);
  const fade = useRef(new Animated.Value(0)).current;

  const reload = useCallback(async () => {
    if (!configured) { setReady(true); return; }
    const { data } = await api.sb.auth.getSession();
    const u = data.session?.user ?? null;
    setUser(u);
    if (u) { setProfile(await api.me().catch(() => null)); setFollows(await api.myFollows().catch(() => EMPTY)); }
    else { setProfile(null); setFollows(EMPTY); }
    setReady(true);
  }, []);

  // Unread badge: count on sign-in, then live as notifications arrive. Re-save the push token if permission was given before.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) { setUnread(0); return; }
    refreshUnread();
    registerPush(false);
    return api.onNotifications(userId, n => { if (n.kind !== 'message') setUnread(u => u + 1); });
  }, [userId, refreshUnread]);

  useEffect(() => {
    reload();
    const { data } = api.sb.auth.onAuthStateChange(() => { reload(); });
    return () => data.subscription.unsubscribe();
  }, [reload]);

  const toast = useCallback((m: string) => {
    setMsg(m);
    Animated.sequence([Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }), Animated.delay(2200), Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true })]).start(() => setMsg(null));
  }, [fade]);

  return <Ctx.Provider value={{ user, profile, ready, follows, setFollows, reload, toast, unread, refreshUnread }}>
    {children}
    {msg && <Animated.View pointerEvents="none" style={[s.toast, { opacity: fade }]}><Text style={s.toastText}>{msg}</Text></Animated.View>}
  </Ctx.Provider>;
}

const s = StyleSheet.create({
  toast: { position: 'absolute', left: 20, right: 20, bottom: 110, alignItems: 'center' },
  toastText: { backgroundColor: C.ink, color: '#fff', fontFamily: F.semibold, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, overflow: 'hidden' },
});
