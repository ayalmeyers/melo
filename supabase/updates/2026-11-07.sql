-- Melo update, Nov 7 2026: the music library (bulk artists and discographies, fast search, popularity ordering).
-- Paste all of this into Supabase → SQL Editor → New query, then Run. Run it after 2026-11-05.sql and the newest catalog-*.sql.
-- ===== supabase/migrations/20261107000001_library.sql =====
-- Melo's library: tens of thousands of artists and their full discographies, loaded in bulk by the Library job
-- (scripts/library.mts on GitHub Actions) using the service role. Covers and links come from Apple, bios and photos
-- from Wikipedia and Wikimedia Commons (credited), artist identity from Wikidata.

create extension if not exists pg_trgm with schema extensions;

alter table public.artists add column if not exists library_synced_at timestamptz;
alter table public.artists add column if not exists wikidata_id text check (wikidata_id ~ '^Q[0-9]+$');
alter table public.artists add column if not exists popularity int not null default 0;
alter table public.catalog_items add column if not exists popularity int not null default 0;

-- Substring search stays fast with hundreds of thousands of rows.
-- (Trigram indexes serve the ILIKE searches the apps send.)
create index if not exists artists_name_trgm on public.artists using gin (name extensions.gin_trgm_ops);
create index if not exists catalog_items_title_trgm on public.catalog_items using gin (title extensions.gin_trgm_ops);
create index if not exists catalog_items_artist_name_trgm on public.catalog_items using gin (artist_name extensions.gin_trgm_ops);
create index if not exists catalog_items_genre_pop on public.catalog_items (genre, popularity desc);
create index if not exists artists_pop on public.artists (popularity desc);
create index if not exists artists_library_synced on public.artists (library_synced_at nulls first);

-- Genre mosaics: the four most popular covers per genre, read straight off the (genre, popularity) index.
create or replace view public.genre_art with (security_invoker = true) as
select g.id as genre,
       array(select c.artwork_url from public.catalog_items c
              where c.genre = g.id and c.artwork_url is not null and c.type in ('album','show')
              order by c.popularity desc, c.created_at limit 4) as covers
  from public.genres g;
grant select on public.genre_art to anon, authenticated;

