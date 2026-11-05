-- Melo update, Nov 5 2026: real images, history import, charts, taste match and lists.
-- Paste all of this into Supabase → SQL Editor → New query, then Run. Run it once, after 2026-11-04.sql.

-- ===== supabase/migrations/20261105000001_images.sql =====
-- Real images: artist photos from Wikimedia Commons (free licenses, credited) and genre mosaics from album art.

alter table public.artists
  add column if not exists image_url text,
  add column if not exists image_credit text,
  add column if not exists image_source text,
  add column if not exists image_checked_at timestamptz;

/*
  set_artist_image: any signed-in person's app can fill in a missing artist photo after looking it up.
  Only Wikimedia hosts are accepted, an existing photo is never replaced (admins can), and a null url records
  "looked, found nothing" so apps don't keep searching for 30 days.
*/
create or replace function public.set_artist_image(p_id text, p_url text, p_credit text default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_url is not null and p_url !~ '^https://upload\.wikimedia\.org/' then raise exception 'Unsupported image host'; end if;
  if p_source is not null and p_source !~ '^https://commons\.wikimedia\.org/' then p_source := null; end if;
  update artists set
    image_url = case when p_url is null then image_url else p_url end,
    image_credit = case when p_url is null then image_credit else left(p_credit, 300) end,
    image_source = case when p_url is null then image_source else p_source end,
    image_checked_at = now()
  where id = p_id
    and (public.is_admin() or (image_url is null and (image_checked_at is null or image_checked_at < now() - interval '30 days')));
end $$;
revoke all on function public.set_artist_image(text, text, text, text) from public, anon;
grant execute on function public.set_artist_image(text, text, text, text) to authenticated;

-- Up to four album covers per genre, newest additions first, for genre mosaics.
create or replace view public.genre_art with (security_invoker = true) as
select genre, array_agg(artwork_url order by rn) as covers
  from (select genre, artwork_url, row_number() over (partition by genre order by (source = 'seed') desc, created_at) as rn
          from public.catalog_items
         where artwork_url is not null and genre is not null and type in ('album','show')) x
 where rn <= 4
 group by genre;
grant select on public.genre_art to anon, authenticated;

-- ===== supabase/migrations/20261105000002_history_charts.sql =====
-- Listening-history imports and the weekly charts.

-- ---------------------------------------------------------------
-- Imports: a log can come from Melo itself or from an imported Spotify / Apple Music history.
-- Imported logs fill diaries and taste, but never count toward charts or the Breakout Radar.
-- ---------------------------------------------------------------
alter table public.logs
  add column if not exists source text not null default 'melo' check (source in ('melo','spotify','apple')),
  add column if not exists plays int check (plays is null or plays between 1 and 1000000);
create unique index if not exists logs_one_import on public.logs(user_id, item_id, source) where source <> 'melo';

create or replace function public.clamp_listened_at() returns trigger language plpgsql as $$
begin
  if new.listened_at > now() + interval '1 hour' then new.listened_at := now(); end if;
  return new;
end $$;
drop trigger if exists clamp_listened_at on public.logs;
create trigger clamp_listened_at before insert or update on public.logs for each row execute function public.clamp_listened_at();

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
    where g.listened_at > now() - make_interval(days => window_days*4) and g.source = 'melo'
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
-- Charts: what's most listened to this week, on all of Melo or among the people you follow.
-- Ranked by distinct listeners, then average rating, then logs. Movement compares with the week before.
-- ---------------------------------------------------------------
create or replace function public.chart(p_scope text default 'public', p_kind text default 'albums', p_days int default 7, p_limit int default 50)
returns table (subject_id text, subject_type text, rank int, prev_rank int, listeners int, logs int, avg_rating numeric)
language sql stable set search_path = public as $$
  with circle as (
    select f.target::uuid as user_id from public.follows f where p_scope = 'friends' and f.kind = 'user' and f.follower = auth.uid()
    union select auth.uid() where p_scope = 'friends'
  ),
  l as (
    select case p_kind when 'artists' then ci.artist_id when 'podcasts' then coalesce(ci.show_id, ci.id) else ci.id end as subject_id,
           g.user_id, g.rating, g.listened_at,
           (g.listened_at > now() - make_interval(days => p_days)) as this_week
      from public.logs g
      join public.catalog_items ci on ci.id = g.item_id
     where g.source = 'melo'
       and g.listened_at > now() - make_interval(days => p_days * 2)
       and (p_scope = 'public' or g.user_id in (select user_id from circle))
       and case p_kind when 'albums' then ci.type = 'album' when 'artists' then ci.artist_id is not null else ci.type in ('episode','show') end
  ),
  cur as (
    select subject_id, count(distinct user_id)::int as listeners, count(*)::int as logs, round(avg(rating) / 2.0, 2) as avg_rating
      from l where this_week group by subject_id
  ),
  prev as (
    select subject_id, row_number() over (order by count(distinct user_id) desc, avg(rating) desc nulls last, count(*) desc)::int as r
      from l where not this_week group by subject_id
  ),
  ranked as (
    select c.*, row_number() over (order by c.listeners desc, c.avg_rating desc nulls last, c.logs desc, c.subject_id)::int as r from cur c
  )
  select r.subject_id, case p_kind when 'artists' then 'artist' else 'item' end, r.r, p.r, r.listeners, r.logs, r.avg_rating
    from ranked r left join prev p using (subject_id)
   where r.subject_id is not null
   order by r.r
   limit least(p_limit, 100)
$$;
grant execute on function public.chart(text, text, int, int) to anon, authenticated;

/* import_logs: adds imported history to the caller's diary. One row per album per source; importing again updates it.
   Input: [{ "item_id": "...", "plays": 12, "listened_at": "2025-03-01T..." }, ...] (at most 500). */
create or replace function public.import_logs(p_source text, p_rows jsonb)
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_source not in ('spotify','apple') then raise exception 'Unknown source %', p_source; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'Import at most 500 at a time'; end if;
  insert into logs (user_id, item_id, source, plays, listened_at)
  select auth.uid(), r.item_id, p_source, greatest(1, least(r.plays, 1000000)), coalesce(r.listened_at, now())
    from jsonb_to_recordset(p_rows) as r(item_id text, plays int, listened_at timestamptz)
   where exists (select 1 from catalog_items c where c.id = r.item_id)
  on conflict (user_id, item_id, source) where source <> 'melo'
  do update set plays = excluded.plays, listened_at = greatest(logs.listened_at, excluded.listened_at);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.import_logs(text, jsonb) from public, anon;
grant execute on function public.import_logs(text, jsonb) to authenticated;

-- ===== supabase/migrations/20261105000003_taste_lists.sql =====
-- Taste match between two people, "people who hear like you", and Letterboxd-style lists.

-- ---------------------------------------------------------------
-- Taste match
-- ---------------------------------------------------------------
/*
  Score 0–100 from three signals, each explainable on screen:
    artists you both listen to (Jaccard overlap, 40%),
    albums and episodes you both logged (Jaccard overlap, 30%),
    how close your ratings are on what you both rated (30%, trusted fully after 5 shared ratings).
  Square roots lift small overlaps, which are normal between two real people.
*/
create or replace function public.taste_match(p_a uuid, p_b uuid)
returns table (score int, shared_items int, shared_artists int, co_rated int, agreement numeric, top_shared text[], both_loved text[])
language sql stable set search_path = public as $$
  with la as (select distinct on (item_id) item_id, rating from logs where user_id = p_a order by item_id, (rating is null), listened_at desc),
       lb as (select distinct on (item_id) item_id, rating from logs where user_id = p_b order by item_id, (rating is null), listened_at desc),
       aa as (select distinct ci.artist_id from la join catalog_items ci on ci.id = la.item_id where ci.artist_id is not null),
       ab as (select distinct ci.artist_id from lb join catalog_items ci on ci.id = lb.item_id where ci.artist_id is not null),
       both_items as (select la.item_id, la.rating ra, lb.rating rb from la join lb using (item_id)),
       s as (
         select (select count(*) from both_items)::int as si,
                (select count(*) from (select item_id from la union select item_id from lb) u)::int as ui,
                (select count(*) from aa join ab using (artist_id))::int as sa,
                (select count(*) from (select artist_id from aa union select artist_id from ab) u)::int as ua,
                (select count(*) from both_items where ra is not null and rb is not null)::int as cr,
                (select avg(1 - abs(ra - rb) / 9.0) from both_items where ra is not null and rb is not null) as ag
       )
  select case when p_a = p_b then 100 when s.ui = 0 then 0 else
           round(100 * (0.4 * sqrt(coalesce(s.sa::numeric / nullif(s.ua, 0), 0))
                      + 0.3 * sqrt(coalesce(s.si::numeric / nullif(s.ui, 0), 0))
                      + 0.3 * (0.5 + (coalesce(s.ag, 0.5) - 0.5) * least(1, s.cr / 5.0))))::int end,
         s.si, s.sa, s.cr, round(s.ag, 2),
         (select array_agg(item_id order by coalesce(ra, 5) + coalesce(rb, 5) desc) from (select * from both_items order by coalesce(ra, 5) + coalesce(rb, 5) desc limit 6) t),
         (select array_agg(item_id) from (select item_id from both_items where ra >= 8 and rb >= 8 order by ra + rb desc limit 6) t)
    from s
$$;
grant execute on function public.taste_match(uuid, uuid) to anon, authenticated;

/* People whose taste is closest to yours: anyone sharing at least two albums or artists, scored, best first. Blocked people never appear. */
create or replace function public.similar_listeners(p_limit int default 20)
returns table (user_id uuid, score int, shared_items int, shared_artists int)
language sql stable set search_path = public as $$
  with mine as (select distinct l.item_id, ci.artist_id from logs l join catalog_items ci on ci.id = l.item_id where l.user_id = auth.uid()),
  cand as (
    select l.user_id, count(distinct l.item_id) filter (where l.item_id in (select item_id from mine))
                   + count(distinct ci.artist_id) filter (where ci.artist_id in (select artist_id from mine)) as overlap
      from logs l join catalog_items ci on ci.id = l.item_id
     where l.user_id <> auth.uid()
       and (l.item_id in (select item_id from mine) or ci.artist_id in (select artist_id from mine where artist_id is not null))
       and not exists (select 1 from blocks b where (b.blocker = auth.uid() and b.blocked = l.user_id) or (b.blocker = l.user_id and b.blocked = auth.uid()))
       and exists (select 1 from profiles p where p.id = l.user_id and p.banned_at is null)
     group by l.user_id
    having count(distinct l.item_id) filter (where l.item_id in (select item_id from mine))
         + count(distinct ci.artist_id) filter (where ci.artist_id in (select artist_id from mine)) >= 2
     order by 2 desc limit 200
  )
  select c.user_id, t.score, t.shared_items, t.shared_artists
    from cand c cross join lateral public.taste_match(auth.uid(), c.user_id) t
   where auth.uid() is not null
   order by t.score desc, t.shared_items desc
   limit least(p_limit, 50)
$$;
grant execute on function public.similar_listeners(int) to authenticated;

-- ---------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  ranked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_owner on public.lists(owner, updated_at desc);

create table if not exists public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  item_id text not null references public.catalog_items(id) on delete cascade,
  position int not null default 0,
  note text not null default '' check (char_length(note) <= 280),
  added_at timestamptz not null default now(),
  primary key (list_id, item_id)
);
create index if not exists list_items_item on public.list_items(item_id);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;
drop policy if exists "lists readable" on public.lists;
create policy "lists readable" on public.lists for select using (true);
drop policy if exists "make own lists" on public.lists;
create policy "make own lists" on public.lists for insert to authenticated with check (owner = auth.uid());
drop policy if exists "edit own lists" on public.lists;
create policy "edit own lists" on public.lists for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "delete own lists" on public.lists;
create policy "delete own lists" on public.lists for delete to authenticated using (owner = auth.uid() or public.is_admin());
drop policy if exists "list items readable" on public.list_items;
create policy "list items readable" on public.list_items for select using (true);
drop policy if exists "fill own lists" on public.list_items;
create policy "fill own lists" on public.list_items for insert to authenticated with check (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()));
drop policy if exists "edit own list items" on public.list_items;
create policy "edit own list items" on public.list_items for update to authenticated using (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()));
drop policy if exists "remove own list items" on public.list_items;
create policy "remove own list items" on public.list_items for delete to authenticated using (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()) or public.is_admin());
grant select on public.lists, public.list_items to anon, authenticated;
grant insert, update, delete on public.lists, public.list_items to authenticated;

