/**
 * Demo mode: the full app running on realistic sample data, no backend needed.
 * Used for design reviews and App Store screenshots. Turned on only by EXPO_PUBLIC_DEMO=1 / NEXT_PUBLIC_DEMO=1.
 */
import { ALBUMS, ARTISTS, GENRES, SHOWS } from './catalog-data.js';
import type {
  Artist, CatalogItem, ChartRow, Comment, FeedPost, Forecast, ForecastConsensus, ItemRating, ListCard, ListEntry, LogEntry,
  MeloNotification, Profile, ProfileStats, SimilarListener, TasteMatch,
} from './types';
import type { MeloApi } from './api';

const now = Date.now();
const ago = (h: number) => new Date(now - h * 36e5).toISOString();

export const DEMO_ME = 'u-ayal';
const P = (id: string, handle: string, name: string, color: string, cc: string, city: string, bio: string, top4: string[]): Profile =>
  ({ id, handle, name, color, cc, city, bio, top4, is_admin: id === DEMO_ME, accepted_terms_at: ago(400), created_at: ago(2000) });
const people: Profile[] = [
  P(DEMO_ME, 'ayal', 'Ayal Meyers', '#047eef', 'US', 'New York', 'Listening like it is a sport. Top 4 changes weekly.', ['blonde', 'tpab', 'motomami', 'discovery']),
  P('u-nia', 'niaplays', 'Nia Okafor', '#e0457b', 'NG', 'Lagos', 'Afrobeats historian. Will argue about Fela.', ['zombie', 'bitw', 'giant', 'timeless']),
  P('u-leo', 'leo.wav', 'Leo Marchetti', '#7c5cff', 'IT', 'Milan', 'Synths, samples, sleep schedule optional.', ['discovery', 'ram', 'kida', 'variety']),
  P('u-sam', 'samrides', 'Samantha Rider', '#ff8a3d', 'US', 'Los Angeles', 'Concert every week or I get weird.', ['ctrl', 'sos', 'renaissance', 'brat']),
  P('u-kai', 'kaitoz', 'Kai Tanaka', '#14a37f', 'JP', 'Tokyo', 'City pop forever. Ask me about Mariya.', ['variety', 'h23', 'igor', 'okc']),
  P('u-mar', 'marisol', 'Marisol Vega', '#d63c3c', 'PR', 'San Juan', 'Reggaetón purist with a soft spot for Rosalía.', ['dtmf', 'uvst', 'elmal', 'msb']),
];
const byId = Object.fromEntries(people.map(p => [p.id, p]));

const items: CatalogItem[] = [
  ...ALBUMS.map(([id, title, artistId, year, genre]) => ({ id, type: 'album' as const, title, artist_id: artistId, artist_name: ARTISTS[artistId]?.name ?? '', show_id: null, year, cc: ARTISTS[artistId]?.cc ?? 'US', genre, dur_min: null, source: 'seed' as const, added_by: null, created_at: ago(3000), artwork_url: null })),
  ...SHOWS.map(([id, title, host]) => ({ id, type: 'show' as const, title, artist_id: null, artist_name: host, show_id: null, year: null, cc: 'US', genre: 'podcasts', dur_min: null, source: 'seed' as const, added_by: null, created_at: ago(3000), artwork_url: null })),
];
const itemById = Object.fromEntries(items.map(i => [i.id, i]));
const artists: Artist[] = Object.entries(ARTISTS).map(([id, a]) => ({ id, name: a.name, cc: a.cc, genres: a.genres }));

