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
