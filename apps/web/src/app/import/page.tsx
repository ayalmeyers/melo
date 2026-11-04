'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { unzipSync, strFromU8 } from 'fflate';
import { matchApple, readHistory, type History } from '@melo/core';
import { useMelo } from '@/components/session';
import { apple } from '@/components/apple';
import { Icon } from '@/components/ui';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const hours = (ms: number) => (ms >= 36e5 ? `${Math.round(ms / 36e5)} hr` : `${Math.max(1, Math.round(ms / 6e4))} min`);
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');

/** Reads .json/.csv files, and the same inside .zip exports, entirely in the browser. */
async function readFiles(list: FileList): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  for (const f of Array.from(list)) {
    if (/\.zip$/i.test(f.name)) {
      const files = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: e => /\.(json|csv)$/i.test(e.name) && /(stream|play|music|history|activity)/i.test(e.name) });
      for (const [name, data] of Object.entries(files)) out.push({ name: name.split('/').pop()!, text: strFromU8(data) });
    } else if (/\.(json|csv)$/i.test(f.name)) out.push({ name: f.name, text: await f.text() });
  }
  return out;
}

export default function ImportPage() {
  const { api, user, profile, ready, follows } = useMelo(); const router = useRouter();
  const [hist, setHist] = useState<History | null>(null);
  const [err, setErr] = useState('');
  const [reading, setReading] = useState(false);
  const [pick, setPick] = useState<{ albums: Set<number>; artists: Set<number>; shows: Set<number> }>({ albums: new Set(), artists: new Set(), shows: new Set() });
  const [prog, setProg] = useState<{ done: number; total: number; step: string; added: number; missed: string[]; followed: number; finished: boolean } | null>(null);
  useEffect(() => { if (ready && !user) router.replace('/login?next=/import'); }, [ready, user, router]);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setErr(''); setReading(true);
    try {
      const h = readHistory(await readFiles(list));
      if (!h || !h.plays) { setErr('We couldn’t find listening history in those files. Use the Spotify or Apple Music export (the .zip, or the .json / .csv files inside it).'); return; }
      setHist(h);
      const top = (n: number, len: number) => new Set(Array.from({ length: Math.min(n, len) }, (_, i) => i));
      setPick({ albums: top(30, Math.min(h.albums.length, 50)), artists: top(10, Math.min(h.artists.length, 20)), shows: top(5, Math.min(h.shows.length, 10)) });
    } catch { setErr('Those files couldn’t be read. Try the .zip exactly as it was emailed to you.'); }
    finally { setReading(false); }
  }

  const toggle = (k: 'albums' | 'artists' | 'shows', i: number) => setPick(p => { const n = new Set(p[k]); if (n.has(i)) n.delete(i); else n.add(i); return { ...p, [k]: n }; });

  async function run() {
    if (!hist) return;
    const albums = [...pick.albums].map(i => hist.albums[i]);
    const shows = [...pick.shows].map(i => hist.shows[i]);
    const artists = [...pick.artists].map(i => hist.artists[i]);
    const total = albums.length + shows.length + artists.length;
    const missed: string[] = []; const rows: { item_id: string; plays: number; listened_at: string | null }[] = [];
    let done = 0, followed = 0;
    const step = (s: string) => setProg({ done, total, step: s, added: rows.length, missed, followed, finished: false });

    // Albums and podcasts: Melo's catalog first, then Apple's (paced for Apple's limit).
    for (const it of [...albums.map(a => ({ ...a, kind: 'album' as const })), ...shows.map(s => ({ ...s, artist: '', kind: 'show' as const }))]) {
      step(`Finding ${it.title}`);
      let id: string | null = null;
      const local = await api.searchItems(it.title, 10).catch(() => []);
      id = local.find(x => norm(x.title) === norm(it.title) && (it.kind === 'show' ? x.type === 'show' : norm(x.artist_name) === norm(it.artist)))?.id ?? null;
      if (!id) {
        const m = matchApple(await apple.search(`${it.title} ${it.artist}`.trim(), it.kind, 10), it.title, it.artist);
        if (m) id = await api.importApple(m).catch(() => null);
        await wait(3100);
      }
      if (id) rows.push({ item_id: id, plays: it.plays, listened_at: it.last || null }); else missed.push(it.artist ? `${it.title} · ${it.artist}` : it.title);
      done++;
    }
    step('Adding to your diary');
    for (let i = 0; i < rows.length; i += 400) await api.importLogs(hist.source, rows.slice(i, i + 400)).catch(() => {});

    // Artists: follow the ones Melo knows (importing albums above creates most of them).
    for (const a of artists) {
      step(`Following ${a.name}`);
      const hit = (await api.searchArtists(a.name, 5).catch(() => [])).find(x => norm(x.name) === norm(a.name));
      if (hit && !follows.artists.has(hit.id)) { await api.follow('artist', hit.id, true).catch(() => {}); followed++; }
      else if (!hit) missed.push(a.name);
      done++;
    }
    setProg({ done, total, step: '', added: rows.length, missed, followed, finished: true });
  }

  const selected = pick.albums.size + pick.shows.size + pick.artists.size;
  const etaMin = useMemo(() => Math.ceil(((pick.albums.size + pick.shows.size) * 3.4) / 60), [pick]);

  return <section className="wrap sec stack" style={{ maxWidth: 820, gap: 22 }}>
    <div><span className="eyebrow" style={{ color: 'var(--blue)' }}>Import</span><h1 style={{ fontSize: 'clamp(30px,5vw,42px)', marginTop: 6 }}>Bring your listening history</h1>
      <p className="muted" style={{ marginTop: 8, fontSize: 17 }}>Start with a full diary instead of an empty one. Your files are read in this browser and never uploaded; only the albums you pick are added to Melo.</p></div>

    {!hist && <>
      <div className="g2" style={{ gap: 14 }}>
        <div className="card stack" style={{ gap: 8 }}><b>Spotify</b><p className="muted" style={{ fontSize: 15 }}>Go to <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>Account → Privacy</a>, request <b>Extended streaming history</b> (albums, up to 30 days to arrive) or <b>Account data</b> (artists only, about 5 days). Spotify emails a .zip.</p></div>
        <div className="card stack" style={{ gap: 8 }}><b>Apple Music</b><p className="muted" style={{ fontSize: 15 }}>Go to <a href="https://privacy.apple.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>privacy.apple.com</a> → Request a copy of your data → <b>Apple Media Services information</b>. Apple sends a .zip with your Apple Music activity.</p></div>
      </div>
      <label className="card" style={{ display: 'grid', placeItems: 'center', gap: 10, padding: 36, border: '2px dashed var(--line)', cursor: 'pointer', textAlign: 'center' }}>
        <Icon name="plus" size={28} />
        <b>{reading ? 'Reading…' : 'Choose your export'}</b>
        <span className="muted">The .zip, or the .json / .csv files inside it. You can pick several.</span>
        <input type="file" multiple accept=".zip,.json,.csv" style={{ display: 'none' }} onChange={e => onFiles(e.target.files)} />
      </label>
      {err && <p className="err">{err}</p>}
    </>}

    {hist && !prog && <>
      <div className="card"><b>{hist.plays.toLocaleString()} plays</b> <span className="muted">from {hist.source === 'spotify' ? 'Spotify' : 'Apple Music'}{hist.from ? `, ${day(hist.from)} to ${day(hist.to)}` : ''}. Pick what to bring over.</span></div>
      {!!hist.albums.length && <div className="stack" style={{ gap: 8 }}><h2 style={{ fontSize: 22 }}>Albums <span className="muted" style={{ fontSize: 15 }}>· {pick.albums.size} picked</span></h2>
        {hist.albums.slice(0, 50).map((a, i) => <label key={i} className="list-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={pick.albums.has(i)} onChange={() => toggle('albums', i)} /><span className="m"><b>{a.title}</b><small>{a.artist} · {a.plays} plays · {hours(a.ms)}</small></span></label>)}</div>}
      {!!hist.artists.length && <div className="stack" style={{ gap: 8 }}><h2 style={{ fontSize: 22 }}>Artists to follow <span className="muted" style={{ fontSize: 15 }}>· {pick.artists.size} picked</span></h2>
        {hist.artists.slice(0, 20).map((a, i) => <label key={i} className="list-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={pick.artists.has(i)} onChange={() => toggle('artists', i)} /><span className="m"><b>{a.name}</b><small>{a.plays} plays · {hours(a.ms)}</small></span></label>)}</div>}
      {!!hist.shows.length && <div className="stack" style={{ gap: 8 }}><h2 style={{ fontSize: 22 }}>Podcasts <span className="muted" style={{ fontSize: 15 }}>· {pick.shows.size} picked</span></h2>
        {hist.shows.slice(0, 10).map((s, i) => <label key={i} className="list-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={pick.shows.has(i)} onChange={() => toggle('shows', i)} /><span className="m"><b>{s.title}</b><small>{s.plays} episodes · {hours(s.ms)}</small></span></label>)}</div>}
      <div className="row"><button className="btn" disabled={!selected} onClick={run}>Add {selected} to Melo</button><button className="btn ghost" onClick={() => setHist(null)}>Start over</button><span className="muted">About {etaMin} min. Keep this tab open.</span></div>
    </>}

    {prog && <div className="card stack">
      {!prog.finished ? <><b>{prog.step}…</b><div style={{ height: 10, borderRadius: 5, background: 'var(--mist)', overflow: 'hidden' }}><div style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%`, height: '100%', background: 'var(--blue)' }} /></div><span className="muted">{prog.done} of {prog.total}</span></>
        : <><b>Done. {prog.added} added to your diary{prog.followed ? `, ${prog.followed} artists followed` : ''}.</b>
          {!!prog.missed.length && <p className="muted">Couldn’t match {prog.missed.length}: {prog.missed.slice(0, 8).join('; ')}{prog.missed.length > 8 ? '…' : ''}. You can add those by hand from Explore.</p>}
          <div className="row">{profile && <Link className="btn" href={`/u/${profile.handle}?tab=diary`}>See your diary</Link>}<Link className="btn ghost" href="/charts">See the charts</Link></div></>}
    </div>}
  </section>;
}
