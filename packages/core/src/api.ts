import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CatalogItem, Chat, ChatMember, Comment, FeedPost, FollowKind, Forecast, ForecastConsensus, ItemRating,
  LogEntry, Message, Moment, PostKind, Profile, ProfileStats, RadarRow, ShareType, Target, WikiPage,
} from './types';

/** A thrown error with a message that is safe to show people. */
export class MeloError extends Error {}

function ok<T>(res: { data: T | null; error: { message: string; code?: string } | null }, friendly?: string): T {
  if (res.error) {
    const m = res.error.message || '';
    if (res.error.code === '23505') throw new MeloError(friendly ?? 'That already exists.');
    if (/row-level security|permission denied/i.test(m)) throw new MeloError('You are not allowed to do that.');
    if (/JWT|not signed in|Sign in/i.test(m)) throw new MeloError('Sign in to do that.');
    throw new MeloError(friendly ?? m);
  }
  return res.data as T;
}

export type FeedMode = 'hot' | 'new' | 'following';

/** Every read and write the apps make, in one place. */
export function createApi(sb: SupabaseClient) {
  const uid = async () => (await sb.auth.getUser()).data.user?.id ?? null;
  const need = async () => { const u = await uid(); if (!u) throw new MeloError('Sign in to do that.'); return u; };

  return {
    sb,
    uid,

    /* ---------- auth ---------- */
    async sendCode(email: string) { ok(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }) as never); },
    async verifyCode(email: string, token: string) { const r = await sb.auth.verifyOtp({ email, token, type: 'email' }); if (r.error) throw new MeloError('That code did not work. Check it, or send a new one.'); return r.data.user; },
    async signOut() { await sb.auth.signOut(); },
    async deleteAccount() { ok(await sb.rpc('delete_account')); await sb.auth.signOut(); },

    /* ---------- profiles ---------- */
    async me(): Promise<Profile | null> { const u = await uid(); if (!u) return null; return ok(await sb.from('profiles').select('*').eq('id', u).maybeSingle()); },
    async profileByHandle(handle: string): Promise<Profile | null> { return ok(await sb.from('profiles').select('*').eq('handle', handle.toLowerCase()).maybeSingle()); },
    async profile(id: string): Promise<Profile | null> { return ok(await sb.from('profiles').select('*').eq('id', id).maybeSingle()); },
    async profilesByIds(ids: string[]): Promise<Profile[]> { if (!ids.length) return []; return ok(await sb.from('profiles').select('*').in('id', ids)); },
    async stats(id: string): Promise<ProfileStats | null> { return ok(await sb.from('profile_stats').select('*').eq('id', id).maybeSingle()); },
    async handleAvailable(h: string): Promise<boolean> { return ok(await sb.rpc('handle_available', { h: h.toLowerCase() })) as boolean; },
    async saveProfile(p: Partial<Pick<Profile, 'handle' | 'name' | 'bio' | 'city' | 'cc' | 'top4' | 'color'>> & { acceptTerms?: boolean }) {
      const id = await need();
      const { acceptTerms, ...fields } = p;
      const exists = ok(await sb.from('profiles').select('id').eq('id', id).maybeSingle());
      const row = { ...fields, ...(fields.handle ? { handle: fields.handle.toLowerCase() } : {}), ...(acceptTerms ? { accepted_terms_at: new Date().toISOString() } : {}) };
      if (exists) ok(await sb.from('profiles').update(row).eq('id', id), 'That username is taken.');
      else ok(await sb.from('profiles').insert({ id, ...row }), 'That username is taken.');
    },
    async searchPeople(q: string): Promise<Profile[]> { return ok(await sb.from('profiles').select('*').or(`handle.ilike.%${q}%,name.ilike.%${q}%`).limit(20)); },

    /* ---------- catalog ---------- */
    async item(id: string): Promise<CatalogItem | null> { return ok(await sb.from('catalog_items').select('*').eq('id', id).maybeSingle()); },
    async items(ids: string[]): Promise<CatalogItem[]> { if (!ids.length) return []; return ok(await sb.from('catalog_items').select('*').in('id', ids)); },
    async itemsBy(filter: { artist?: string; genre?: string; show?: string; type?: string }, limit = 60): Promise<CatalogItem[]> {
      let q = sb.from('catalog_items').select('*').order('year', { ascending: false, nullsFirst: false }).limit(limit);
      if (filter.artist) q = q.eq('artist_id', filter.artist);
      if (filter.genre) q = q.eq('genre', filter.genre);
      if (filter.show) q = q.eq('show_id', filter.show);
      if (filter.type) q = q.eq('type', filter.type);
      return ok(await q);
    },
    async searchItems(q: string, limit = 20): Promise<CatalogItem[]> { const s = q.replace(/[%,()]/g, ' ').trim(); if (!s) return []; return ok(await sb.from('catalog_items').select('*').or(`title.ilike.%${s}%,artist_name.ilike.%${s}%`).limit(limit)); },
    async addItem(it: { type: 'album' | 'episode'; title: string; artist_name: string; artist_id?: string | null; show_id?: string | null; year?: number | null; cc: string; genre: string; dur_min?: number | null }): Promise<string> {
      const by = await need();
      const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      ok(await sb.from('catalog_items').insert({ id, source: 'user', added_by: by, ...it }));
      return id;
    },
    async ratings(ids: string[]): Promise<Record<string, ItemRating>> {
      if (!ids.length) return {};
      const rows = ok(await sb.from('item_ratings').select('*').in('item_id', ids)) as ItemRating[];
      return Object.fromEntries(rows.map(r => [r.item_id, r]));
    },
    async mostRated(limit = 12): Promise<ItemRating[]> { return ok(await sb.from('item_ratings').select('*').order('n', { ascending: false }).limit(limit)); },

    /* ---------- wiki ---------- */
    async wiki(key: string): Promise<WikiPage | null> { return ok(await sb.from('wiki_pages').select('*').eq('key', key).maybeSingle()); },
    async wikiHistory(key: string) { return ok(await sb.from('wiki_revisions').select('rev, edited_by, edited_at').eq('key', key).order('rev', { ascending: false }).limit(20)) as { rev: number; edited_by: string | null; edited_at: string }[]; },
    async editWiki(key: string, body: string): Promise<number> { return ok(await sb.rpc('edit_wiki', { p_key: key, p_body: body })) as number; },

    /* ---------- posts ---------- */
    async feed(mode: FeedMode, opts: { limit?: number; before?: string; target?: Target; author?: string; targets?: Target[]; authors?: string[] } = {}): Promise<FeedPost[]> {
      let q = sb.from('post_feed').select('*').limit(opts.limit ?? 30);
      if (opts.target) q = q.eq('target_type', opts.target.type).eq('target_id', opts.target.id);
      if (opts.author) q = q.eq('author', opts.author);
      if (mode === 'following') {
        const ors: string[] = [];
        if (opts.authors?.length) ors.push(`author.in.(${opts.authors.join(',')})`);
        for (const kind of ['artist', 'genre', 'item'] as const) { const ids = (opts.targets ?? []).filter(t => t.type === kind).map(t => t.id); if (ids.length) ors.push(`and(target_type.eq.${kind},target_id.in.(${ids.join(',')}))`); }
        if (!ors.length) return [];
        q = q.or(ors.join(','));
      }
      if (opts.before) q = q.lt('created_at', opts.before);
      q = mode === 'hot' ? q.order('hot', { ascending: false }) : q.order('created_at', { ascending: false });
      return ok(await q);
    },
    async post(id: string): Promise<FeedPost | null> { return ok(await sb.from('post_feed').select('*').eq('id', id).maybeSingle()); },
    async createPost(p: { kind: PostKind; target?: Target | null; rating?: number | null; title?: string | null; body: string; spoiler?: boolean }): Promise<string> {
      await need();
      const row = { kind: p.kind, target_type: p.target?.type ?? null, target_id: p.target?.id ?? null, rating: p.rating ?? null, title: p.title ?? null, body: p.body, spoiler: !!p.spoiler };
      const data = ok(await sb.from('posts').insert(row).select('id').single()) as { id: string };
      return data.id;
    },
    async deletePost(id: string) { ok(await sb.from('posts').delete().eq('id', id)); },
    async myVotes(postIds: string[]): Promise<Record<string, 'agree' | 'disagree'>> {
      const u = await uid(); if (!u || !postIds.length) return {};
      const rows = ok(await sb.from('votes').select('post_id,value').eq('user_id', u).in('post_id', postIds)) as { post_id: string; value: 'agree' | 'disagree' }[];
      return Object.fromEntries(rows.map(r => [r.post_id, r.value]));
    },
    async vote(postId: string, value: 'agree' | 'disagree' | null) {
      const u = await need();
      if (value === null) ok(await sb.from('votes').delete().eq('user_id', u).eq('post_id', postId));
      else ok(await sb.from('votes').upsert({ user_id: u, post_id: postId, value }));
    },
    async myReactions(targetIds: string[]): Promise<Set<string>> {
      const u = await uid(); if (!u || !targetIds.length) return new Set();
      const rows = ok(await sb.from('reactions').select('target_id,kind').eq('user_id', u).in('target_id', targetIds)) as { target_id: string; kind: string }[];
      return new Set(rows.map(r => r.target_id + ':' + r.kind));
    },
    async react(targetType: 'post' | 'comment', targetId: string, kind: 'like' | 'laugh', on: boolean) {
      const u = await need();
      if (on) ok(await sb.from('reactions').upsert({ user_id: u, target_type: targetType, target_id: targetId, kind }));
      else ok(await sb.from('reactions').delete().match({ user_id: u, target_type: targetType, target_id: targetId, kind }));
    },

    /* ---------- comments ---------- */
    async comments(on: { post?: string; forecast?: string }): Promise<Comment[]> {
      let q = sb.from('comment_feed').select('*').order('created_at', { ascending: true }).limit(500);
      q = on.post ? q.eq('post_id', on.post) : q.eq('forecast_id', on.forecast!);
      return ok(await q);
    },
    async addComment(on: { post?: string; forecast?: string }, body: string, replyTo?: string | null) {
      await need();
      ok(await sb.from('comments').insert({ post_id: on.post ?? null, forecast_id: on.forecast ?? null, body, reply_to: replyTo ?? null }));
    },
    async deleteComment(id: string) { ok(await sb.from('comments').delete().eq('id', id)); },

    /* ---------- diary ---------- */
    async log(itemId: string, rating: number | null, liked = false) { await need(); ok(await sb.from('logs').insert({ item_id: itemId, rating, liked })); },
    async diary(userId: string, limit = 200): Promise<LogEntry[]> { return ok(await sb.from('logs').select('*').eq('user_id', userId).order('listened_at', { ascending: false }).limit(limit)); },
    async deleteLog(id: string) { ok(await sb.from('logs').delete().eq('id', id)); },

    /* ---------- follows and blocks ---------- */
    async myFollows(): Promise<{ users: Set<string>; artists: Set<string>; genres: Set<string> }> {
      const u = await uid(); const out = { users: new Set<string>(), artists: new Set<string>(), genres: new Set<string>() };
      if (!u) return out;
      const rows = ok(await sb.from('follows').select('kind,target').eq('follower', u)) as { kind: FollowKind; target: string }[];
      for (const r of rows) (r.kind === 'user' ? out.users : r.kind === 'artist' ? out.artists : out.genres).add(r.target);
      return out;
    },
    async follows(userId: string) { return ok(await sb.from('follows').select('kind,target,created_at').eq('follower', userId)) as { kind: FollowKind; target: string; created_at: string }[]; },
    async followCount(kind: FollowKind, target: string): Promise<number> { const r = ok(await sb.from('follow_counts').select('n').eq('kind', kind).eq('target', target).maybeSingle()) as { n: number } | null; return r?.n ?? 0; },
    async follow(kind: FollowKind, target: string, on: boolean) {
      const u = await need();
      if (on) ok(await sb.from('follows').upsert({ follower: u, kind, target }));
      else ok(await sb.from('follows').delete().match({ follower: u, kind, target }));
    },
    async blocked(): Promise<Set<string>> { const u = await uid(); if (!u) return new Set(); const rows = ok(await sb.from('blocks').select('blocked').eq('blocker', u)) as { blocked: string }[]; return new Set(rows.map(r => r.blocked)); },
    async block(userId: string, on: boolean) { const u = await need(); if (on) ok(await sb.from('blocks').upsert({ blocker: u, blocked: userId })); else ok(await sb.from('blocks').delete().match({ blocker: u, blocked: userId })); },
    async report(targetType: 'post' | 'comment' | 'message' | 'profile' | 'moment', targetId: string, reason = '') { await need(); ok(await sb.from('reports').insert({ target_type: targetType, target_id: targetId, reason })); },

    /* ---------- moments ---------- */
    async moments(itemId: string): Promise<Moment[]> { return ok(await sb.from('moments').select('*').eq('item_id', itemId).order('t_seconds').limit(1000)); },
    async addMoment(itemId: string, t: number, body: string) { await need(); ok(await sb.from('moments').insert({ item_id: itemId, t_seconds: t, body })); },
    async deleteMoment(id: string) { ok(await sb.from('moments').delete().eq('id', id)); },

    /* ---------- forecasts ---------- */
    async forecasts(state: 'open' | 'resolved' = 'open'): Promise<(Forecast & { c: ForecastConsensus | null })[]> {
      const fs = ok(await sb.from('forecasts').select('*').order('created_at', { ascending: false }).limit(200)) as Forecast[];
      const cs = ok(await sb.from('forecast_consensus').select('*')) as ForecastConsensus[];
      const byId = Object.fromEntries(cs.map(c => [c.forecast_id, c]));
      const rows = fs.map(f => ({ ...f, c: byId[f.id] ?? null }));
      return state === 'open' ? rows.filter(r => !r.c?.outcome).sort((a, b) => (b.c?.forecasters ?? 0) - (a.c?.forecasters ?? 0)) : rows.filter(r => r.c?.outcome);
    },
    async forecast(id: string) {
      const f = ok(await sb.from('forecasts').select('*').eq('id', id).maybeSingle()) as Forecast | null;
      if (!f) return null;
      const c = ok(await sb.from('forecast_consensus').select('*').eq('forecast_id', id).maybeSingle()) as ForecastConsensus | null;
      const preds = ok(await sb.from('forecast_predictions').select('user_id,p,updated_at').eq('forecast_id', id).order('updated_at', { ascending: false })) as { user_id: string; p: number; updated_at: string }[];
      return { ...f, c, preds };
    },
    async ask(q: { question: string; detail: string; closes_on: string; target?: Target | null }): Promise<string> {
      const u = await need();
      const data = ok(await sb.from('forecasts').insert({ question: q.question, detail: q.detail, closes_on: q.closes_on, target_type: q.target?.type ?? null, target_id: q.target?.id ?? null, created_by: u }).select('id').single()) as { id: string };
      return data.id;
    },
    async predict(forecastId: string, p: number) { const u = await need(); ok(await sb.from('forecast_predictions').upsert({ user_id: u, forecast_id: forecastId, p: Math.round(p) })); },
    async resolve(forecastId: string, outcome: 'yes' | 'no' | null) {
      const u = await need();
      if (outcome === null) ok(await sb.from('forecast_resolutions').delete().eq('forecast_id', forecastId));
      else ok(await sb.from('forecast_resolutions').insert({ forecast_id: forecastId, outcome, resolved_by: u }));
    },
    async earBoard(limit = 50) { return ok(await sb.from('ear_scores').select('*').order('ear', { ascending: false }).limit(limit)) as { user_id: string; resolved: number; brier: number; skill: number; ear: number }[]; },
    async radar(days = 7): Promise<RadarRow[]> { return ok(await sb.rpc('breakout_radar', { window_days: days, max_rows: 10 })); },

    /* ---------- chats ---------- */
    async chats(): Promise<(Chat & { members: ChatMember[] })[]> {
      const cs = ok(await sb.from('chats').select('*, members:chat_members(chat_id,user_id,last_read_at)').order('last_message_at', { ascending: false, nullsFirst: false })) as (Chat & { members: ChatMember[] })[];
      return cs;
    },
    async messages(chatId: string, limit = 200): Promise<Message[]> { const rows = ok(await sb.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(limit)) as Message[]; return rows.reverse(); },
    async send(chatId: string, msg: { body?: string; share?: { type: ShareType; id: string } }) {
      await need();
      ok(await sb.from('messages').insert({ chat_id: chatId, body: msg.body ?? null, share_type: msg.share?.type ?? null, share_id: msg.share?.id ?? null }));
    },
    async markRead(chatId: string) { const u = await uid(); if (u) ok(await sb.from('chat_members').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', u)); },
    async createChat(name: string, members: string[]): Promise<string> { return ok(await sb.rpc('create_chat', { p_name: name, p_members: members })) as string; },
    async openDm(userId: string): Promise<string> { return ok(await sb.rpc('open_dm', { p_user: userId })) as string; },
    async leaveChat(chatId: string) { const u = await need(); ok(await sb.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', u)); },
    onMessages(chatId: string, cb: (m: Message) => void) {
      const ch = sb.channel('chat:' + chatId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => cb(payload.new as Message)).subscribe();
      return () => { sb.removeChannel(ch); };
    },

    /* ---------- activity ---------- */
    async activity(limit = 50) {
      const u = await need();
      const myPosts = (ok(await sb.from('posts').select('id').eq('author', u).limit(500)) as { id: string }[]).map(r => r.id);
      const replies = myPosts.length ? ok(await sb.from('comment_feed').select('*').in('post_id', myPosts).neq('author', u).order('created_at', { ascending: false }).limit(limit)) as Comment[] : [];
      const followers = ok(await sb.from('follows').select('follower, created_at').eq('kind', 'user').eq('target', u).order('created_at', { ascending: false }).limit(limit)) as { follower: string; created_at: string }[];
      return { replies, followers };
    },

    /* ---------- growth ---------- */
    async joinWaitlist(email: string, extra: { platform?: string; album?: string; source?: string } = {}) {
      const r = await sb.from('waitlist').insert({ email: email.trim().toLowerCase(), ...extra });
      if (r.error && r.error.code !== '23505') throw new MeloError('That did not save. Check the email and try again.');
    },
  };
}

export type MeloApi = ReturnType<typeof createApi>;
