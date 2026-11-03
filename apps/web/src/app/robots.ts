import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/supabase';
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/settings', '/chats', '/onboarding'] }], sitemap: `${SITE_URL}/sitemap.xml` };
}
