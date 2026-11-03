'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EMAIL_RE } from '@melo/core';
import { useMelo } from '@/components/session';

function Login() {
  const { api, reloadProfile } = useMelo(); const router = useRouter(); const next = useSearchParams().get('next') || '/feed';
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!EMAIL_RE.test(email.trim())) { setErr('That email looks incomplete.'); return; }
    setBusy(true);
    try { await api.sendCode(email.trim().toLowerCase()); setSent(true); } catch { setErr('We could not send a code. Try again in a minute.'); } finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.verifyCode(email.trim().toLowerCase(), code.trim()); await reloadProfile(); router.push(next.startsWith('/') ? next : '/feed'); router.refresh(); } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  }
  return <section className="band" style={{ minHeight: '70vh' }}><div className="wrap" style={{ maxWidth: 480, paddingTop: 64, paddingBottom: 80 }}>
    <h1 style={{ fontSize: 40 }}>Sign in to Melo</h1>
    <p className="muted" style={{ margin: '10px 0 24px' }}>{sent ? `We sent a 6-digit code to ${email}.` : 'Use your email. We send a one-time code, no password needed.'}</p>
    {!sent ? <form onSubmit={send} className="stack"><div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className="inp" value={email} onChange={e => setEmail(e.target.value)} required /></div><button className="btn block" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button></form>
      : <form onSubmit={verify} className="stack"><div className="field"><label htmlFor="code">Code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" className="inp" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required style={{ letterSpacing: '.3em', fontSize: 22 }} /></div><button className="btn block" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button><button type="button" className="btn ghost block" onClick={() => { setSent(false); setCode(''); }}>Use a different email</button></form>}
    {err && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
    <p className="muted" style={{ marginTop: 24, fontSize: 14 }}>By signing in you agree to the <a href="/terms" style={{ color: '#fff' }}>Terms</a> and <a href="/privacy" style={{ color: '#fff' }}>Privacy Policy</a>.</p>
  </div></section>;
}
export default function LoginPage() { return <Suspense><Login /></Suspense>; }
