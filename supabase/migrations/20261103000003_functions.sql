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
