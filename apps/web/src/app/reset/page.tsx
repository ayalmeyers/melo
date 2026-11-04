'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMelo } from '@/components/session';

/** Set a new password after following the reset link. */
export default function ResetPage() {
  const { api, user, ready, toast } = useMelo(); const router = useRouter();
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.updatePassword(pw); toast('Password updated'); router.push('/feed'); } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
  }
  return <section className="band" style={{ minHeight: '70vh' }}><div className="wrap" style={{ maxWidth: 480, paddingTop: 64, paddingBottom: 80 }}>
    <h1 style={{ fontSize: 40 }}>New password</h1>
    {ready && !user ? <p className="muted" style={{ marginTop: 12 }}>This link has expired or was opened in a different browser. <Link href="/login?mode=forgot" style={{ color: '#fff' }}>Send a new one</Link>.</p>
      : <form onSubmit={save} className="stack" style={{ marginTop: 24 }}>
        <div className="field"><label htmlFor="pw">New password</label><input id="pw" type="password" autoComplete="new-password" className="inp" value={pw} onChange={e => setPw(e.target.value)} minLength={8} required /></div>
        <button className="btn block" disabled={busy || pw.length < 8}>{busy ? 'Saving…' : 'Save password'}</button>
        {err && <p className="err">{err}</p>}
      </form>}
  </div></section>;
}
