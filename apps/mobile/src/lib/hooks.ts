import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { artistName, genreName, MeloError, type Artist, type CatalogItem, type Target } from '@melo/core';
import { api, WEB_URL } from './supabase';

/** Load data, with reload for pull-to-refresh and setData for optimistic updates. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn); fnRef.current = fn;
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fnRef.current()); } catch (e) { setError(errText(e)); } finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, setData, loading, error, reload };
}

export const errText = (e: unknown) => e instanceof MeloError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.';
export const fail = (e: unknown) => Alert.alert('Melo', errText(e));

/* Item titles for target chips, cached for the session. */
const itemCache = new Map<string, CatalogItem>();
export async function loadItems(ids: string[]) {
  const missing = [...new Set(ids)].filter(id => !itemCache.has(id));
  if (missing.length) (await api.items(missing).catch(() => [])).forEach(it => itemCache.set(it.id, it));
  return itemCache;
}
export const cachedItem = (id: string) => itemCache.get(id);
export const rememberItem = (it: CatalogItem) => itemCache.set(it.id, it);

/* Artists, seeded and imported from Apple, cached the same way. */
const artistCache = new Map<string, Artist>();
export async function loadArtists(ids: string[]) {
  const missing = [...new Set(ids)].filter(id => !artistCache.has(id));
  if (missing.length) (await api.artists(missing).catch(() => [])).forEach(a => artistCache.set(a.id, a));
  return artistCache;
}
export const cachedArtist = (id: string) => artistCache.get(id);
export const rememberArtist = (a: Artist) => artistCache.set(a.id, a);
export function targetLabel(t: Target) {
  if (t.type === 'artist') return artistCache.get(t.id)?.name ?? artistName(t.id);
  if (t.type === 'genre') return genreName(t.id) || t.id;
  return itemCache.get(t.id)?.title ?? 'Album';
}
export function targetHref(t: Target) {
  return t.type === 'item' ? `/item/${t.id}` : t.type === 'artist' ? `/artist/${t.id}` : `/genre/${t.id}`;
}
export const go = (href: string) => router.push(href as never);

/** Share to Instagram, Messages and anywhere else through the system share sheet. Links open the web page, which carries rich previews. */
export function shareLink(path: string, message: string) {
  const url = WEB_URL.replace(/\/$/, '') + path;
  Share.share({ message: `${message}\n${url}`, url }).catch(() => {});
}

/** Opens a page of the Melo website (terms, privacy, support) in an in-app browser. */
export const openWeb = (path: string) => WebBrowser.openBrowserAsync(WEB_URL.replace(/\/$/, '') + path).catch(() => {});

/** Downloads the story card the website renders (1080×1920) and opens the share sheet, where Instagram offers Stories. */
export async function shareStory(storyPath: string) {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    const file = await File.downloadFileAsync(WEB_URL.replace(/\/$/, '') + storyPath, new File(Paths.cache, `melo-story-${Date.now()}.png`));
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share to your story' });
  } catch (e) { fail(e); }
}

/** Share choices for anything with a page: a story image (posts, albums) or the link. */
export function shareMenu(opts: { path: string; message: string; storyPath?: string }) {
  if (!opts.storyPath) return shareLink(opts.path, opts.message);
  const choices = ['Share to story', 'Share link', 'Cancel'];
  const pick = (i: number) => { if (i === 0) shareStory(opts.storyPath!); else if (i === 1) shareLink(opts.path, opts.message); };
  if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: choices, cancelButtonIndex: 2 }, pick);
  else Alert.alert('Share', undefined, [{ text: choices[0], onPress: () => pick(0) }, { text: choices[1], onPress: () => pick(1) }, { text: 'Cancel', style: 'cancel' }]);
}