let seq = 0;
const post = (author: string, h: number, p: Partial<FeedPost> & { body: string; kind: FeedPost['kind'] }): FeedPost => {
  const a = byId[author];
  const likes = 3 + ((seq * 37) % 140), laughs = (seq * 13) % 30, comments = (seq * 7) % 24;
  return { id: `p${++seq}`, author, author_handle: a.handle, author_name: a.name, author_color: a.color, author_cc: a.cc, target_type: null, target_id: null, rating: null, title: null, spoiler: false,
    created_at: ago(h), likes, laughs, comment_count: comments, agree: p.kind === 'take' ? 20 + seq * 3 : 0, disagree: p.kind === 'take' ? 9 + seq : 0, hot: 100 - h, ...p };
};
const posts: FeedPost[] = [
  post('u-nia', 0.4, { kind: 'take', target_type: 'artist', target_id: 'fela', body: 'Every Afrobeats song you love this year is borrowing a horn line Fela wrote in 1976. Say thank you.' }),
  post('u-sam', 1.2, { kind: 'review', target_type: 'item', target_id: 'sos', rating: 9, body: 'SZA wrote a breakup album that sounds like the morning after the breakup album. "Good Days" energy stretched across 23 tracks and somehow none of it is filler.' }),
  post('u-leo', 2, { kind: 'thread', target_type: 'item', target_id: 'discovery', title: 'Discovery is the most influential album of the 2000s. Change my mind.', body: 'Kanye sampled it, The Weeknd built a career on it, and every pop producer still chases the "One More Time" filter sweep.' }),
  post('u-kai', 3.5, { kind: 'review', target_type: 'item', target_id: 'variety', rating: 10, body: 'Plastic Love was a 1984 B-side that YouTube resurrected 30 years later. The whole record holds up like that.' }),
  post('u-mar', 5, { kind: 'take', target_type: 'item', target_id: 'dtmf', body: 'DtMF is Bad Bunny’s best album and it is not close. Puerto Rico in every bar.' }),
  post(DEMO_ME, 7, { kind: 'review', target_type: 'item', target_id: 'blonde', rating: 10, body: 'Blonde is about memory more than heartbreak. Frank leaves room in every song, and the silence does half the work.' }),
  post('u-nia', 9, { kind: 'review', target_type: 'item', target_id: 'bitw', rating: 8, body: 'Tems finally made the album her voice deserved. "Love Me JeJe" is the summer.' }),
  post('u-sam', 12, { kind: 'take', target_type: 'genre', target_id: 'pop', body: 'brat summer was the first time a mixtape aesthetic beat a marketing budget.' }),
  post('u-leo', 20, { kind: 'thread', target_type: 'genre', target_id: 'electronic', title: 'Best headphones album for a night train?', body: 'Mine is Random Access Memories. Yours?' }),
  post('u-kai', 26, { kind: 'review', target_type: 'item', target_id: 'igor', rating: 9, body: 'Tyler made a love album that sounds like a fever. Best mix of his career.' }),
];
const ratings: Record<string, ItemRating> = Object.fromEntries(items.filter(i => i.type === 'album').map((it, i) => {
  const n = 18 + ((i * 53) % 260); const avg = Math.round((3.4 + ((i * 7) % 15) / 10) * 10) / 10;
  const hist = Array.from({ length: 10 }, (_, k) => Math.max(0, Math.round(n * Math.exp(-((k + 1 - avg * 2) ** 2) / 6) / 3)));
  return [it.id, { item_id: it.id, avg_stars: Math.min(5, avg), n, histogram: hist }];
}));
const forecasts = [
  { id: 'wrapped2026', question: 'Will Spotify name a non-US artist its most-streamed artist worldwide in Wrapped 2026?', p: 64, n: 412 },
  { id: 'kpop200', question: 'Will a K-pop act top the Billboard 200 at least once in 2027?', p: 81, n: 288 },
  { id: 'frank2027', question: 'Will Frank Ocean release a new studio album in 2027?', p: 12, n: 903 },
  { id: 'afrofest2027', question: 'Will an Afrobeats act headline a night at Coachella, Lollapalooza or Governors Ball in 2027?', p: 47, n: 167 },
].map(f => ({ forecast: { id: f.id, question: f.question, detail: 'Resolves from official chart and festival announcements.', closes_on: '2027-06-30', target_type: null, target_id: null, created_by: null, created_at: ago(300) } as Forecast,
  c: { forecast_id: f.id, crowd_p: f.p, forecasters: f.n, distribution: Array.from({ length: 10 }, (_, k) => Math.round(f.n * Math.exp(-((k * 10 + 5 - f.p) ** 2) / 600) / 4)), outcome: null, resolved_at: null } as ForecastConsensus }));
