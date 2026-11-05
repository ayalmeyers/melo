import { createArtworkFixer, WIKI_HEADERS } from '@melo/core';
import { api } from './supabase';
import { apple } from './apple';

export const artwork = createArtworkFixer(api, apple, async url => {
  const r = await fetch(url, { headers: { Accept: 'application/json', ...WIKI_HEADERS } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

/*
 * Cover queue: any album, podcast or artist drawn on screen without real art asks for it here.
 * One lookup every 3.2 seconds (Apple allows about 20 searches a minute), newest request first so what is on screen fills in first.
 * Each find is saved to Melo, so it only has to happen once for everyone.
 */
import { useSyncExternalStore } from 'react';
import { DEMO } from './supabase';
import { cachedArtist, cachedItem, rememberArtist, rememberItem } from './hooks';

const listeners = new Set<() => void>();
let version = 0;
const queue: string[] = [];
const seen = new Set<string>();
let running = false;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export function wantArt(kind: 'item' | 'artist', id: string) {
  const key = `${kind}:${id}`;
  if (DEMO || seen.has(key)) return;
  seen.add(key); queue.push(key);
  if (!running) pump();
}
async function pump() {
  running = true;
  try {
    if (!(await api.uid())) { queue.length = 0; return; }
    while (queue.length) {
      const key = queue.pop()!; const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      let changed = false;
      if (kind === 'item') {
        const it = cachedItem(id) ?? await api.item(id).catch(() => null);
        if (!it || it.artwork_url || it.type === 'episode') continue;
        const fixed = await artwork.item(it).catch(() => null);
        if (fixed) { rememberItem(fixed); changed = true; }
        await wait(3200);
      } else {
        const a = cachedArtist(id) ?? (await api.artists([id]).catch(() => []))[0];
        if (!a || a.image_url) continue;
        const fixed = await artwork.artist(a).catch(() => null);
        if (fixed) { rememberArtist(fixed); changed = true; }
        await wait(800);
      }
      if (changed) { version++; listeners.forEach(l => l()); }
    }
  } finally { running = false; }
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Re-renders the caller whenever a new cover lands. */
export const useArtVersion = () => useSyncExternalStore(subscribe, () => version);
