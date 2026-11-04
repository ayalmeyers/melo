'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createArtworkFixer, WIKI_HEADERS, type Artist, type CatalogItem } from '@melo/core';
import { useMelo } from './session';
import { apple } from './apple';

let fixer: ReturnType<typeof createArtworkFixer> | null = null;

/** Invisible: the first signed-in visitor to a page without real art looks it up, saves it for everyone, and the page refreshes. */
export function FixArtwork({ item, artist }: { item?: CatalogItem; artist?: Artist }) {
  const { api, user } = useMelo(); const router = useRouter();
  useEffect(() => {
    if (!user) return;
    fixer ??= createArtworkFixer(api, apple, async url => (await fetch(url, { headers: WIKI_HEADERS })).json());
    const run = item ? fixer.item(item) : artist ? fixer.artist(artist) : Promise.resolve(null);
    run.then(changed => { if (changed) router.refresh(); }).catch(() => {});
  }, [api, user, item, artist, router]);
  return null;
}
