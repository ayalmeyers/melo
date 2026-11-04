/**
 * Cached pass-through to Apple's public catalog (iTunes Search API) for the website.
 * Only search and lookup on itunes.apple.com are allowed. Responses are cached at Vercel's edge for a day,
 * which keeps the site well under Apple's ~20 requests a minute.
 */
const ALLOWED = /^https:\/\/itunes\.apple\.com\/(search|lookup)\?[\w=&+%.,-]+$/;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') ?? '';
  if (!ALLOWED.test(url)) return Response.json({ error: 'not allowed' }, { status: 400 });
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 } });
    if (!r.ok) return Response.json({ results: [] }, { status: 200, headers: { 'Cache-Control': 'public, s-maxage=60' } });
    const json = await r.json();
    return Response.json(json, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch {
    return Response.json({ results: [] }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  }
}
