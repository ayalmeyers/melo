-- Melo database setup: paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Generated from supabase/migrations + supabase/seed.sql. Run it once on a fresh project.

-- ===== supabase/migrations/20261103000001_schema.sql =====
-- Melo schema. Postgres on Supabase. Every table has row level security.
create extension if not exists citext;

-- ---------------------------------------------------------------
-- Reference catalog
-- ---------------------------------------------------------------
create table public.genres (
  id text primary key,
  name text not null
);

create table public.artists (
  id text primary key,
  name text not null,
  cc text not null,
  genres text[] not null default '{}'
);

create table public.catalog_items (
  id text primary key,
  type text not null check (type in ('album','episode','show')),
  title text not null check (char_length(title) between 1 and 200),
  artist_id text references public.artists(id),
  artist_name text not null,
  show_id text references public.catalog_items(id),
  year int check (year between 1900 and 2100),
  cc text not null default 'US',
  genre text references public.genres(id),
  dur_min int check (dur_min between 1 and 1000),
  source text not null default 'user' check (source in ('seed','user')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index catalog_items_artist on public.catalog_items(artist_id);
create index catalog_items_show on public.catalog_items(show_id);
create index catalog_items_title on public.catalog_items using gin (to_tsvector('simple', title || ' ' || artist_name));

-- ---------------------------------------------------------------
-- People
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle citext unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  name text not null check (char_length(name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  city text not null default '' check (char_length(city) <= 40),
  cc text not null default 'US',
  top4 text[] not null default '{}' check (cardinality(top4) <= 4),
  color text not null default '#047eef',
  is_admin boolean not null default false,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$$;

create table public.follows (
  follower uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('user','artist','genre')),
  target text not null,
  created_at timestamptz not null default now(),
  primary key (follower, kind, target)
);
create index follows_target on public.follows(kind, target);

create table public.blocks (
  blocker uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- ---------------------------------------------------------------
-- Listening diary
-- ---------------------------------------------------------------
create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  item_id text not null references public.catalog_items(id) on delete cascade,
  rating smallint check (rating between 1 and 10),
  liked boolean not null default false,
  listened_at timestamptz not null default now()
);
create index logs_item on public.logs(item_id);
create index logs_user on public.logs(user_id, listened_at desc);
create index logs_recent on public.logs(listened_at desc);

-- ---------------------------------------------------------------
-- Posts and conversation
-- ---------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('review','take','thread')),
  target_type text check (target_type in ('item','artist','genre')),
  target_id text,
  rating smallint check (rating between 1 and 10),
  title text check (char_length(title) <= 140),
  body text not null default '' check (char_length(body) <= 6000),
  spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  check ((target_type is null) = (target_id is null)),
  check (kind <> 'review' or coalesce(target_type = 'item' and rating is not null, false)),
  check (kind <> 'take' or char_length(body) between 1 and 280),
  check (kind <> 'thread' or coalesce(char_length(title) >= 1, false))
);
create index posts_created on public.posts(created_at desc);
create index posts_target on public.posts(target_type, target_id);
create index posts_author on public.posts(author, created_at desc);

create table public.forecasts (
  id text primary key default replace(gen_random_uuid()::text,'-',''),
  question text not null check (char_length(question) between 10 and 200),
  detail text not null default '' check (char_length(detail) <= 1000),
  closes_on date not null,
  target_type text check (target_type in ('item','artist','genre')),
  target_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  forecast_id text references public.forecasts(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reply_to uuid references public.comments(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (forecast_id is null))
);
create index comments_post on public.comments(post_id, created_at);
create index comments_forecast on public.comments(forecast_id, created_at);

create table public.votes (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  value text not null check (value in ('agree','disagree')),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.reactions (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment')),
  target_id uuid not null,
  kind text not null check (kind in ('like','laugh')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id, kind)
);
create index reactions_target on public.reactions(target_type, target_id);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.catalog_items(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  t_seconds int not null check (t_seconds between 0 and 86400),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index moments_item on public.moments(item_id, t_seconds);

-- ---------------------------------------------------------------
-- Forecasts
-- ---------------------------------------------------------------
create table public.forecast_predictions (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  forecast_id text not null references public.forecasts(id) on delete cascade,
  p smallint not null check (p between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, forecast_id)
);

create table public.forecast_resolutions (
  forecast_id text primary key references public.forecasts(id) on delete cascade,
  outcome text not null check (outcome in ('yes','no')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz not null default now()
);

-- predictions lock once a question closes or resolves
create or replace function public.guard_prediction() returns trigger language plpgsql as $$
declare f public.forecasts;
begin
  select * into f from public.forecasts where id = new.forecast_id;
  if f.closes_on < current_date then raise exception 'This forecast is closed'; end if;
  if exists (select 1 from public.forecast_resolutions r where r.forecast_id = new.forecast_id) then
    raise exception 'This forecast is resolved';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger forecast_predictions_guard before insert or update on public.forecast_predictions
  for each row execute function public.guard_prediction();

-- ---------------------------------------------------------------
-- Wiki
-- ---------------------------------------------------------------
create table public.wiki_pages (
  key text primary key check (key ~ '^(a|r|g):[a-z0-9_-]+$'),
  body text not null check (char_length(body) between 20 and 20000),
  rev int not null default 1,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.wiki_revisions (
  id bigint generated always as identity primary key,
  key text not null references public.wiki_pages(key) on delete cascade,
  body text not null,
  rev int not null,
  edited_by uuid references public.profiles(id) on delete set null,
  edited_at timestamptz not null default now()
);
create index wiki_revisions_key on public.wiki_revisions(key, rev desc);

-- ---------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 50),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text,
  last_message_by uuid
);
create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index chat_members_user on public.chat_members(user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text check (char_length(body) <= 2000),
  share_type text check (share_type in ('post','comment','item','artist','genre','forecast')),
  share_id text,
  created_at timestamptz not null default now(),
  check (body is not null or share_type is not null),
  check ((share_type is null) = (share_id is null))
);
create index messages_chat on public.messages(chat_id, created_at);

create or replace function public.is_chat_member(c uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = c and user_id = uid)
$$;

create or replace function public.touch_chat() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chats set last_message_at = new.created_at,
    last_message_preview = coalesce(left(new.body, 80), 'Shared something'),
    last_message_by = new.author
  where id = new.chat_id;
  update public.chat_members set last_read_at = new.created_at where chat_id = new.chat_id and user_id = new.author;
  return new;
end $$;
create trigger messages_touch after insert on public.messages for each row execute function public.touch_chat();

-- ---------------------------------------------------------------
-- Safety and growth
-- ---------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','message','profile','moment')),
  target_id text not null,
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);

create table public.waitlist (
  email citext primary key check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  platform text check (char_length(platform) <= 40),
  album text check (char_length(album) <= 120),
  source text check (char_length(source) <= 60),
  created_at timestamptz not null default now()
);

-- ===== supabase/migrations/20261103000002_security.sql =====
-- Row level security. Reads are public unless noted (the website shows public pages).
-- Writes always belong to the signed-in person, or to admins for moderation.

alter table public.genres enable row level security;
alter table public.artists enable row level security;
alter table public.catalog_items enable row level security;
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.logs enable row level security;
alter table public.posts enable row level security;
alter table public.forecasts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.reactions enable row level security;
alter table public.moments enable row level security;
alter table public.forecast_predictions enable row level security;
alter table public.forecast_resolutions enable row level security;
alter table public.wiki_pages enable row level security;
alter table public.wiki_revisions enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.waitlist enable row level security;

-- catalog
create policy "catalog readable" on public.genres for select using (true);
create policy "artists readable" on public.artists for select using (true);
create policy "items readable" on public.catalog_items for select using (true);
create policy "members add items" on public.catalog_items for insert to authenticated
  with check (added_by = auth.uid() and source = 'user');
create policy "admins edit items" on public.catalog_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete items" on public.catalog_items for delete to authenticated using (public.is_admin());

-- profiles: the admin flag can never be set by its owner
create policy "profiles readable" on public.profiles for select using (true);
create policy "create own profile" on public.profiles for insert to authenticated with check (id = auth.uid() and is_admin = false);
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (handle, name, bio, city, cc, top4, color, accepted_terms_at) on public.profiles to authenticated;

-- per-person rows: everyone reads, each person writes their own
create policy "follows readable" on public.follows for select using (true);
create policy "follow as self" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "unfollow as self" on public.follows for delete to authenticated using (follower = auth.uid());

create policy "own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "block as self" on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "unblock as self" on public.blocks for delete to authenticated using (blocker = auth.uid());

create policy "logs readable" on public.logs for select using (true);
create policy "log as self" on public.logs for insert to authenticated with check (user_id = auth.uid());
create policy "edit own logs" on public.logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own logs" on public.logs for delete to authenticated using (user_id = auth.uid());

create policy "votes readable" on public.votes for select using (true);
create policy "vote as self" on public.votes for insert to authenticated with check (user_id = auth.uid());
create policy "change own vote" on public.votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own vote" on public.votes for delete to authenticated using (user_id = auth.uid());

create policy "reactions readable" on public.reactions for select using (true);
create policy "react as self" on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "unreact as self" on public.reactions for delete to authenticated using (user_id = auth.uid());

create policy "predictions readable" on public.forecast_predictions for select using (true);
create policy "predict as self" on public.forecast_predictions for insert to authenticated with check (user_id = auth.uid());
create policy "update own prediction" on public.forecast_predictions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- authored content: everyone reads, authors write, admins moderate
create policy "posts readable" on public.posts for select using (true);
create policy "post as self" on public.posts for insert to authenticated with check (author = auth.uid());
create policy "edit own post" on public.posts for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "delete own post or moderate" on public.posts for delete to authenticated using (author = auth.uid() or public.is_admin());

create policy "comments readable" on public.comments for select using (true);
create policy "comment as self" on public.comments for insert to authenticated with check (author = auth.uid());
create policy "delete own comment or moderate" on public.comments for delete to authenticated using (author = auth.uid() or public.is_admin());

create policy "moments readable" on public.moments for select using (true);
create policy "moment as self" on public.moments for insert to authenticated with check (author = auth.uid());
create policy "delete own moment or moderate" on public.moments for delete to authenticated using (author = auth.uid() or public.is_admin());

create policy "forecasts readable" on public.forecasts for select using (true);
create policy "ask as self" on public.forecasts for insert to authenticated with check (created_by = auth.uid());
create policy "admins edit forecasts" on public.forecasts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete forecasts" on public.forecasts for delete to authenticated using (public.is_admin());

create policy "resolutions readable" on public.forecast_resolutions for select using (true);
create policy "admins resolve" on public.forecast_resolutions for insert to authenticated with check (public.is_admin() and resolved_by = auth.uid());
create policy "admins reopen" on public.forecast_resolutions for delete to authenticated using (public.is_admin());

-- wiki: read by all, written only through edit_wiki()
create policy "wiki readable" on public.wiki_pages for select using (true);
create policy "wiki history readable" on public.wiki_revisions for select using (true);

-- chats: only members see anything
create policy "members see chat" on public.chats for select to authenticated using (public.is_chat_member(id));
create policy "members rename chat" on public.chats for update to authenticated using (public.is_chat_member(id)) with check (public.is_chat_member(id));
create policy "members see members" on public.chat_members for select to authenticated using (public.is_chat_member(chat_id));
create policy "mark own read" on public.chat_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave chat" on public.chat_members for delete to authenticated using (user_id = auth.uid());
create policy "members read messages" on public.messages for select to authenticated using (public.is_chat_member(chat_id));
create policy "members send messages" on public.messages for insert to authenticated with check (author = auth.uid() and public.is_chat_member(chat_id));
create policy "delete own message" on public.messages for delete to authenticated using (author = auth.uid());

-- safety
create policy "report as self" on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
create policy "admins triage reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- waitlist: anyone can join, nobody but admins can read
create policy "anyone joins waitlist" on public.waitlist for insert to anon, authenticated with check (true);
create policy "admins read waitlist" on public.waitlist for select to authenticated using (public.is_admin());

-- ===== supabase/migrations/20261103000003_functions.sql =====
-- Derived data and the operations that need more than one write.

-- ---------------------------------------------------------------
-- Feed: posts with author and engagement counts, plus a hot score
-- ---------------------------------------------------------------
create or replace view public.post_feed with (security_invoker = true) as
select p.*,
  pr.handle as author_handle, pr.name as author_name, pr.color as author_color, pr.cc as author_cc,
  coalesce(r.likes,0) as likes, coalesce(r.laughs,0) as laughs,
  coalesce(c.n,0) as comment_count,
  coalesce(v.agree,0) as agree, coalesce(v.disagree,0) as disagree,
  (1 + coalesce(r.likes,0) + coalesce(r.laughs,0)*1.4 + coalesce(c.n,0)*3 + (coalesce(v.agree,0)+coalesce(v.disagree,0))*0.4)
    / power(extract(epoch from (now() - p.created_at))/3600 + 2, 1.3) as hot
from public.posts p
join public.profiles pr on pr.id = p.author
left join (select target_id, count(*) filter (where kind='like') likes, count(*) filter (where kind='laugh') laughs
           from public.reactions where target_type='post' group by target_id) r on r.target_id = p.id
left join (select post_id, count(*) n from public.comments where post_id is not null group by post_id) c on c.post_id = p.id
left join (select post_id, count(*) filter (where value='agree') agree, count(*) filter (where value='disagree') disagree
           from public.votes group by post_id) v on v.post_id = p.id;

create or replace view public.comment_feed with (security_invoker = true) as
select c.*, pr.handle as author_handle, pr.name as author_name, pr.color as author_color,
  coalesce((select count(*) from public.reactions x where x.target_type='comment' and x.target_id=c.id and x.kind='like'),0) as likes
from public.comments c join public.profiles pr on pr.id = c.author;

-- ---------------------------------------------------------------
-- Ratings: each person's latest rating per item
-- ---------------------------------------------------------------
create or replace view public.item_ratings with (security_invoker = true) as
with latest as (
  select distinct on (user_id, item_id) user_id, item_id, rating
  from public.logs where rating is not null
  order by user_id, item_id, listened_at desc
)
select item_id, round(avg(rating)::numeric/2, 2) as avg_stars, count(*)::int as n,
  array[count(*) filter (where rating=1), count(*) filter (where rating=2), count(*) filter (where rating=3), count(*) filter (where rating=4), count(*) filter (where rating=5),
        count(*) filter (where rating=6), count(*) filter (where rating=7), count(*) filter (where rating=8), count(*) filter (where rating=9), count(*) filter (where rating=10)]::int[] as histogram
from latest group by item_id;

-- ---------------------------------------------------------------
-- Ear score: Brier skill on resolved forecasts.
-- skill = 1 - mean((p - outcome)^2) / 0.25 ; ear = clamp(50 + 50*skill, 0, 100)
-- ---------------------------------------------------------------
create or replace view public.ear_scores with (security_invoker = true) as
select fp.user_id,
  count(*)::int as resolved,
  round(avg(power(fp.p/100.0 - (case when r.outcome='yes' then 1 else 0 end), 2))::numeric, 4) as brier,
  round((1 - avg(power(fp.p/100.0 - (case when r.outcome='yes' then 1 else 0 end), 2)) / 0.25)::numeric, 4) as skill,
  greatest(0, least(100, round(50 + 50 * (1 - avg(power(fp.p/100.0 - (case when r.outcome='yes' then 1 else 0 end), 2)) / 0.25))))::int as ear
from public.forecast_predictions fp
join public.forecast_resolutions r on r.forecast_id = fp.forecast_id
group by fp.user_id;

-- Crowd forecast: mean probability weighted by 1 + 2*max(0, skill)
create or replace view public.forecast_consensus with (security_invoker = true) as
select f.id as forecast_id,
  case when count(fp.p) = 0 then null
       else round(sum(fp.p * (1 + 2*greatest(0, coalesce(e.skill,0)))) / sum(1 + 2*greatest(0, coalesce(e.skill,0))))::int end as crowd_p,
  count(fp.p)::int as forecasters,
  array[count(*) filter (where fp.p < 10), count(*) filter (where fp.p >= 10 and fp.p < 20), count(*) filter (where fp.p >= 20 and fp.p < 30),
        count(*) filter (where fp.p >= 30 and fp.p < 40), count(*) filter (where fp.p >= 40 and fp.p < 50), count(*) filter (where fp.p >= 50 and fp.p < 60),
        count(*) filter (where fp.p >= 60 and fp.p < 70), count(*) filter (where fp.p >= 70 and fp.p < 80), count(*) filter (where fp.p >= 80 and fp.p < 90),
        count(*) filter (where fp.p >= 90)]::int[] as distribution,
  r.outcome, r.resolved_at
from public.forecasts f
left join public.forecast_predictions fp on fp.forecast_id = f.id
left join public.ear_scores e on e.user_id = fp.user_id
left join public.forecast_resolutions r on r.forecast_id = f.id
group by f.id, r.outcome, r.resolved_at;

-- ---------------------------------------------------------------
-- Breakout Radar: rising listening per artist (or show), weighted by Ear skill
-- ---------------------------------------------------------------
create or replace function public.breakout_radar(window_days int default 7, max_rows int default 10)
returns table (subject_id text, subject_type text, recent numeric, baseline numeric, listeners int, score numeric)
language sql stable set search_path = public as $$
  with l as (
    select coalesce(ci.artist_id, ci.show_id, ci.id) as subject_id,
           case when ci.artist_id is not null then 'artist' else 'item' end as subject_type,
           g.user_id, g.listened_at,
           1 + 2*greatest(0, coalesce(e.skill,0)) as w
    from public.logs g
    join public.catalog_items ci on ci.id = g.item_id
    left join public.ear_scores e on e.user_id = g.user_id
    where g.listened_at > now() - make_interval(days => window_days*4)
  )
  select subject_id, subject_type,
    sum(w) filter (where listened_at > now() - make_interval(days => window_days)) as recent,
    coalesce(sum(w) filter (where listened_at <= now() - make_interval(days => window_days)), 0) / 3 as baseline,
    count(distinct user_id) filter (where listened_at > now() - make_interval(days => window_days))::int as listeners,
    coalesce(sum(w) filter (where listened_at > now() - make_interval(days => window_days)),0)
      - coalesce(sum(w) filter (where listened_at <= now() - make_interval(days => window_days)), 0) / 3 as score
  from l group by subject_id, subject_type
  having sum(w) filter (where listened_at > now() - make_interval(days => window_days)) > 0
  order by score desc limit max_rows
$$;

-- ---------------------------------------------------------------
-- Profile stats
-- ---------------------------------------------------------------
create or replace view public.profile_stats with (security_invoker = true) as
select p.id,
  (select count(*) from public.follows f where f.kind='user' and f.target = p.id::text)::int as followers,
  (select count(*) from public.follows f where f.kind='user' and f.follower = p.id)::int as following,
  (select count(*) from public.logs g where g.user_id = p.id)::int as logged,
  (select count(*) from public.posts x where x.author = p.id)::int as posts,
  (select ear from public.ear_scores e where e.user_id = p.id) as ear
from public.profiles p;

create or replace view public.follow_counts with (security_invoker = true) as
select kind, target, count(*)::int as n from public.follows group by kind, target;

-- ---------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------
create or replace function public.handle_available(h text) returns boolean
language sql stable security definer set search_path = public as $$
  select h ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where handle = h::citext and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid))
$$;

create or replace function public.edit_wiki(p_key text, p_body text) returns int
language plpgsql security definer set search_path = public as $$
declare v_rev int; v_kind text := split_part(p_key, ':', 1); v_id text := split_part(p_key, ':', 2);
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Sign in to edit the wiki';
  end if;
  if char_length(trim(p_body)) < 20 then raise exception 'A wiki needs at least a sentence or two'; end if;
  if v_kind = 'a' and not exists (select 1 from public.catalog_items where id = v_id)
     or v_kind = 'r' and not exists (select 1 from public.artists where id = v_id)
     or v_kind = 'g' and not exists (select 1 from public.genres where id = v_id) then
    raise exception 'Unknown wiki page';
  end if;
  insert into public.wiki_pages as w (key, body, rev, updated_by, updated_at)
  values (p_key, trim(p_body), 1, auth.uid(), now())
  on conflict (key) do update set body = excluded.body, rev = w.rev + 1, updated_by = excluded.updated_by, updated_at = now()
  returning rev into v_rev;
  insert into public.wiki_revisions (key, body, rev, edited_by) values (p_key, trim(p_body), v_rev, auth.uid());
  return v_rev;
end $$;

create or replace function public.create_chat(p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to start a chat'; end if;
  if coalesce(cardinality(p_members),0) = 0 then raise exception 'Pick at least one person'; end if;
  if cardinality(p_members) > 50 then raise exception 'Groups hold up to 51 people'; end if;
  insert into public.chats (name, created_by) values (coalesce(left(p_name,50),''), auth.uid()) returning id into v_id;
  insert into public.chat_members (chat_id, user_id) values (v_id, auth.uid());
  foreach m in array p_members loop
    if m <> auth.uid() and exists (select 1 from public.profiles where id = m)
       and not exists (select 1 from public.blocks b where b.blocker = m and b.blocked = auth.uid()) then
      insert into public.chat_members (chat_id, user_id) values (v_id, m) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;

create or replace function public.open_dm(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to send messages'; end if;
  if p_user = auth.uid() then raise exception 'That is you'; end if;
  if exists (select 1 from public.blocks b where b.blocker = p_user and b.blocked = auth.uid()) then
    raise exception 'You can''t message this person';
  end if;
  select c.id into v_id from public.chats c
  where (select count(*) from public.chat_members x where x.chat_id = c.id) = 2
    and exists (select 1 from public.chat_members x where x.chat_id = c.id and x.user_id = auth.uid())
    and exists (select 1 from public.chat_members x where x.chat_id = c.id and x.user_id = p_user)
    and c.name = ''
  limit 1;
  if v_id is null then v_id := public.create_chat('', array[p_user]); end if;
  return v_id;
end $$;

-- App Store guideline 5.1.1(v): people can delete their account from inside the app.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
revoke all on function public.edit_wiki(text,text) from public, anon;
grant execute on function public.edit_wiki(text,text) to authenticated;
revoke all on function public.create_chat(text,uuid[]) from public, anon;
grant execute on function public.create_chat(text,uuid[]) to authenticated;
revoke all on function public.open_dm(uuid) from public, anon;
grant execute on function public.open_dm(uuid) to authenticated;
grant execute on function public.handle_available(text) to anon, authenticated;
grant execute on function public.breakout_radar(int,int) to anon, authenticated;
grant select on public.post_feed, public.comment_feed, public.item_ratings, public.ear_scores, public.forecast_consensus, public.profile_stats, public.follow_counts to anon, authenticated;

-- Live updates for chats and conversations (Supabase Realtime)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.chats, public.comments, public.posts;
  end if;
end $$;

-- ===== supabase/migrations/20261104000001_apple_catalog.sql =====
-- Apple catalog import: real artwork, any album or podcast, artists created on demand.
-- Album art and podcast art come from Apple's public Search API and are shown with a link back to
-- Apple Music / Apple Podcasts, as Apple's promotional terms require.

alter table public.artists
  add column if not exists apple_id bigint unique,
  add column if not exists artwork_url text,
  add column if not exists source text not null default 'seed' check (source in ('seed','apple')),
  add column if not exists created_at timestamptz not null default now();
alter table public.artists alter column cc set default 'US';

alter table public.catalog_items
  add column if not exists apple_id bigint unique,
  add column if not exists artwork_url text,
  add column if not exists apple_url text,
  add column if not exists release_date date,
  add column if not exists track_count int;
alter table public.catalog_items drop constraint if exists catalog_items_source_check;
alter table public.catalog_items add constraint catalog_items_source_check check (source in ('seed','user','apple'));

create index if not exists artists_name on public.artists using gin (to_tsvector('simple', name));

-- Map Apple's genre names onto Melo's genres. Unknown genres stay null.
create or replace function public.melo_genre(apple_genre text)
returns text language sql immutable as $$
  select case
    when apple_genre is null then null
    when apple_genre ~* 'hip-hop|rap' then 'hiphop'
    when apple_genre ~* 'r&b|soul' then 'rnb'
    when apple_genre ~* 'afro' then 'afro'
    when apple_genre ~* 'latin|reggaeton|urbano|salsa|bachata' then 'latin'
    when apple_genre ~* 'j-pop|city pop' then 'citypop'
    when apple_genre ~* 'brazil|mpb|bossa|samba' then 'brazil'
    when apple_genre ~* 'alternative|indie' then 'indie'
    when apple_genre ~* 'rock|metal|punk' then 'rock'
    when apple_genre ~* 'electronic|dance|house|techno' then 'electronic'
    when apple_genre ~* 'jazz' then 'jazz'
    when apple_genre ~* 'pop|k-pop' then 'pop'
    when apple_genre ~* 'world|african' then 'afro'
    else null
  end
$$;

/*
  import_apple: add an album, podcast or podcast episode from Apple's catalog, or return the existing row.
  Ids are derived from Apple ids so the same album always lands on the same Melo page:
    album am<collectionId> · artist ar<artistId> · podcast pc<collectionId> · episode ep<trackId>
  Input (jsonb): kind ('album'|'show'|'episode'), apple_id, title, artist, artist_apple_id, artwork, url,
                 release_date, genre, track_count, dur_min, show_apple_id, show_title, show_artwork, show_url
*/
create or replace function public.import_apple(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  k text := p->>'kind';
  aid bigint := (p->>'apple_id')::bigint;
  item_id text;
  artist_row_id text;
  show_row_id text;
  art text := nullif(p->>'artwork', '');
  url text := nullif(p->>'url', '');
  rel date := nullif(left(p->>'release_date', 10), '')::date;
  -- Apple reports the store's country, not where the artist is from, so imports carry no country.
  cc text := '';
begin
  if auth.uid() is null then raise exception 'sign in to add to Melo' using errcode = '28000'; end if;
  if k not in ('album','show','episode') then raise exception 'unknown kind %', k; end if;
  if aid is null or aid <= 0 then raise exception 'missing Apple id'; end if;
  if coalesce(char_length(p->>'title'), 0) not between 1 and 200 then raise exception 'bad title'; end if;
  -- Only accept Apple's own image and store hosts.
  if art is not null and art !~ '^https://is[0-9]+-ssl\.mzstatic\.com/' then art := null; end if;
  if url is not null and url !~ '^https://(music|podcasts|itunes)\.apple\.com/' then url := null; end if;

  item_id := case k when 'album' then 'am' when 'show' then 'pc' else 'ep' end || aid;
  if exists (select 1 from catalog_items where id = item_id) then return item_id; end if;
  select id into item_id from catalog_items where apple_id = aid;
  if found then return item_id; end if;
  item_id := case k when 'album' then 'am' when 'show' then 'pc' else 'ep' end || aid;

  if k = 'album' and (p->>'artist_apple_id') is not null then
    -- Reuse the artist Melo already has (by Apple id, then by name) before creating a new one.
    select id into artist_row_id from artists where apple_id = (p->>'artist_apple_id')::bigint;
    if artist_row_id is null then
      select id into artist_row_id from artists where lower(name) = lower(p->>'artist') and apple_id is null order by source desc limit 1;
      if artist_row_id is not null then
        update artists set apple_id = (p->>'artist_apple_id')::bigint, artwork_url = coalesce(artwork_url, art) where id = artist_row_id;
      else
        artist_row_id := 'ar' || (p->>'artist_apple_id')::bigint;
        insert into artists (id, name, cc, genres, apple_id, artwork_url, source)
        values (artist_row_id, left(p->>'artist', 200), cc,
                coalesce(array_remove(array[melo_genre(p->>'genre')], null), '{}'),
                (p->>'artist_apple_id')::bigint, art, 'apple');
      end if;
    end if;
  end if;

  -- An album or podcast Melo already has without Apple data (seeded or added by hand) gets Apple's art and link.
  if k in ('album','show') then
    select id into show_row_id from catalog_items c
     where c.type = k and c.apple_id is null and lower(c.title) = lower(p->>'title')
       and (k = 'show' or c.artist_id = artist_row_id or lower(c.artist_name) = lower(p->>'artist'))
     limit 1;
    if show_row_id is not null then
      update catalog_items set apple_id = aid, artwork_url = coalesce(artwork_url, art), apple_url = coalesce(apple_url, url),
             release_date = coalesce(release_date, rel), track_count = coalesce(track_count, nullif(p->>'track_count', '')::int),
             artist_id = coalesce(artist_id, artist_row_id)
       where id = show_row_id;
      return show_row_id;
    end if;
    show_row_id := null;
  end if;

  if k = 'episode' then
    if (p->>'show_apple_id') is null then raise exception 'episode needs its podcast'; end if;
    select id into show_row_id from catalog_items where type = 'show' and apple_id = (p->>'show_apple_id')::bigint;
    if show_row_id is null then
      select id into show_row_id from catalog_items where type = 'show' and apple_id is null and lower(title) = lower(coalesce(p->>'show_title', '')) limit 1;
      if show_row_id is not null then
        update catalog_items set apple_id = (p->>'show_apple_id')::bigint where id = show_row_id;
      end if;
    end if;
    show_row_id := coalesce(show_row_id, 'pc' || (p->>'show_apple_id')::bigint);
    insert into catalog_items (id, type, title, artist_name, cc, genre, source, added_by, apple_id, artwork_url, apple_url)
    values (show_row_id, 'show', left(coalesce(p->>'show_title', p->>'artist'), 200), left(coalesce(p->>'artist', ''), 200), cc, 'podcasts', 'apple', auth.uid(),
            (p->>'show_apple_id')::bigint,
            case when coalesce(p->>'show_artwork', p->>'artwork') ~ '^https://is[0-9]+-ssl\.mzstatic\.com/' then coalesce(p->>'show_artwork', p->>'artwork') end,
            case when p->>'show_url' ~ '^https://(podcasts|itunes)\.apple\.com/' then p->>'show_url' end)
    on conflict do nothing;
  end if;

  insert into catalog_items (id, type, title, artist_id, artist_name, show_id, year, cc, genre, dur_min, source, added_by,
                             apple_id, artwork_url, apple_url, release_date, track_count)
  values (item_id, k, left(p->>'title', 200), artist_row_id, left(coalesce(p->>'artist', ''), 200), show_row_id,
          case when extract(year from rel) between 1900 and 2100 then extract(year from rel)::int end,
          cc, case when k = 'album' then melo_genre(p->>'genre') else 'podcasts' end,
          case when (p->>'dur_min')::int between 1 and 1000 then (p->>'dur_min')::int end,
          'apple', auth.uid(), aid, art, url, rel, nullif(p->>'track_count', '')::int)
  on conflict do nothing;
  return item_id;
end $$;

revoke all on function public.import_apple(jsonb) from public;
grant execute on function public.import_apple(jsonb) to authenticated;
grant execute on function public.melo_genre(text) to anon, authenticated;

-- ===== supabase/seed.sql =====
-- Generated by scripts/gen-seed.mjs. Do not edit by hand.
insert into public.genres (id,name) values
('hiphop','Hip-hop'),
('rnb','R&B'),
('pop','Pop'),
('afro','Afrobeat & Afrobeats'),
('latin','Latin'),
('rock','Rock & Alternative'),
('electronic','Electronic'),
('citypop','City Pop'),
('brazil','Brazilian'),
('mbalax','Mbalax'),
('indie','Indie'),
('jazz','Jazz & Beyond'),
('podcasts','Music Podcasts')
on conflict (id) do update set name=excluded.name;

insert into public.artists (id,name,cc,genres) values
('kendrick','Kendrick Lamar','US',array['hiphop']::text[]),
('charli','Charli xcx','GB',array['pop','electronic']::text[]),
('frank','Frank Ocean','US',array['rnb']::text[]),
('madvillain','Madvillain','US',array['hiphop']::text[]),
('fela','Fela Kuti','NG',array['afro']::text[]),
('badbunny','Bad Bunny','PR',array['latin']::text[]),
('radiohead','Radiohead','GB',array['rock','electronic']::text[]),
('mariya','Mariya Takeuchi','JP',array['citypop']::text[]),
('sza','SZA','US',array['rnb']::text[]),
('tems','Tems','NG',array['afro','rnb']::text[]),
('rosalia','Rosalía','ES',array['pop','latin']::text[]),
('burna','Burna Boy','NG',array['afro']::text[]),
('youssou','Youssou N''Dour','SN',array['mbalax']::text[]),
('hyukoh','HYUKOH','KR',array['indie','rock']::text[]),
('beyonce','Beyoncé','US',array['rnb','pop']::text[]),
('fleetwood','Fleetwood Mac','GB',array['rock']::text[]),
('daftpunk','Daft Punk','FR',array['electronic']::text[]),
('jorgeben','Jorge Ben Jor','BR',array['brazil']::text[]),
('tyler','Tyler, the Creator','US',array['hiphop']::text[]),
('lauryn','Lauryn Hill','US',array['hiphop','rnb']::text[]),
('arooj','Arooj Aftab','PK',array['jazz']::text[]),
('amy','Amy Winehouse','GB',array['rnb','jazz']::text[]),
('davido','Davido','NG',array['afro']::text[]),
('karolg','Karol G','CO',array['latin']::text[])
on conflict (id) do update set name=excluded.name, cc=excluded.cc, genres=excluded.genres;

insert into public.catalog_items (id,type,title,artist_id,artist_name,year,cc,genre,source) values
('gnx','album','GNX','kendrick','Kendrick Lamar',2024,'US','hiphop','seed'),
('tpab','album','To Pimp a Butterfly','kendrick','Kendrick Lamar',2015,'US','hiphop','seed'),
('damn','album','DAMN.','kendrick','Kendrick Lamar',2017,'US','hiphop','seed'),
('brat','album','BRAT','charli','Charli xcx',2024,'GB','pop','seed'),
('blonde','album','Blonde','frank','Frank Ocean',2016,'US','rnb','seed'),
('orange','album','channel ORANGE','frank','Frank Ocean',2012,'US','rnb','seed'),
('madvillainy','album','Madvillainy','madvillain','Madvillain',2004,'US','hiphop','seed'),
('zombie','album','Zombie','fela','Fela Kuti',1976,'NG','afro','seed'),
('uvst','album','Un Verano Sin Ti','badbunny','Bad Bunny',2022,'PR','latin','seed'),
('dtmf','album','Debí Tirar Más Fotos','badbunny','Bad Bunny',2025,'PR','latin','seed'),
('okc','album','OK Computer','radiohead','Radiohead',1997,'GB','rock','seed'),
('kida','album','Kid A','radiohead','Radiohead',2000,'GB','rock','seed'),
('inrainbows','album','In Rainbows','radiohead','Radiohead',2007,'GB','rock','seed'),
('variety','album','Variety','mariya','Mariya Takeuchi',1984,'JP','citypop','seed'),
('ctrl','album','Ctrl','sza','SZA',2017,'US','rnb','seed'),
('sos','album','SOS','sza','SZA',2022,'US','rnb','seed'),
('bitw','album','Born in the Wild','tems','Tems',2024,'NG','afro','seed'),
('elmal','album','El Mal Querer','rosalia','Rosalía',2018,'ES','pop','seed'),
('motomami','album','MOTOMAMI','rosalia','Rosalía',2022,'ES','pop','seed'),
('giant','album','African Giant','burna','Burna Boy',2019,'NG','afro','seed'),
('tall','album','Twice as Tall','burna','Burna Boy',2020,'NG','afro','seed'),
('immigres','album','Immigrés','youssou','Youssou N''Dour',1984,'SN','mbalax','seed'),
('h23','album','23','hyukoh','HYUKOH',2017,'KR','indie','seed'),
('lemonade','album','Lemonade','beyonce','Beyoncé',2016,'US','rnb','seed'),
('renaissance','album','Renaissance','beyonce','Beyoncé',2022,'US','pop','seed'),
('rumours','album','Rumours','fleetwood','Fleetwood Mac',1977,'GB','rock','seed'),
('discovery','album','Discovery','daftpunk','Daft Punk',2001,'FR','electronic','seed'),
('ram','album','Random Access Memories','daftpunk','Daft Punk',2013,'FR','electronic','seed'),
('africabrasil','album','África Brasil','jorgeben','Jorge Ben Jor',1976,'BR','brazil','seed'),
('igor','album','IGOR','tyler','Tyler, the Creator',2019,'US','hiphop','seed'),
('miseducation','album','The Miseducation of Lauryn Hill','lauryn','Lauryn Hill',1998,'US','hiphop','seed'),
('vulture','album','Vulture Prince','arooj','Arooj Aftab',2021,'PK','jazz','seed'),
('b2b','album','Back to Black','amy','Amy Winehouse',2006,'GB','rnb','seed'),
('timeless','album','Timeless','davido','Davido',2023,'NG','afro','seed'),
('msb','album','Mañana Será Bonito','karolg','Karol G',2023,'CO','latin','seed'),
('songexploder','show','Song Exploder',null,'Hrishikesh Hirway',null,'US','podcasts','seed'),
('switchedonpop','show','Switched on Pop',null,'Nate Sloan & Charlie Harding',null,'US','podcasts','seed'),
('popcast','show','Popcast',null,'The New York Times',null,'US','podcasts','seed'),
('dissect','show','Dissect',null,'Cole Cuchna',null,'US','podcasts','seed'),
('brokenrecord','show','Broken Record',null,'Rick Rubin, Malcolm Gladwell & Bruce Headlam',null,'US','podcasts','seed')
on conflict (id) do update set title=excluded.title, artist_name=excluded.artist_name, year=excluded.year, genre=excluded.genre;

insert into public.wiki_pages (key,body,rev) values
('g:hiphop','Hip-hop grew out of block parties in the Bronx in the 1970s, built on DJs looping breaks and MCs rhyming over them. It is now the most-streamed genre in the United States and has local scenes on every continent.

Useful starting points on Melo: concept albums, regional sounds, and the producer-rapper duos that defined eras.',1),
('g:rnb','Rhythm and blues runs from 1940s jump blues through soul and funk to the alternative R&B of the 2010s. Modern R&B leans on mood, vocal texture and production as much as on the song.',1),
('g:pop','Pop is the music built to be heard by the most people at once. On Melo it also covers the club, hyperpop and art-pop records that pull the mainstream somewhere new.',1),
('g:afro','Two related sounds. Afrobeat (singular) is the 1970s fusion of highlife, jazz and funk led by Fela Kuti in Lagos, usually long, horn-heavy and political. Afrobeats (plural) is the broader West African pop that rose in the 2000s and 2010s and now fills stadiums worldwide.

Post which one you mean. People here care.',1),
('g:latin','Reggaetón, Latin trap, salsa, cumbia, bachata and Latin pop. Puerto Rico, Colombia and Mexico lead the streaming numbers, but the scene is wider than any one country.',1),
('g:rock','Guitar music in all its forms, plus the alternative records that walked away from guitars and kept the attitude.',1),
('g:electronic','House, techno, French touch, ambient and everything made mostly with machines. Club history and bedroom producers both belong here.',1),
('g:citypop','Polished Japanese pop from the late 1970s and 1980s, shaped by AOR, funk and jazz fusion and the optimism of the bubble economy. Online it found a second, global audience decades later.',1),
('g:brazil','Samba, bossa nova, Tropicália, MPB and baile funk. A country with more genres than most continents.',1),
('g:mbalax','Senegalese popular music built on sabar drumming and Wolof singing, made internationally famous by Youssou N''Dour and Super Étoile de Dakar.',1),
('g:indie','Records made outside the major-label system or in its spirit. On Melo this includes indie rock, bedroom pop and the Seoul, Tokyo and Lagos indie scenes.',1),
('g:jazz','Jazz and the music around it: spiritual jazz, fusion, ghazal-inflected records and anything where improvisation leads.',1),
('g:podcasts','Shows about music: interviews, song breakdowns, history and arguments. Episodes on Melo get timestamped comments, so you can talk about the exact minute.',1),
('r:kendrick','Rapper and songwriter from Compton, California. Known for dense, character-driven albums including good kid, m.A.A.d city (2012) and To Pimp a Butterfly (2015). DAMN. (2017) won the 2018 Pulitzer Prize for Music, a first for a non-classical, non-jazz work.',1),
('r:charli','English singer and songwriter whose work moves between mainstream pop and club and hyperpop production. BRAT (2024) became one of the most talked-about records of that year.',1),
('r:frank','Singer and songwriter raised in New Orleans. channel ORANGE (2012) and Blonde (2016) made him one of the most influential R&B artists of his generation, and his long gaps between releases are a topic of their own.',1),
('r:madvillain','The duo of rapper MF DOOM and producer Madlib. Their one album, Madvillainy (2004), is a touchstone for abstract hip-hop: short songs, dusty samples and endlessly quotable verses.',1),
('r:fela','Nigerian bandleader, multi-instrumentalist and activist who pioneered Afrobeat with his bands Africa 70 and later Egypt 80. His songs were long, hypnotic and openly critical of military rule, and he was repeatedly targeted by the Nigerian state.',1),
('r:badbunny','Puerto Rican rapper and singer who became one of the most-streamed artists in the world while recording almost entirely in Spanish. His records mix reggaetón and Latin trap with rock, dembow and traditional Puerto Rican styles.',1),
('r:radiohead','Band from Abingdon, Oxfordshire. After the guitar records The Bends (1995) and OK Computer (1997) they turned toward electronic textures with Kid A (2000) and kept experimenting with release formats, including the pay-what-you-want In Rainbows (2007).',1),
('r:mariya','Japanese singer-songwriter. Her 1984 song "Plastic Love," from the album Variety, became an online phenomenon in the late 2010s and helped carry city pop to a global audience.',1),
('r:sza','Singer and songwriter from New Jersey. Ctrl (2017) and SOS (2022) made her a defining voice in modern R&B, known for diaristic, conversational lyrics.',1),
('r:tems','Nigerian singer, songwriter and producer from Lagos. A run of standout features and singles made her a global name before her debut album, Born in the Wild (2024).',1),
('r:rosalia','Spanish singer from near Barcelona who trained in flamenco. El Mal Querer (2018) reworked flamenco through modern production; MOTOMAMI (2022) pulled in reggaetón, noise and minimal club sounds.',1),
('r:burna','Nigerian singer and songwriter from Port Harcourt who calls his sound Afro-fusion, mixing Afrobeats with dancehall, reggae and R&B. Twice as Tall (2020) won the Grammy for Best Global Music Album.',1),
('r:youssou','Senegalese singer, composer and bandleader, the best-known voice of mbalax. With Super Étoile de Dakar he took Senegalese music to international audiences from the 1980s onward.',1),
('r:hyukoh','Indie rock band from Seoul, fronted by Oh Hyuk. Their loose, guitar-led songs found an audience well beyond the Korean indie scene.',1),
('r:beyonce','Singer, songwriter and performer from Houston. Her visual album Lemonade (2016) and the Renaissance (2022) and Cowboy Carter (2024) projects each reframed a genre and its history.',1),
('r:fleetwood','British-American band formed in London in 1967, first as a blues group. The lineup with Lindsey Buckingham and Stevie Nicks made Rumours (1977), one of the best-selling albums ever recorded.',1),
('r:daftpunk','French electronic duo of Thomas Bangalter and Guy-Manuel de Homem-Christo, central to the French house sound. Known for their robot personas, Discovery (2001) and Random Access Memories (2013). They split in 2021.',1),
('r:jorgeben','Brazilian singer, guitarist and songwriter whose blend of samba, funk, soul and rock shaped Brazilian popular music. África Brasil (1976) is one of his most celebrated records.',1),
('r:tyler','Rapper, producer and designer from Los Angeles who rose with the Odd Future collective. IGOR (2019) and CHROMAKOPIA (2024) show how far he moved from his early shock-rap.',1),
('r:lauryn','Singer, rapper and songwriter from New Jersey, first known as a member of the Fugees. The Miseducation of Lauryn Hill (1998) is her only solo studio album and won Album of the Year at the Grammys.',1),
('r:arooj','Pakistani composer and singer based in New York. Her slow, luminous records draw on ghazal, jazz and minimalism. "Mohabbat," from Vulture Prince (2021), won a Grammy for Best Global Music Performance.',1),
('r:amy','English singer and songwriter from London whose retro-soul album Back to Black (2006) won five Grammys. She died in 2011 at 27.',1),
('r:davido','Nigerian-American singer and one of the leading figures of Afrobeats since the early 2010s. Timeless (2023) was one of his biggest releases.',1),
('r:karolg','Colombian singer from Medellín, one of the most-streamed women in Latin music. Mañana Será Bonito (2023) topped the Billboard 200.',1),
('a:gnx','Released without warning in November 2024.',1),
('a:tpab','Jazz, funk and spoken word around a story of fame, guilt and Black America.',1),
('a:damn','Winner of the 2018 Pulitzer Prize for Music.',1),
('a:brat','The club-pop record whose lime-green cover ran a whole summer.',1),
('a:blonde','Sparse, warm and still debated a decade later.',1),
('a:madvillainy','Twenty-two tracks in about 46 minutes.',1),
('a:zombie','A satire of military obedience set to a groove that will not quit.',1),
('a:dtmf','A love letter to Puerto Rico built on plena, salsa and bomba.',1),
('a:kida','Where the guitars went quiet and the arguments got loud.',1),
('a:inrainbows','First released online with a pay-what-you-want price.',1),
('a:variety','Home of "Plastic Love."',1),
('a:elmal','A concept album structured around a medieval Occitan novel.',1),
('a:tall','Grammy winner for Best Global Music Album.',1),
('a:immigres','A good door into mbalax.',1),
('a:lemonade','Released alongside a full-length film.',1),
('a:renaissance','A tribute to Black and queer dance music history.',1),
('a:ram','Won Album of the Year at the Grammys.',1),
('a:miseducation','Won Album of the Year at the Grammys.',1),
('a:songexploder','Artists take apart one of their songs, piece by piece.',1),
('a:switchedonpop','The musicology of pop hits, explained in plain language.',1),
('a:popcast','Weekly conversation about pop music news and ideas.',1),
('a:dissect','Long-form, song-by-song analysis of a single album per season.',1),
('a:brokenrecord','Long interviews with musicians about how they make what they make.',1)
on conflict (key) do nothing;

insert into public.forecasts (id,question,detail,closes_on,target_type,target_id,created_by) values
('wrapped2026','Will Spotify name a non-US artist its most-streamed artist worldwide in Wrapped 2026?','Resolves YES if Spotify''s official 2026 Wrapped announcement lists a non-US artist as the top global artist. Resolves NO if the top artist is from the US.','2026-12-01',null,null,null),
('hot100lang2027','Will a song mostly in a language other than English hit #1 on the Billboard Hot 100 during 2027?','Resolves YES if any Billboard Hot 100 chart dated in 2027 has a song sung mostly in a language other than English at #1.','2027-12-31','genre','latin',null),
('badbunny2027','Will Bad Bunny release a new studio album before July 1, 2027?','A full-length studio album under his own name, released on streaming services before July 1, 2027. EPs, singles and deluxe editions do not count.','2027-06-30','artist','badbunny',null),
('frank2027','Will Frank Ocean release a new studio album before the end of 2027?','A full-length studio album released on major streaming services by December 31, 2027.','2027-12-31','artist','frank',null),
('afrofest2027','Will an Afrobeats act headline a night at Coachella, Lollapalooza or Governors Ball in 2027?','Resolves YES if a Nigerian or Ghanaian Afrobeats artist is billed as a headliner for any single night of those festivals'' 2027 editions.','2027-08-31','genre','afro',null),
('kpop200','Will a K-pop act top the Billboard 200 at least once in 2027?','Resolves YES if any Billboard 200 chart dated in 2027 has a K-pop group or soloist at #1.','2027-12-31',null,null,null)
on conflict (id) do nothing;
