import { NextResponse } from 'next/server';
import { serverApi } from '@/lib/server';

/** Supabase's default email links come back here with a code (same browser that asked for the email). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/feed';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/feed';
  if (code) {
    const api = await serverApi();
    const { error } = await api.sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
