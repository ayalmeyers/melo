import { createBrowserClient } from '@supabase/ssr';
import { createApi, type MeloApi } from '@melo/core';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let api: MeloApi | null = null;
/** Browser-side client, shared by every interactive component. */
export function browserApi(): MeloApi {
  if (!api) api = createApi(createBrowserClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_KEY || 'missing-key'));
  return api;
}
