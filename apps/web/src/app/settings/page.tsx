'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CNAME, FLAG, HANDLE_RE, LIMITS } from '@melo/core';
import { useMelo } from '@/components/session';

export default function Settings() {
  const { api, user, profile, ready, reloadProfile, toast } = useMelo(); const router = useRouter();
  const [f, setF] = useState({ name: '', handle: '', bio: '', city: '', cc: 'US' }); const [busy, setBusy] = useState(false); const [confirmDelete, setConfirmDelete] = useState('');
  useEffect(() => { if (ready && !user) router.replace('/login?next=/settings'); }, [ready, user, router]);
  useEffect(() => { if (profile) setF({ name: profile.name, handle: profile.handle, bio: profile.bio, city: profile.city, cc: profile.cc }); }, [profile]);
  async function save() {
    if (!f.name.trim()) { toast('Add your name.'); return; }
    if (!HANDLE_RE.test(f.handle)) { toast('Usernames use 3 to 20 letters, numbers or underscores.'); return; }
    setBusy(true); try { await api.saveProfile({ ...f, name: f.name.trim() }); await reloadProfile(); toast('Profile saved'); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  async function del() { try { await api.deleteAccount(); toast('Your account and everything in it was deleted.'); router.push('/'); router.refresh(); } catch (e) { toast((e as Error).message); } }
  if (!profile) return <section className="wrap sec"><p className="empty">Loading…</p></section>;
  return <section className="wrap sec" style={{ maxWidth: 640 }}><div className="stack" style={{ gap: 24 }}>
    <h1 style={{ fontSize: 36 }}>Settings</h1>
    <div className="card stack"><b>Profile</b>
      <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" className="inp" style={{ background: '#fff' }} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={40} /></div>
      <div className="field"><label htmlFor="s-handle">Username</label><input id="s-handle" className="inp" style={{ background: '#fff' }} value={f.handle} onChange={e => setF({ ...f, handle: e.target.value.toLowerCase() })} maxLength={20} /></div>
      <div className="field"><label htmlFor="s-bio">Bio</label><textarea id="s-bio" className="inp" style={{ background: '#fff', minHeight: 80 }} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} maxLength={LIMITS.bio} /></div>
      <div className="g2" style={{ gap: 10 }}><div className="field"><label htmlFor="s-city">City</label><input id="s-city" className="inp" style={{ background: '#fff' }} value={f.city} onChange={e => setF({ ...f, city: e.target.value })} maxLength={40} /></div><div className="field"><label htmlFor="s-cc">Country</label><select id="s-cc" className="inp" style={{ background: '#fff' }} value={f.cc} onChange={e => setF({ ...f, cc: e.target.value })}>{Object.keys(FLAG).map(c => <option key={c} value={c}>{FLAG[c]} {CNAME[c]}</option>)}</select></div></div>
      <div><button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div></div>
    {profile?.is_admin && <div className="card stack"><b>Admin</b><div><Link className="btn dark" href="/moderation">Moderation queue</Link></div></div>}
    <PasswordCard />
    <div className="card stack"><b>Listening history</b><p className="muted">Bring your Spotify or Apple Music history into your diary.</p><div><Link className="btn ghost" href="/import">Import history</Link></div></div>
    <div className="card stack"><b>Account</b><p className="muted">Signed in as {user?.email}</p><div><button className="btn ghost" onClick={async () => { await api.signOut(); router.push('/'); router.refresh(); }}>Sign out</button></div></div>
    <div className="card stack" style={{ border: '2px solid #fde6e6' }}><b>Delete account</b><p className="muted">This permanently deletes your profile, posts, replies, diary, forecasts and chats. It cannot be undone.</p>
      <div className="field"><label htmlFor="s-del">Type DELETE to confirm</label><input id="s-del" className="inp" style={{ background: '#fff' }} value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} /></div>
      <div><button className="btn danger" disabled={confirmDelete !== 'DELETE'} onClick={del}>Delete my account</button></div></div>
  </div></section>;
}

function PasswordCard() {
  const { api, toast } = useMelo();
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false);
  return <div className="card stack"><b>Password</b>
    <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={async e => { e.preventDefault(); setBusy(true); try { await api.updatePassword(pw); setPw(''); toast('Password updated'); } catch (er) { toast((er as Error).message); } finally { setBusy(false); } }}>
      <input type="password" className="inp" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw} onChange={e => setPw(e.target.value)} minLength={8} aria-label="New password" />
      <button className="btn" disabled={busy || pw.length < 8}>Change</button>
    </form></div>;
}
