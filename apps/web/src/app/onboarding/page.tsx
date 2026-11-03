'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATAR_COLORS, CNAME, FLAG, GENRES, HANDLE_RE, hash, type CatalogItem } from '@melo/core';
import { useMelo } from '@/components/session';
import { ItemArt } from '@/components/ui';

export default function Onboarding() {
  const { api, user, profile, ready, reloadProfile, toast } = useMelo(); const router = useRouter();
  const [step, setStep] = useState(0); const [name, setName] = useState(''); const [handle, setHandle] = useState(''); const [cc, setCc] = useState('US');
  const [terms, setTerms] = useState(false); const [taken, setTaken] = useState(false); const [albums, setAlbums] = useState<CatalogItem[]>([]); const [top4, setTop4] = useState<string[]>([]); const [genres, setGenres] = useState<Set<string>>(new Set()); const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && !user) router.replace('/login?next=/onboarding'); if (ready && profile) router.replace('/feed'); }, [ready, user, profile, router]);
  useEffect(() => { api.itemsBy({ type: 'album' }, 30).then(setAlbums).catch(() => {}); }, [api]);
  useEffect(() => { const h = handle.toLowerCase(); if (!HANDLE_RE.test(h)) { setTaken(false); return; } const t = setTimeout(() => api.handleAvailable(h).then(ok => setTaken(!ok)).catch(() => {}), 300); return () => clearTimeout(t); }, [api, handle]);
  async function finish() {
    setBusy(true);
    try {
      await api.saveProfile({ name: name.trim(), handle: handle.toLowerCase(), cc, top4, color: AVATAR_COLORS[hash(user!.id) % AVATAR_COLORS.length], acceptTerms: true });
      await Promise.all([...genres].map(g => api.follow('genre', g, true)));
      await reloadProfile(); toast(`You're in, ${name.split(' ')[0]}.`); router.push('/feed');
    } catch (e) { toast((e as Error).message); setStep(0); } finally { setBusy(false); }
  }
  const valid0 = name.trim().length > 0 && HANDLE_RE.test(handle.toLowerCase()) && !taken && terms;
  return <section className="band" style={{ minHeight: '80vh' }}><div className="wrap" style={{ maxWidth: 640, paddingTop: 48, paddingBottom: 80 }}>
    <span className="eyebrow">Step {step + 1} of 3</span>
    {step === 0 && <div className="stack" style={{ marginTop: 10 }}><h1 style={{ fontSize: 40 }}>Welcome to Melo</h1><p className="muted">Set up your profile so people know who&apos;s talking.</p>
      <div className="field"><label htmlFor="name">Name</label><input id="name" className="inp" value={name} onChange={e => setName(e.target.value)} maxLength={40} /></div>
      <div className="field"><label htmlFor="handle">Username</label><input id="handle" className="inp" value={handle} onChange={e => setHandle(e.target.value.toLowerCase())} maxLength={20} autoCapitalize="off" placeholder="letters, numbers, underscores" />{taken && <span className="err">That username is taken.</span>}</div>
      <div className="field"><label htmlFor="cc">Where are you listening from?</label><select id="cc" className="inp" value={cc} onChange={e => setCc(e.target.value)}>{Object.keys(FLAG).map(c => <option key={c} value={c}>{FLAG[c]} {CNAME[c]}</option>)}</select></div>
      <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ marginTop: 5 }} /><span className="muted">I agree to the <a href="/terms" target="_blank" style={{ color: '#fff' }}>Terms</a>, including no harassment or objectionable content, and the <a href="/privacy" target="_blank" style={{ color: '#fff' }}>Privacy Policy</a>.</span></label>
      <button className="btn" disabled={!valid0} onClick={() => setStep(1)}>Continue</button></div>}
    {step === 1 && <div className="stack" style={{ marginTop: 10 }}><h1 style={{ fontSize: 40 }}>Pick your Top 4</h1><p className="muted">The four records that explain you. {top4.length}/4.</p>
      <div className="g6">{albums.map(a => { const i = top4.indexOf(a.id); return <button key={a.id} onClick={() => setTop4(i >= 0 ? top4.filter(x => x !== a.id) : top4.length < 4 ? [...top4, a.id] : top4)} style={{ position: 'relative', borderRadius: 14, outline: i >= 0 ? '3px solid var(--blue)' : 'none' }} aria-pressed={i >= 0} aria-label={a.title}><ItemArt item={a} />{i >= 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, background: 'var(--blue)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>{i + 1}</span>}</button>; })}</div>
      <div className="row"><button className="btn ghost" onClick={() => setStep(0)}>Back</button><button className="btn" onClick={() => setStep(2)}>{top4.length === 4 ? 'Lock in my Top 4' : 'Skip for now'}</button></div></div>}
    {step === 2 && <div className="stack" style={{ marginTop: 10 }}><h1 style={{ fontSize: 40 }}>Follow some genres</h1><p className="muted">Their boards feed your Following tab.</p>
      <div className="row">{Object.entries(GENRES).map(([g, x]) => <button key={g} className={`chip ${genres.has(g) ? 'on' : ''}`} onClick={() => { const n = new Set(genres); n.has(g) ? n.delete(g) : n.add(g); setGenres(n); }}>#{x.name}</button>)}</div>
      <div className="row"><button className="btn ghost" onClick={() => setStep(1)}>Back</button><button className="btn" onClick={finish} disabled={busy}>{busy ? 'Saving…' : 'Open Melo'}</button></div></div>}
  </div></section>;
}