-- New items go to the end, lists cap at 250, and editing a list bumps it to the top of its owner's lists.
create or replace function public.list_item_defaults() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from list_items where list_id = new.list_id) >= 250 then raise exception 'A list can hold 250 items'; end if;
    new.position := coalesce((select max(position) + 1 from list_items where list_id = new.list_id), 0);
  end if;
  update lists set updated_at = now() where id = new.list_id;
  return new;
end $$;
drop trigger if exists list_item_defaults on public.list_items;
create trigger list_item_defaults before insert or update on public.list_items for each row execute function public.list_item_defaults();

do $$ begin
  drop trigger if exists block_banned on public.lists;
  create trigger block_banned before insert on public.lists for each row execute function public.block_banned();
  drop trigger if exists block_banned on public.list_items;
  create trigger block_banned before insert on public.list_items for each row execute function public.block_banned();
end $$;

/* Reorders a list in one call: p_items is the full new order. */
create or replace function public.reorder_list(p_list uuid, p_items text[])
returns void language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from lists where id = p_list and owner = auth.uid()) then raise exception 'Not your list' using errcode = '42501'; end if;
  update list_items li set position = o.ord - 1
    from unnest(p_items) with ordinality as o(item_id, ord)
   where li.list_id = p_list and li.item_id = o.item_id;
end $$;
grant execute on function public.reorder_list(uuid, text[]) to authenticated;

-- List cards: owner, size and the first four covers, for grids of lists.
create or replace view public.list_cards with (security_invoker = true) as
select l.*, p.handle as owner_handle, p.name as owner_name, p.color as owner_color,
       (select count(*) from list_items li where li.list_id = l.id)::int as item_count,
       (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'type', c.type, 'artwork_url', c.artwork_url) order by li.position), '[]'::jsonb)
          from (select * from list_items where list_id = l.id order by position limit 4) li join catalog_items c on c.id = li.item_id) as preview
  from lists l join profiles p on p.id = l.owner;
grant select on public.list_cards to anon, authenticated;
