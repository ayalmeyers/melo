'use client';
import { useState } from 'react';
import { createArtworkFixer, WIKI_HEADERS } from '@melo/core';
import { useMelo } from './session';
import { apple } from './apple';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Admin tool: looks up every missing album cover (Apple) and artist photo (Wikimedia Commons), slowly enough to respect both services. */
export function ImageBackfill() {
  const { api } = useMelo();
  const [state, setState] = useState<{ done: number; total: number; found: number; running: boolean } | null>(null);
  async function run() {
    const fixer = createArtworkFixer(api, apple, async url => (await fetch(url, { headers: WIKI_HEADERS })).json());
    const [items, artists] = await Promise.all([api.itemsMissingArt(), api.artistsMissingImages()]);
    const jobs = [...items.map(it => () => fixer.item(it)), ...artists.map(a => () => fixer.artist(a))];
    let found = 0;
    setState({ done: 0, total: jobs.length, found, running: true });
    for (let i = 0; i < jobs.length; i++) {
      if (await jobs[i]().catch(() => null)) found++;
      setState({ done: i + 1, total: jobs.length, found, running: i + 1 < jobs.length });
      await wait(3200); // Apple allows about 20 searches a minute
    }
  }
  return <div className="card stack">
    <b>Images</b>
    <p className="muted">Fills in missing album covers from Apple and artist photos from Wikimedia Commons. Pages also do this on their own the first time someone signed in opens them.</p>
    {state && <p>{state.done} of {state.total} checked · {state.found} found{state.running ? ' · keep this tab open' : ' · done'}</p>}
    <div><button className="btn ghost" disabled={state?.running} onClick={run}>{state?.running ? 'Working…' : 'Fill in missing images'}</button></div>
  </div>;
}