const chartRows = (ids: string[], type: 'item' | 'artist'): ChartRow[] => ids.map((id, i) => ({ subject_id: id, subject_type: type, rank: i + 1, prev_rank: [2, 1, null, 3, 7, 5, null, 6, 12, 9][i] ?? null, listeners: 340 - i * 27, logs: 520 - i * 31, avg_rating: Math.round((4.6 - i * 0.12) * 10) / 10 }));
const lists: ListCard[] = [
  { id: 'l1', owner: DEMO_ME, title: 'Albums that explain me', description: 'Ranked. Argue in the comments.', ranked: true, created_at: ago(90), updated_at: ago(3), owner_handle: 'ayal', owner_name: 'Ayal Meyers', owner_color: '#047eef', item_count: 12,
    preview: ['blonde', 'tpab', 'motomami', 'discovery'].map(id => ({ id, title: itemById[id].title, type: 'album' as const, artwork_url: null })) },
  { id: 'l2', owner: 'u-nia', title: 'Afrobeats, start here', description: 'Ten records, fifty years.', ranked: true, created_at: ago(120), updated_at: ago(30), owner_handle: 'niaplays', owner_name: 'Nia Okafor', owner_color: '#e0457b', item_count: 10,
    preview: ['zombie', 'giant', 'timeless', 'bitw'].map(id => ({ id, title: itemById[id].title, type: 'album' as const, artwork_url: null })) },
];
const notes: MeloNotification[] = [
  { id: 'n1', user_id: DEMO_ME, actor: 'u-nia', kind: 'reply', post_id: 'p6', comment_id: null, forecast_id: null, chat_id: null, body: 'Nights is the hinge of the whole record.', read_at: null, created_at: ago(0.3) },
  { id: 'n2', user_id: DEMO_ME, actor: 'u-kai', kind: 'follow', post_id: null, comment_id: null, forecast_id: null, chat_id: null, body: null, read_at: null, created_at: ago(2) },
  { id: 'n3', user_id: DEMO_ME, actor: 'u-sam', kind: 'like', post_id: 'p6', comment_id: null, forecast_id: null, chat_id: null, body: null, read_at: ago(5), created_at: ago(6) },
];
const comments: Comment[] = [
  { id: 'c1', post_id: 'p6', forecast_id: null, author: 'u-nia', reply_to: null, body: 'Nights is the hinge of the whole record.', created_at: ago(0.3), author_handle: 'niaplays', author_name: 'Nia Okafor', author_color: '#e0457b', likes: 12 },
  { id: 'c2', post_id: 'p6', forecast_id: null, author: 'u-leo', reply_to: null, body: 'Self Control is the best song on it and I will not be taking questions.', created_at: ago(1), author_handle: 'leo.wav', author_name: 'Leo Marchetti', author_color: '#7c5cff', likes: 31 },
];

const me = byId[DEMO_ME];
const session = { user: { id: DEMO_ME, email: 'demo@melo.app' } };
const list = <T,>(x: T[]) => Promise.resolve(x);
const one = <T,>(x: T) => Promise.resolve(x);

