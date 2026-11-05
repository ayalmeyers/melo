-- Library bulk import: matching, gap-filling, permissions.
reset role;
select tests.expect_eq((select count(*)::int from pg_proc where proname = 'library_import'), 1, 'library_import exists');
-- Members cannot call it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin perform public.library_import('{}'::jsonb); raise exception 'members should not reach library_import'; exception when insufficient_privilege then null; end $$;
reset role;
set role service_role;
select public.library_import($j${
  "artists": [
    {"apple_id": 1419227, "name": "Beyoncé", "cc": "US", "genres": ["rnb","pop","made-up"], "wikidata_id": "Q36153", "popularity": 300,
     "image_url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b.jpg/800px-b.jpg", "image_credit": "Photo by Z", "image_source": "https://commons.wikimedia.org/wiki/File:B.jpg",
     "wiki": "Beyoncé Giselle Knowles-Carter is an American singer, songwriter and businesswoman.", "synced": true},
    {"apple_id": 77777, "name": "Brand New Artist", "cc": "GB", "genres": ["indie"], "popularity": 25,
     "wiki": "Brand New Artist is an English indie band formed in London in 2019.", "synced": true}
  ],
  "albums": [
    {"apple_id": 1440863958, "artist_apple_id": 1419227, "title": "Lemonade", "artist_name": "Beyoncé", "year": "2016", "release_date": "2016-04-23", "genre": "R&B/Soul", "artwork_url": "https://is1-ssl.mzstatic.com/x/lemonade.jpg/600x600bb.jpg", "apple_url": "https://music.apple.com/us/album/lemonade/1", "track_count": 12},
    {"apple_id": 88888, "artist_apple_id": 77777, "title": "First Record", "artist_name": "Brand New Artist", "year": "2024", "genre": "Alternative", "artwork_url": "https://evil.example.com/x.jpg"},
    {"apple_id": 99999, "artist_apple_id": 123, "title": "Orphan", "artist_name": "Nobody"}
  ]}$j$::jsonb);
reset role;
-- Beyoncé is a hand-picked artist: matched by name, given the Apple id, photo and bio; her genres were already set so they stay.
select tests.expect_eq((select apple_id from public.artists where id = 'beyonce'), 1419227::bigint, 'hand-picked artist linked by name');
select tests.expect_eq((select count(*)::int from public.artists where name = 'Beyoncé'), 1, 'no duplicate artist');
select tests.expect_eq((select wikidata_id from public.artists where id = 'beyonce'), 'Q36153', 'wikidata id saved');
select tests.expect_eq((select library_synced_at is not null from public.artists where id = 'beyonce'), true, 'marked synced');
-- New artist and album; unknown genre dropped; foreign art host refused; orphan album skipped.
select tests.expect_eq((select genres from public.artists where id = 'ar77777'), '{indie}'::text[], 'new artist with known genres only');
select tests.expect_eq((select artwork_url from public.catalog_items where id = 'am88888'), null, 'non-Apple artwork refused');
select tests.expect_eq((select genre from public.catalog_items where id = 'am88888'), 'indie', 'Apple genre mapped');
select tests.expect_eq((select cc from public.catalog_items where id = 'am88888'), 'GB', 'album takes artist country');
select tests.expect_eq((select count(*)::int from public.catalog_items where id = 'am99999'), 0, 'album without a known artist skipped');
select tests.expect_eq((select left(body, 20) from public.wiki_pages where key = 'a:ar77777'), 'Brand New Artist is ', 'bio saved');
-- Running the same batch again changes nothing and keeps one copy of everything.
set role service_role;
select set_config('melo.rerun', public.library_import($j${"albums":[{"apple_id": 88888, "artist_apple_id": 77777, "title": "First Record"}]}$j$::jsonb)->>'new_albums', false);
reset role;
select tests.expect_eq(current_setting('melo.rerun')::int, 0, 'rerun adds nothing');
-- A member's wiki edit is never replaced by the import.
update public.wiki_pages set body = 'Community-written page about Brand New Artist, edited by members.' where key = 'a:ar77777';
set role service_role;
select public.library_import('{"artists":[{"apple_id":77777,"name":"Brand New Artist","wiki":"Replacement text from Wikipedia that should not land.","synced":true}]}'::jsonb);
reset role;
select tests.expect_eq((select left(body, 15) from public.wiki_pages where key = 'a:ar77777'), 'Community-writt', 'member wiki edit kept');
select tests.expect_eq((public.library_stats()->>'artists_synced')::int >= 2, true, 'stats count synced artists');
