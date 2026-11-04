-- Melo update, Nov 4 2026: Apple catalog + notifications and moderation.
-- Paste all of this into Supabase → SQL Editor → New query, then Run. Run it once.

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

-- ===== supabase/migrations/20261104000002_moderation_notifications.sql =====
-- Moderation queue, bans, notifications and push tokens.

-- ---------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------
alter table public.reports
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;
create index if not exists reports_open on public.reports(status, created_at) where status = 'open';

alter table public.profiles add column if not exists banned_at timestamptz;
-- banned_at is set only by moderate(); people cannot update it (column grants in the security migration stay as they are).

create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select banned_at is not null from public.profiles where id = uid), false)
$$;

-- Banned accounts can still read and delete their account, but can't post anything new.
create or replace function public.block_banned() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_banned(auth.uid()) then raise exception 'This account has been suspended for breaking the community guidelines.' using errcode = '42501'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['posts','comments','messages','moments','forecasts','forecast_predictions','reactions','votes','chats','logs'] loop
    execute format('drop trigger if exists block_banned on public.%I', t);
    execute format('create trigger block_banned before insert on public.%I for each row execute function public.block_banned()', t);
  end loop;
end $$;

/* The admin queue: each open report with the reported content and its author, so a moderator can decide in one look. */
create or replace function public.report_queue(p_status text default 'open', p_limit int default 100)
returns table (id uuid, target_type text, target_id text, reason text, status text, created_at timestamptz,
               reporter_handle text, author_id uuid, author_handle text, author_banned boolean, content text, link text, reports_on_target bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
         rp.handle::text,
         a.author, ap.handle::text, ap.banned_at is not null, a.content, a.link,
         (select count(*) from reports r2 where r2.target_type = r.target_type and r2.target_id = r.target_id)
    from reports r
    left join profiles rp on rp.id = r.reporter
    left join lateral (
      select p.author, coalesce(p.title || ': ', '') || p.body as content, '/p/' || p.id as link from posts p where r.target_type = 'post' and p.id::text = r.target_id
      union all select c.author, c.body, coalesce('/p/' || c.post_id, '/forecasts/' || c.forecast_id) from comments c where r.target_type = 'comment' and c.id::text = r.target_id
      union all select m.author, coalesce(m.body, '[shared ' || m.share_type || ']'), null from messages m where r.target_type = 'message' and m.id::text = r.target_id
      union all select mo.author, mo.body, '/album/' || mo.item_id from moments mo where r.target_type = 'moment' and mo.id::text = r.target_id
      union all select pr.id, pr.name || ' · ' || pr.bio, '/u/' || pr.handle from profiles pr where r.target_type = 'profile' and pr.id::text = r.target_id
    ) a on true
    left join profiles ap on ap.id = a.author
   where r.status = p_status
   order by r.created_at
   limit p_limit;
end $$;

/*
  moderate: act on a report. Every open report on the same target closes with it.
    'remove'  deletes the reported content (a profile report removes nothing; use 'ban')
    'ban'     removes the content and suspends the author
    'dismiss' closes the report with no action
*/
create or replace function public.moderate(p_report uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r reports; v_author uuid;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_action not in ('remove','ban','dismiss','unban') then raise exception 'Unknown action %', p_action; end if;
  select * into r from reports where id = p_report;
  if not found then raise exception 'Report not found'; end if;

  select author into v_author from (
    select author from posts where r.target_type = 'post' and id::text = r.target_id
    union all select author from comments where r.target_type = 'comment' and id::text = r.target_id
    union all select author from messages where r.target_type = 'message' and id::text = r.target_id
    union all select author from moments where r.target_type = 'moment' and id::text = r.target_id
    union all select id from profiles where r.target_type = 'profile' and id::text = r.target_id) x limit 1;

  if p_action in ('remove','ban') then
    if r.target_type = 'post' then delete from posts where id::text = r.target_id;
    elsif r.target_type = 'comment' then delete from comments where id::text = r.target_id;
    elsif r.target_type = 'message' then delete from messages where id::text = r.target_id;
    elsif r.target_type = 'moment' then delete from moments where id::text = r.target_id;
    end if;
  end if;
  if p_action = 'ban' and v_author is not null then
    if public.is_admin(v_author) then raise exception 'Admins cannot be banned here'; end if;
    update profiles set banned_at = now() where id = v_author;
  end if;
  if p_action = 'unban' and v_author is not null then update profiles set banned_at = null where id = v_author; end if;

  update reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end, resolved_by = auth.uid(), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';
end $$;

revoke all on function public.report_queue(text, int) from public, anon;
revoke all on function public.moderate(uuid, text) from public, anon;
grant execute on function public.report_queue(text, int) to authenticated;
grant execute on function public.moderate(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('comment','reply','follow','like','laugh','resolved','message')),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  forecast_id text references public.forecasts(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete cascade,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clear own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- One place decides whether a notification is sent: never to yourself, never from someone you blocked.
create or replace function public.notify(p_user uuid, p_kind text, p_post uuid default null, p_comment uuid default null,
                                         p_forecast text default null, p_chat uuid default null, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  if exists (select 1 from blocks where blocker = p_user and blocked = auth.uid()) then return; end if;
  -- a like or laugh toggled again within a day doesn't notify twice
  if p_kind in ('like','laugh') and exists (select 1 from notifications where user_id = p_user and actor = auth.uid() and kind = p_kind
       and post_id is not distinct from p_post and comment_id is not distinct from p_comment and created_at > now() - interval '1 day') then return; end if;
  insert into notifications (user_id, actor, kind, post_id, comment_id, forecast_id, chat_id, body)
  values (p_user, auth.uid(), p_kind, p_post, p_comment, p_forecast, p_chat, left(p_body, 140));
end $$;
revoke all on function public.notify(uuid, text, uuid, uuid, text, uuid, text) from public, anon, authenticated;

create or replace function public.on_comment_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare parent uuid; owner uuid;
begin
  if new.reply_to is not null then
    select author into parent from comments where id = new.reply_to;
    perform public.notify(parent, 'reply', new.post_id, new.id, new.forecast_id, null, new.body);
  end if;
  if new.post_id is not null then
    select author into owner from posts where id = new.post_id;
    if owner is distinct from parent then perform public.notify(owner, 'comment', new.post_id, new.id, null, null, new.body); end if;
  end if;
  return new;
end $$;
drop trigger if exists comment_notify on public.comments;
create trigger comment_notify after insert on public.comments for each row execute function public.on_comment_notify();

create or replace function public.on_follow_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'user' then perform public.notify(new.target::uuid, 'follow'); end if;
  return new;
end $$;
drop trigger if exists follow_notify on public.follows;
create trigger follow_notify after insert on public.follows for each row execute function public.on_follow_notify();

create or replace function public.on_reaction_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; p uuid;
begin
  if new.target_type = 'post' then select author, id into owner, p from posts where id = new.target_id;
    perform public.notify(owner, new.kind, p);
  else select author, post_id into owner, p from comments where id = new.target_id;
    perform public.notify(owner, new.kind, p, new.target_id);
  end if;
  return new;
end $$;
drop trigger if exists reaction_notify on public.reactions;
create trigger reaction_notify after insert on public.reactions for each row execute function public.on_reaction_notify();

create or replace function public.on_resolution_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor, kind, forecast_id, body)
  select fp.user_id, null, 'resolved', new.forecast_id, 'Resolved ' || upper(new.outcome) || '. You said ' || fp.p || '%.'
    from forecast_predictions fp where fp.forecast_id = new.forecast_id;
  return new;
end $$;
drop trigger if exists resolution_notify on public.forecast_resolutions;
create trigger resolution_notify after insert on public.forecast_resolutions for each row execute function public.on_resolution_notify();

-- Chat messages notify the other members (for push); the in-app list skips these and shows unread chats instead.
create or replace function public.on_message_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from chat_members where chat_id = new.chat_id and user_id <> new.author loop
    perform public.notify(m.user_id, 'message', null, null, null, new.chat_id, coalesce(new.body, 'Shared something with you'));
  end loop;
  return new;
end $$;
drop trigger if exists message_notify on public.messages;
create trigger message_notify after insert on public.messages for each row execute function public.on_message_notify();

create or replace function public.mark_notifications_read() returns void language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ---------------------------------------------------------------
-- Push tokens (Expo push). Delivery: supabase/functions/push, wired with a Database Webhook on notifications inserts.
-- ---------------------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key check (token ~ '^(Exponent|Expo)PushToken\[.+\]$'),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios','android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
create policy "own push tokens" on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "add own push token" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "update own push token" on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own push token" on public.push_tokens for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.push_tokens to authenticated;

-- Live in-app badge
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  end if;
end $$;
