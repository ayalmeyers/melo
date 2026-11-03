'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EMAIL_RE } from '@melo/core';
import { useMelo } from '@/components/session';

function Login() {
  const { api, reloadProfile } = useMelo(); const router = useRouter(); const next = useSearchParams().get('next') || '/feed';
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { setErr('That email looks incomplete.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') await api.signUp(em, password); else await api.signIn(em, password);
      await reloadProfile(); router.push(next.startsWith('/') ? next : '/feed'); router.refresh();
    } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  }
  return <section className="band" style={{ minHeight: '70vh' }}><div className="wrap" style={{ maxWidth: 480, paddingTop: 64, paddingBottom: 80 }}>
    <h1 style={{ fontSize: 40 }}>{mode === 'in' ? 'Sign in to Melo' : 'Join Melo'}</h1>
    <p className="muted" style={{ margin: '10px 0 24px' }}>{mode === 'in' ? 'Welcome back.' : 'Make an account with your email and a password.'}</p>
    <form onSubmit={submit} className="stack">
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className="inp" value={email} onChange={e => setEmail(e.target.value)} required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className="inp" value={password} onChange={e => setPassword(e.target.value)} minLength={mode === 'up' ? 8 : undefined} required /></div>
      <button className="btn block" disabled={busy}>{busy ? 'One second…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="btn ghost block" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
    </form>
    {err && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
    <p className="muted" style={{ marginTop: 24, fontSize: 14 }}>By continuing you agree to the <a href="/terms" style={{ color: '#fff' }}>Terms</a> and <a href="/privacy" style={{ color: '#fff' }}>Privacy Policy</a>.</p>
  </div></section>;
}
export default function LoginPage() { return <Suspense><Login /></Suspense>; }
