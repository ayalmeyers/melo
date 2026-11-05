-- More genres for Apple's charts: K-pop, J-pop, Indian & Bollywood, Country, Soundtracks & Musicals. J-pop no longer lands in City Pop.
create or replace function public.melo_genre(apple_genre text)
returns text language sql immutable as $$
  select case
    when apple_genre is null then null
    when apple_genre ~* 'k-pop' then 'kpop'
    when apple_genre ~* 'j-pop|anime|j-rock|vocaloid' then 'jpop'
    when apple_genre ~* 'bollywood|indian|tamil|telugu|punjabi|hindi|bhangra' then 'indian'
    when apple_genre ~* 'country|americana|bluegrass' then 'country'
    when apple_genre ~* 'soundtrack|musical|original score|cast recording' then 'soundtrack'
    when apple_genre ~* 'hip-hop|rap' then 'hiphop'
    when apple_genre ~* 'r&b|soul' then 'rnb'
    when apple_genre ~* 'afro' then 'afro'
    when apple_genre ~* 'latin|reggaeton|urbano|salsa|bachata|regional mexicano|corrido' then 'latin'
    when apple_genre ~* 'city pop' then 'citypop'
    when apple_genre ~* 'brazil|mpb|bossa|samba|sertanejo|pagode' then 'brazil'
    when apple_genre ~* 'alternative|indie' then 'indie'
    when apple_genre ~* 'rock|metal|punk' then 'rock'
    when apple_genre ~* 'electronic|dance|house|techno' then 'electronic'
    when apple_genre ~* 'jazz' then 'jazz'
    when apple_genre ~* 'pop' then 'pop'
    when apple_genre ~* 'world|african' then 'afro'
    else null
  end
$$;

-- Wikimedia now serves thumbnails from thumb.wikimedia.org as well as upload.wikimedia.org. Accept both, Commons files only.
create or replace function public.set_artist_image(p_id text, p_url text, p_credit text default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_url is not null and p_url !~ '^https://(upload|thumb)\.wikimedia\.org/' then raise exception 'Unsupported image host'; end if;
  if p_source is not null and p_source !~ '^https://commons\.wikimedia\.org/' then p_source := null; end if;
  update artists set
    image_url = case when p_url is null then image_url else p_url end,
    image_credit = case when p_url is null then image_credit else left(p_credit, 300) end,
    image_source = case when p_url is null then image_source else p_source end,
    image_checked_at = now()
  where id = p_id
    and (public.is_admin() or (image_url is null and (image_checked_at is null or image_checked_at < now() - interval '30 days')));
end $$;
