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
