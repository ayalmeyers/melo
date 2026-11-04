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
