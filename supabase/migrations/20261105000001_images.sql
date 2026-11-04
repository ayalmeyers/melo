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