const impl: Partial<Record<keyof MeloApi, unknown>> = {
  sb: { auth: { getSession: () => one({ data: { session } }), getUser: () => one({ data: { user: session.user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: () => one({}) }, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} },
  uid: () => one(DEMO_ME),
  me: () => one(me),
  profileByHandle: (h: string) => one(people.find(p => p.handle === h) ?? null),
  profile: (id: string) => one(byId[id] ?? null),
  profilesByIds: (ids: string[]) => list(people.filter(p => ids.includes(p.id))),
  stats: (id: string) => one({ id, followers: id === DEMO_ME ? 1284 : 312, following: 186, logged: 642, posts: 58, ear: 74 } as ProfileStats),
  searchPeople: (q: string) => list(people.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))),
  item: (id: string) => one(itemById[id] ?? null),
  items: (ids: string[]) => list(ids.map(id => itemById[id]).filter(Boolean)),
  itemsBy: (f: { artist?: string; genre?: string; type?: string }) => list(items.filter(i => (!f.artist || i.artist_id === f.artist) && (!f.genre || i.genre === f.genre) && (!f.type || i.type === f.type))),
  artist: (id: string) => one(artists.find(a => a.id === id) ?? null),
  artists: (ids: string[]) => list(artists.filter(a => ids.includes(a.id))),
  searchArtists: (q: string) => list(artists.filter(a => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5)),
  artistsByGenre: (g: string) => list(artists.filter(a => a.genres.includes(g))),
  searchItems: (q: string) => list(items.filter(i => (i.title + ' ' + i.artist_name).toLowerCase().includes(q.toLowerCase())).slice(0, 10)),
  genreArt: () => one({}),
  ratings: (ids: string[]) => one(Object.fromEntries(ids.filter(id => ratings[id]).map(id => [id, ratings[id]]))),
  mostRated: () => list(Object.values(ratings).sort((a, b) => b.n - a.n).slice(0, 12)),
  wiki: (k: string) => one(k.startsWith('r:') && ARTISTS[k.slice(2)] ? { key: k, body: ARTISTS[k.slice(2)].wiki, rev: 4, updated_by: null, updated_at: ago(40) } : k.startsWith('g:') && GENRES[k.slice(2)] ? { key: k, body: GENRES[k.slice(2)].wiki, rev: 2, updated_by: null, updated_at: ago(80) } : null),
  wikiHistory: () => list([]),
  feed: (mode: string, o: { target?: { type: string; id: string }; author?: string; limit?: number } = {}) => list(posts.filter(p => (!o.target || (p.target_type === o.target.type && p.target_id === o.target.id)) && (!o.author || p.author === o.author))
    .sort((a, b) => (mode === 'hot' ? b.likes + b.comment_count * 3 - (a.likes + a.comment_count * 3) : b.created_at.localeCompare(a.created_at))).slice(0, o.limit ?? 30)),
  post: (id: string) => one(posts.find(p => p.id === id) ?? null),
  myVotes: () => one({}), myReactions: () => one(new Set(['p6:like'])),
  comments: (on: { post?: string }) => list(comments.filter(c => c.post_id === on.post)),
  diary: (uid: string) => list((byId[uid]?.top4 ?? []).concat(['ctrl', 'giant', 'okc']).map((item_id, i) => ({ id: `d${i}`, user_id: uid, item_id, rating: 10 - (i % 4), liked: i % 2 === 0, listened_at: ago(i * 30) } as LogEntry))),
  recentLogs: () => list([['u-nia', 'bitw', 0.3], ['u-sam', 'sos', 1], ['u-leo', 'ram', 2], ['u-kai', 'variety', 4], ['u-mar', 'dtmf', 6]].map(([u, it, h], i) => ({ id: `r${i}`, user_id: u, item_id: it, rating: 9 - i, liked: i < 2, listened_at: ago(Number(h)) } as LogEntry))),
  myFollows: () => one({ users: new Set(['u-nia', 'u-leo', 'u-sam']), artists: new Set(['frank', 'fela']), genres: new Set(['rnb', 'afro']) }),
  followCount: () => one(2841),
  blocked: () => one(new Set<string>()),
  moments: () => list([]),
  forecasts: () => list(forecasts.map(f => ({ ...f.forecast, c: f.c }))),
  forecast: (id: string) => { const f = forecasts.find(x => x.forecast.id === id); return one(f ? { ...f.forecast, c: f.c, preds: [] } : null); },
  earBoard: () => list(people.map((p, i) => ({ user_id: p.id, ear: 88 - i * 6, resolved: 30 - i * 3 }))),
  radar: () => list([{ subject_id: 'tems', subject_type: 'artist', recent: 40, baseline: 9, listeners: 61, score: 4.4 }, { subject_id: 'bitw', subject_type: 'item', recent: 30, baseline: 8, listeners: 44, score: 3.7 }]),
  chats: () => list([{ id: 'ch1', name: '', created_by: DEMO_ME, created_at: ago(50), last_message_at: ago(0.2), last_message_preview: 'ok you were right about Plastic Love', last_message_by: 'u-kai', members: [{ chat_id: 'ch1', user_id: DEMO_ME, last_read_at: ago(1) }, { chat_id: 'ch1', user_id: 'u-kai', last_read_at: ago(0.2) }] }]),
  messages: () => list([]),
  chart: (_s: string, kind: string) => one(kind === 'artists' ? chartRows(['badbunny', 'sza', 'tems', 'charli', 'frank', 'kendrick', 'rosalia', 'burna'], 'artist') : kind === 'podcasts' ? chartRows(SHOWS.map(s => s[0]), 'item') : chartRows(['dtmf', 'sos', 'bitw', 'brat', 'gnx', 'motomami', 'blonde', 'timeless', 'ctrl', 'igor'], 'item')),
  tasteMatch: () => one({ score: 82, shared_items: 14, shared_artists: 9, co_rated: 11, agreement: 0.86, top_shared: ['blonde', 'ctrl', 'discovery'], both_loved: ['blonde', 'ctrl', 'discovery'] } as TasteMatch),
  similarListeners: () => list(people.slice(1).map((p, i) => ({ user_id: p.id, score: 88 - i * 7, shared_items: 12 - i, shared_artists: 8 - i } as SimilarListener))),
  lists: (o: { owner?: string; containing?: string } = {}) => list(lists.filter(l => (!o.owner || l.owner === o.owner) && (!o.containing || l.preview.some(p => p.id === o.containing)))),
  list: (id: string) => { const l = lists.find(x => x.id === id); return one(l ? { list: l, entries: l.preview.map((p, i) => ({ list_id: id, item_id: p.id, position: i, note: i === 0 ? 'The one.' : '', added_at: ago(10) } as ListEntry)) } : null); },
  notifications: () => list(notes), unreadCount: () => one(2), onNotifications: () => () => {}, onMessages: () => () => {},
  activity: () => one({ replies: [], followers: [] }),
};

/** A MeloApi backed by sample data; writes resolve without doing anything. */
export function createDemoApi(): MeloApi {
  return new Proxy(impl as MeloApi, {
    get(target, key: string) {
      if (key in target) return (target as Record<string, unknown>)[key];
      return async () => null; // writes and anything not modelled: succeed quietly
    },
  });
}
export const DEMO_PEOPLE = people;
