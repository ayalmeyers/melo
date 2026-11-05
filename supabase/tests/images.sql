-- Artist photo rules and genre mosaics.
-- The seed already fills photos; start these three from "never looked".
reset role;
update public.artists set image_url = null, image_credit = null, image_source = null, image_checked_at = null where id in ('frank','tems','kendrick');
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
select tests.expect_fail($$select public.set_artist_image('frank','https://evil.example.com/x.jpg','x',null)$$, 'foreign photo host');
select public.set_artist_image('frank','https://upload.wikimedia.org/a/frank.jpg','Photo by X (CC BY-SA 4.0) via Wikimedia Commons','https://commons.wikimedia.org/wiki/File:Frank.jpg');
select tests.expect_eq((select image_url from public.artists where id='frank'), 'https://upload.wikimedia.org/a/frank.jpg', 'photo saved');
select public.set_artist_image('frank','https://upload.wikimedia.org/a/other.jpg','vandal',null);
select tests.expect_eq((select image_url from public.artists where id='frank'), 'https://upload.wikimedia.org/a/frank.jpg', 'member cannot replace a photo');
select public.set_artist_image('tems', null);
select tests.expect_eq((select image_url is null and image_checked_at is not null from public.artists where id='tems'), true, 'nothing found is recorded');
update public.artists set image_url = 'https://upload.wikimedia.org/x.jpg' where id = 'kendrick';
select tests.expect_eq((select image_url from public.artists where id='kendrick'), null::text, 'direct artist update ignored');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.set_artist_image('frank','https://upload.wikimedia.org/a/better.jpg','Photo by Y',null);
select tests.expect_eq((select image_url from public.artists where id='frank'), 'https://upload.wikimedia.org/a/better.jpg', 'admin replaces');
reset role;
update public.catalog_items set artwork_url = 'https://is1-ssl.mzstatic.com/' || id || '.jpg' where genre = 'rnb';
set role anon;
select tests.expect_eq((select cardinality(covers) from public.genre_art where genre = 'rnb') between 1 and 4, true, 'genre mosaic readable by anyone');
reset role;
