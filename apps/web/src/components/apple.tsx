'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { appleMeloId, createApple, type AppleKind, type AppleResult } from '@melo/core';
import { useMelo } from './session';
import { Icon } from './ui';

/** Apple's catalog through the site's cached route. */
export const apple = createApple(async url => {
  const r = await fetch('/api/apple?url=' + encodeURIComponent(url));
  return r.json();
});

export function useAppleSearch(q: string, kinds: AppleKind[], limit = 10) {
  const [res, setRes] = useState<AppleResult[] | null>(null);
  const key = kinds.join();
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes(null); return; }
    let alive = true;
    const t = setTimeout(async () => { const lists = await Promise.all(key.split(',').map(k => apple.search(s, k as AppleKind, limit))); if (alive) setRes(lists.flat()); }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, key, limit]);
  return res;
}

export function useAppleList(load: () => Promise<AppleResult[]>, deps: unknown[]) {
  const [res, setRes] = useState<AppleResult[] | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { let alive = true; load().then(r => alive && setRes(r)).catch(() => alive && setRes([])); return () => { alive = false; }; }, deps);
  return res;
}

const year = (d?: string) => (d ? d.slice(0, 4) : '');
const sub = (r: AppleResult) => r.kind === 'album' ? [r.artist, year(r.release_date)].filter(Boolean).join(' · ')
  : r.kind === 'show' ? [r.artist, 'Podcast'].filter(Boolean).join(' · ')
  : [r.show_title, r.dur_min ? `${r.dur_min} min` : '', year(r.release_date)].filter(Boolean).join(' · ');

export function AppleRow({ r, onPick, existing }: { r: AppleResult; onPick?: (id: string) => void; existing?: boolean }) {
  const { api, requireSignIn, toast } = useMelo(); const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function open() {
    if (existing) { const id = appleMeloId(r); if (onPick) onPick(id); else router.push(`/album/${id}`); return; }
    if (!requireSignIn()) return;
    setBusy(true);
    try { const id = await api.importApple(r); if (onPick) onPick(id); else router.push(`/album/${id}`); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  }
  return <button type="button" className="list-row" onClick={open} disabled={busy} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}>
    <span className={`art ${r.kind === 'show' ? '' : ''}`} style={{ width: 52 }}>{/* eslint-disable-next-line @next/next/no-img-element */}{r.artwork && <img src={r.artwork.replace('600x600bb', '200x200bb')} alt="" loading="lazy" />}</span>
    <span className="m"><b>{r.title}</b><small>{sub(r)}</small></span>
    <span style={{ color: existing ? 'var(--dim)' : 'var(--blue)' }}>{busy ? '…' : <Icon name={existing ? 'send' : 'plus'} size={18} />}</span>
  </button>;
}

export function AppleSection({ title, results, onPick, have }: { title: string; results: AppleResult[] | null; onPick?: (id: string) => void; have?: Set<string> }) {
  const list = useMemo(() => results ?? [], [results]);
  if (!list.length) return null;
  return <div className="stack" style={{ gap: 8 }}>
    <div className="row" style={{ justifyContent: 'space-between' }}><b>{title}</b><span className="apple-note">from Apple</span></div>
    {list.map(r => <AppleRow key={r.kind + r.apple_id} r={r} onPick={onPick} existing={have?.has(appleMeloId(r))} />)}
  </div>;
}

/** An artist's other albums on Apple Music (by Apple id, or by exact name for seeded artists). */
export function AppleDiscography({ name, appleId, have }: { name: string; appleId?: number | null; have: string[] }) {
  const res = useAppleList(async () => {
    if (appleId) return apple.discography(appleId);
    const same = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (await apple.search(name, 'album', 50)).filter(h => same(h.artist) === same(name)).sort((x, y) => (y.release_date ?? '').localeCompare(x.release_date ?? ''));
  }, [name, appleId]);
  const h = new Set(have);
  return <AppleSection title="More on Apple Music" results={res?.filter(r => !h.has(appleMeloId(r))) ?? null} />;
}

/** A podcast's newest episodes on Apple Podcasts. */
export function AppleEpisodes({ title, appleId, have }: { title: string; appleId?: number | null; have: string[] }) {
  const res = useAppleList(async () => {
    let id = appleId ?? null;
    if (!id) id = (await apple.search(title, 'show', 5)).find(r => r.title.toLowerCase() === title.toLowerCase())?.apple_id ?? null;
    return id ? apple.episodes(id, 25) : [];
  }, [title, appleId]);
  return <AppleSection title="Latest episodes" results={res} have={new Set(have)} />;
}
