// Sends a push notification for each new row in public.notifications.
// Wire-up (once): Supabase → Database → Webhooks → new webhook on INSERT into public.notifications,
// type "Supabase Edge Functions", function "push", add header  x-melo-secret: <PUSH_WEBHOOK_SECRET>.
// Deploy:  supabase functions deploy push --no-verify-jwt
//          supabase secrets set PUSH_WEBHOOK_SECRET=<a long random string>
import { createClient } from 'npm:@supabase/supabase-js@2';

type Row = { id: string; user_id: string; actor: string | null; kind: string; post_id: string | null; comment_id: string | null; forecast_id: string | null; chat_id: string | null; body: string | null };

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const VERB: Record<string, string> = {
  comment: 'commented on your post', reply: 'replied to you', follow: 'followed you', like: 'liked your post', laugh: 'laughed at your post',
};

Deno.serve(async req => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-melo-secret') !== secret) return new Response('forbidden', { status: 403 });
  const { record: n } = (await req.json()) as { record: Row };
  if (!n?.user_id) return new Response('no record', { status: 400 });

  const [{ data: tokens }, { data: actor }] = await Promise.all([
    sb.from('push_tokens').select('token').eq('user_id', n.user_id),
    n.actor ? sb.from('profiles').select('name').eq('id', n.actor).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!tokens?.length) return new Response('no tokens');

  const who = actor?.name ?? 'Someone';
  const title = n.kind === 'resolved' ? 'A forecast you made resolved' : n.kind === 'message' ? who : `${who} ${VERB[n.kind] ?? 'did something'}`;
  const body = n.body ?? '';
  // Deep links the app opens when the notification is tapped.
  const url = n.chat_id ? `/chats/${n.chat_id}` : n.forecast_id ? `/forecast/${n.forecast_id}` : n.post_id ? `/post/${n.post_id}` : n.actor ? '/activity' : '/';

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map(t => ({ to: t.token, title, body, sound: 'default', data: { url }, threadId: n.chat_id ?? n.kind }))),
  });
  const out = await res.json().catch(() => ({}));
  // Forget tokens for uninstalled apps.
  const dead = (out?.data ?? []).map((r: { status: string; details?: { error?: string } }, i: number) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null)).filter(Boolean);
  if (dead.length) await sb.from('push_tokens').delete().in('token', dead);
  return Response.json({ sent: tokens.length, removed: dead.length });
});
