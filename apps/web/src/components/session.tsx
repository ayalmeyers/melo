'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { Profile, Target } from '@melo/core';
import { browserApi, configured } from '@/lib/supabase';

type Follows = { users: Set<string>; artists: Set<string>; genres: Set<string> };
type ComposeOpts = { kind?: 'review' | 'take' | 'thread' | 'forecast'; target?: Target | null };
interface Ctx {
  api: ReturnType<typeof browserApi>;
  user: User | null;
  profile: Profile | null;
  ready: boolean;
  follows: Follows;
  setFollows: (f: Follows) => void;
  reloadProfile: () => Promise<void>;
  toast: (m: string) => void;
  compose: ComposeOpts | null;
  openCompose: (o?: ComposeOpts) => void;
  closeCompose: () => void;
  requireSignIn: () => boolean;
}
const C = createContext<Ctx | null>(null);
export const useMelo = () => { const c = useContext(C); if (!c) throw new Error('useMelo outside provider'); return c; };

const OPEN_PATHS = ['/login', '/onboarding', '/privacy', '/terms', '/support'];

export function MeloProvider({ children }: { children: React.ReactNode }) {
  const api = browserApi();
  const router = useRouter(); const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [follows, setFollows] = useState<Follows>({ users: new Set(), artists: new Set(), genres: new Set() });
  const [toastMsg, setToast] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeOpts | null>(null);

  const reloadProfile = useCallback(async () => {
    if (!configured) { setReady(true); return; }
    const { data } = await api.sb.auth.getUser();
    setUser(data.user ?? null);
    if (data.user) { setProfile(await api.me().catch(() => null)); setFollows(await api.myFollows().catch(() => ({ users: new Set<string>(), artists: new Set<string>(), genres: new Set<string>() }))); }
    else { setProfile(null); }
    setReady(true);
  }, [api]);

  useEffect(() => {
    reloadProfile();
    const { data } = api.sb.auth.onAuthStateChange(() => { reloadProfile(); router.refresh(); });
    return () => data.subscription.unsubscribe();
  }, [api, reloadProfile, router]);

  useEffect(() => {
    if (ready && user && !profile && !OPEN_PATHS.some(p => path.startsWith(p))) router.push('/onboarding');
  }, [ready, user, profile, path, router]);

  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toastMsg]);

  const requireSignIn = useCallback(() => {
    if (user && profile) return true;
    router.push('/login?next=' + encodeURIComponent(path));
    return false;
  }, [user, profile, router, path]);

  const value: Ctx = {
    api, user, profile, ready, follows, setFollows, reloadProfile,
    toast: setToast,
    compose, openCompose: o => { if (requireSignIn()) setCompose(o ?? {}); }, closeCompose: () => setCompose(null),
    requireSignIn,
  };
  return <C.Provider value={value}>{children}{toastMsg && <div className="toast" role="status">{toastMsg}</div>}</C.Provider>;
}
