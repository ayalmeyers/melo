import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createApi, type MeloApi } from '@melo/core';
import { SUPABASE_KEY, SUPABASE_URL, configured } from './supabase';

/** Server-side client that reads the visitor's session from cookies. */
export async function serverApi(): Promise<MeloApi> {
  const store = await cookies();
  const sb = createServerClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_KEY || 'missing-key', {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component; proxy.ts refreshes sessions */ } },
    },
  });
  return createApi(sb);
}

/** Runs a read and falls back instead of crashing a public page when the backend is unreachable. */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!configured) return fallback;
  try { return await fn(); } catch (e) { console.error(e); return fallback; }
}
