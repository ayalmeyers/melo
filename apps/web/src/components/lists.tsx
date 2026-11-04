'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogItem, ListCard, ListEntry } from '@melo/core';
import { useMelo } from './session';
import { ItemArt, Icon } from './ui';
import { AppleSection, useAppleSearch } from './apple';

/** A list as a fan of its first four covers. */
export function ListCardView({ l, showOwner = true }: { l: ListCard; showOwner?: boolean }) {
  return <Link href={`/lists/${l.id}`} className="list-card">
    <span className="fan">{l.preview.length ? l.preview.map(p => <ItemArt key={p.id} item={p} />) : <span className="art" />}</span>
    <b>{l.title}</b>
    <small className="muted">{showOwner ? `${l.owner_name} · ` : ''}{l.item_count} {l.item_count === 1 ? 'record' : 'records'}{l.ranked ? ' · ranked' : ''}</small>
  </Link>;
}

/** "Add to list" on an album page: toggle it on your lists or start a new one. */
export function AddToListButton({ itemId }: { itemId: string }) {
  const { api, user, requireSignIn, toast } = useMelo();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<ListCard[] | null>(null);
  const [has, setHas] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  async function load() {
    if (!user) return;
    const [m, c] = await Promise.all([api.lists({ owner: user.id, limit: 100 }), api.lists({ containing: itemId, limit: 200 })]);
    setMine(m); setHas(new Set(c.map(l => l.id)));
  }
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function toggle(id: string) {
    try { if (has.has(id)) await api.removeFromList(id, itemId); else await api.addToList(id, itemId); toast(has.has(id) ? 'Removed' : 'Added'); load(); }
    catch (e) { toast((e as Error).message); }
  }
  async function create() {
    if (!title.trim()) return;
    try { const id = await api.createList({ title: title.trim() }); await api.addToList(id, itemId); setTitle(''); toast('List created'); load(); }
    catch (e) { toast((e as Error).message); }
  }
  return <>
    <button className="btn ghost sm" onClick={() => { if (requireSignIn()) setOpen(true); }}><Icon name="plus" size={16} /> Add to list</button>
    {open && <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}><div className="modal" role="dialog" aria-modal="true" aria-label="Add to list">
      <div className="modal-h"><h2>Add to a list</h2><button className="x" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={18} /></button></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}><input className="inp" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="New list title" onKeyDown={e => e.key === 'Enter' && create()} /><button className="btn" onClick={create} disabled={!title.trim()}>Create</button></div>
      <div className="stack" style={{ gap: 6 }}>{mine === null ? <p className="muted">Loading…</p> : !mine.length ? <p className="muted">No lists yet. Name your first one above.</p> : mine.map(l =>
        <label key={l.id} className="list-row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={has.has(l.id)} onChange={() => toggle(l.id)} /><span className="m"><b>{l.title}</b><small>{l.item_count} records</small></span></label>)}</div>
    </div></div>}
  </>;
}

/** The owner's editing tools on a list page: add albums, reorder, notes, remove, rename, delete. */
export function ListEditor({ list, entries, items }: { list: ListCard; entries: ListEntry[]; items: Record<string, CatalogItem> }) {
  const { api, user, toast } = useMelo(); const router = useRouter();
  const [q, setQ] = useState(''); const [hits, setHits] = useState<CatalogItem[]>([]);
  const [meta, setMeta] = useState({ title: list.title, description: list.description, ranked: list.ranked });
  const fromApple = useAppleSearch(q, ['album', 'episode'], 6);
  useEffect(() => { const t = setTimeout(() => { if (q.trim().length >= 2) api.searchItems(q, 8).then(setHits).catch(() => {}); else setHits([]); }, 220); return () => clearTimeout(t); }, [api, q]);
  if (user?.id !== list.owner) return null;
  const add = async (id: string) => { try { await api.addToList(list.id, id); setQ(''); toast('Added'); router.refresh(); } catch (e) { toast((e as Error).message); } };
  const move = async (i: number, d: number) => { const ids = entries.map(e => e.item_id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; await api.reorderList(list.id, ids).catch(() => {}); router.refresh(); };
  const note = async (e: ListEntry) => { const v = prompt('Why it’s on this list (280 characters)', e.note); if (v == null) return; await api.setListNote(list.id, e.item_id, v.slice(0, 280)).catch(() => {}); router.refresh(); };
  const remove = async (e: ListEntry) => { await api.removeFromList(list.id, e.item_id).catch(() => {}); router.refresh(); };
  const saveMeta = async () => { try { await api.updateList(list.id, meta); toast('Saved'); router.refresh(); } catch (e) { toast((e as Error).message); } };
  const del = async () => { if (!confirm('Delete this list? The albums stay on Melo.')) return; await api.deleteList(list.id); router.push(`/u/${list.owner_handle}?tab=lists`); };
  return <div className="card stack">
    <b>Edit your list</b>
    <input className="inp" value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} maxLength={100} aria-label="Title" />
    <textarea className="inp" style={{ minHeight: 70 }} value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} maxLength={1000} placeholder="What ties these together?" aria-label="Description" />
    <label className="row" style={{ fontWeight: 600 }}><input type="checkbox" checked={meta.ranked} onChange={e => setMeta({ ...meta, ranked: e.target.checked })} /> Ranked</label>
    <div className="row"><button className="btn sm" onClick={saveMeta}>Save</button><button className="btn sm danger" onClick={del}>Delete list</button></div>
    <div className="field"><label htmlFor="add-q">Add albums or episodes</label><input id="add-q" className="inp" value={q} onChange={e => setQ(e.target.value)} placeholder="Search" autoComplete="off" /></div>
    <div className="pick">{hits.map(h => <button key={h.id} onClick={() => add(h.id)}><ItemArt item={h} size={44} /><span><b>{h.title}</b><br /><small className="muted">{h.artist_name}</small></span></button>)}</div>
    <AppleSection title="More from Apple" results={fromApple} have={new Set(hits.map(h => h.id))} onPick={add} />
    {!!entries.length && <div className="stack" style={{ gap: 4 }}><b>Order, notes and removal</b>{entries.map((e, i) => <div key={e.item_id} className="row" style={{ flexWrap: 'nowrap' }}>
      <span style={{ width: 24, fontWeight: 800 }}>{i + 1}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{items[e.item_id]?.title ?? e.item_id}</span>
      <button className="x" onClick={() => move(i, -1)} aria-label="Move up">↑</button><button className="x" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
      <button className="x" onClick={() => note(e)} aria-label="Edit note"><Icon name="pen" size={15} /></button><button className="x" onClick={() => remove(e)} aria-label="Remove"><Icon name="trash" size={15} /></button>
    </div>)}</div>}
  </div>;
}
