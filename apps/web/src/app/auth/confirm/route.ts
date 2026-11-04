import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { serverApi } from '@/lib/server';

/** Email links (confirm sign-up, reset password) land here with a one-time token; works in any browser. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/feed';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/feed';
  if (token_hash && type) {
    const api = await serverApi();
    const { error } = await api.sb.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