/*
  library_import(p) — one batch from the Library job.
  p = { artists: [{ apple_id, name, cc, genres[], wikidata_id, popularity, image_url, image_credit, image_source, wiki, synced }],
        albums:  [{ apple_id, artist_apple_id, type, title, artist_name, year, release_date, genre (Apple name), artwork_url, apple_url, track_count }] }
  Rules: an artist is matched by Apple id first, then by exact name among artists with no Apple id (the hand-picked ones).
  Nothing a person or admin set is overwritten: photos, bios and covers only fill gaps. Albums are matched by Apple id,
  then by title + artist, so the hand-picked albums are enriched instead of duplicated.
*/
create or replace function public.library_import(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a jsonb; r jsonb; v_id text; v_artist text; n_art int := 0; n_new_art int := 0; n_alb int := 0; n_new_alb int := 0; n_wiki int := 0;
begin
  for a in select * from jsonb_array_elements(coalesce(p->'artists', '[]')) loop
    if (a->>'apple_id') is null or coalesce(a->>'name', '') = '' then continue; end if;
    select id into v_id from artists where apple_id = (a->>'apple_id')::bigint;
    if v_id is null then
      select id into v_id from artists where apple_id is null and lower(name) = lower(a->>'name') limit 1;
    end if;
    if v_id is null then
      v_id := 'ar' || (a->>'apple_id');
      insert into artists (id, name, cc, genres, apple_id, source)
      values (v_id, left(a->>'name', 200), coalesce(nullif(a->>'cc', ''), ''),
              coalesce(array(select g from jsonb_array_elements_text(a->'genres') g where exists (select 1 from genres where id = g)), '{}'),
              (a->>'apple_id')::bigint, 'apple')
      on conflict (id) do nothing;
      n_new_art := n_new_art + 1;
    end if;
    update artists set
      apple_id = coalesce(apple_id, case when not exists (select 1 from artists x where x.apple_id = (a->>'apple_id')::bigint and x.id <> v_id) then (a->>'apple_id')::bigint end),
      wikidata_id = coalesce(wikidata_id, a->>'wikidata_id'),
      cc = case when coalesce(cc, '') = '' then coalesce(nullif(a->>'cc', ''), '') else cc end,
      genres = case when coalesce(cardinality(genres), 0) = 0 then coalesce(array(select g from jsonb_array_elements_text(a->'genres') g where exists (select 1 from genres where id = g)), '{}') else genres end,
      popularity = greatest(popularity, coalesce((a->>'popularity')::int, 0)),
      image_url = coalesce(image_url, a->>'image_url'),
      image_credit = case when image_url is null then left(a->>'image_credit', 300) else image_credit end,
      image_source = case when image_url is null then a->>'image_source' else image_source end,
      image_checked_at = case when a->>'image_url' is not null or (a->>'synced')::boolean then coalesce(image_checked_at, now()) else image_checked_at end,
      library_synced_at = case when (a->>'synced')::boolean then now() else library_synced_at end
    where id = v_id;
    n_art := n_art + 1;
    if coalesce(a->>'wiki', '') <> '' and char_length(a->>'wiki') between 20 and 20000 and v_id ~ '^[a-z0-9_-]+$' then
      insert into wiki_pages (key, body, rev) values ('a:' || v_id, a->>'wiki', 1) on conflict (key) do nothing;
      if found then n_wiki := n_wiki + 1; end if;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p->'albums', '[]')) loop
    if (r->>'apple_id') is null or coalesce(r->>'title', '') = '' then continue; end if;
    select id into v_artist from artists where apple_id = (r->>'artist_apple_id')::bigint;
    if v_artist is null then continue; end if;
    -- Already in Melo under this Apple id: fill gaps only.
    select id into v_id from catalog_items where apple_id = (r->>'apple_id')::bigint;
    if v_id is null then
      select id into v_id from catalog_items where artist_id = v_artist and lower(title) = lower(r->>'title') and type = 'album' limit 1;
    end if;
    if v_id is null then
      v_id := 'am' || (r->>'apple_id');
      insert into catalog_items (id, type, title, artist_id, artist_name, year, cc, genre, source, apple_id, artwork_url, apple_url, release_date, track_count, popularity)
      values (v_id, 'album', left(r->>'title', 200), v_artist, left(coalesce(r->>'artist_name', ''), 200),
              case when (r->>'year') ~ '^[0-9]{4}$' and (r->>'year')::int between 1900 and 2100 then (r->>'year')::int end,
              coalesce((select cc from artists where id = v_artist), ''), melo_genre(r->>'genre'), 'apple', (r->>'apple_id')::bigint,
              case when r->>'artwork_url' ~ '^https://is[0-9]+-ssl\.mzstatic\.com/' then r->>'artwork_url' end,
              case when r->>'apple_url' ~ '^https://(music|itunes)\.apple\.com/' then r->>'apple_url' end,
              nullif(r->>'release_date', '')::date, nullif(r->>'track_count', '')::int, coalesce((r->>'popularity')::int, 0))
      on conflict (id) do nothing;
      n_new_alb := n_new_alb + 1;
    else
      update catalog_items set
        artwork_url = coalesce(artwork_url, case when r->>'artwork_url' ~ '^https://is[0-9]+-ssl\.mzstatic\.com/' then r->>'artwork_url' end),
        apple_url = coalesce(apple_url, case when r->>'apple_url' ~ '^https://(music|itunes)\.apple\.com/' then r->>'apple_url' end),
        release_date = coalesce(release_date, nullif(r->>'release_date', '')::date),
        track_count = coalesce(track_count, nullif(r->>'track_count', '')::int),
        genre = coalesce(genre, melo_genre(r->>'genre')),
        popularity = greatest(popularity, coalesce((r->>'popularity')::int, 0)),
        apple_id = coalesce(apple_id, case when not exists (select 1 from catalog_items x where x.apple_id = (r->>'apple_id')::bigint) then (r->>'apple_id')::bigint end)
      where id = v_id;
    end if;
    n_alb := n_alb + 1;
  end loop;
  return jsonb_build_object('artists', n_art, 'new_artists', n_new_art, 'albums', n_alb, 'new_albums', n_new_alb, 'wiki', n_wiki);
end $$;

-- Which of these Apple artist ids were synced within the last p_days (so the job can resume where it left off).
create or replace function public.library_synced(p_ids bigint[], p_days int default 60)
returns setof bigint language sql stable security definer set search_path = public as $$
  select apple_id from artists where apple_id = any(p_ids) and library_synced_at > now() - make_interval(days => p_days)
$$;

create or replace function public.library_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'artists', (select count(*) from artists),
    'artists_synced', (select count(*) from artists where library_synced_at is not null),
    'artists_with_photo', (select count(*) from artists where image_url is not null),
    'albums', (select count(*) from catalog_items where type = 'album'),
    'albums_with_art', (select count(*) from catalog_items where type = 'album' and artwork_url is not null),
    'artist_bios', (select count(*) from wiki_pages where key like 'a:%'),
    'database_mb', (select round(pg_database_size(current_database()) / 1048576.0))
  )
$$;

-- Only the Library job (service role) may call these.
revoke all on function public.library_import(jsonb) from public, anon, authenticated;
revoke all on function public.library_synced(bigint[], int) from public, anon, authenticated;
revoke all on function public.library_stats() from public, anon, authenticated;
grant execute on function public.library_import(jsonb) to service_role;
grant execute on function public.library_synced(bigint[], int) to service_role;
grant execute on function public.library_stats() to service_role;
