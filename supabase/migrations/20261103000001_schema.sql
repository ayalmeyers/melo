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
