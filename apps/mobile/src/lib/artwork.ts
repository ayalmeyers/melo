import { createArtworkFixer, WIKI_HEADERS } from '@melo/core';
import { api } from './supabase';
import { apple } from './apple';

export const artwork = createArtworkFixer(api, apple, async url => {
  const r = await fetch(url, { headers: { Accept: 'application/json', ...WIKI_HEADERS } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});
