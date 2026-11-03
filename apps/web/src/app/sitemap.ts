import type { MetadataRoute } from 'next';
import { ARTISTS, GENRES } from '@melo/core';
import { SITE_URL } from '@/lib/supabase';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = ['', '/explore', '/forecasts', '/feed', '/privacy', '/terms', '/support'].map(p => ({ url: SITE_URL + p }));
  return [...base, ...Object.keys(ARTISTS).map(id => ({ url: `${SITE_URL}/artist/${id}` })), ...Object.keys(GENRES).map(id => ({ url: `${SITE_URL}/genre/${id}` }))];
}
