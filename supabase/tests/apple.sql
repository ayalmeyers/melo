-- Apple catalog import tests. Runs after security.sql (reuses its helpers and test users).
set role anon;
select set_config('request.jwt.claim.sub','',false);
select tests.expect_fail($$select public.import_apple('{"kind":"album","apple_id":1146195596,"title":"Blonde","artist":"Frank Ocean"}')$$, 'anon import');

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);

-- album creates the artist and keeps Apple art
select tests.expect_eq(public.import_apple('{"kind":"album","apple_id":1440833098,"title":"Sometimes I Might Be Introvert","artist":"Little Simz","artist_apple_id":368183298,"artwork":"https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg","url":"https://music.apple.com/us/album/1440833098","release_date":"2012-10-22T07:00:00Z","genre":"Hip-Hop/Rap","track_count":19}'), 'am1440833098', 'album id');
select tests.expect_eq((select genre from public.catalog_items where id='am1440833098'), 'hiphop', 'genre mapped');
select tests.expect_eq((select year from public.catalog_items where id='am1440833098'), 2012, 'year from release date');
select tests.expect_eq((select source from public.catalog_items where id='am1440833098'), 'apple', 'source apple');
select tests.expect_eq((select name from public.artists where id='ar368183298'), 'Little Simz', 'artist created');
select tests.expect_eq((select artist_id from public.catalog_items where id='am1440833098'), 'ar368183298', 'album linked to artist');

-- importing twice returns the same page, untouched
select tests.expect_eq(public.import_apple('{"kind":"album","apple_id":1440833098,"title":"Renamed","artist":"Someone"}'), 'am1440833098', 'idempotent id');
select tests.expect_eq((select title from public.catalog_items where id='am1440833098'), 'Sometimes I Might Be Introvert', 'title unchanged');

-- foreign hosts are dropped
select public.import_apple('{"kind":"album","apple_id":555,"title":"Hostile","artist":"X","artwork":"https://evil.example.com/a.jpg","url":"javascript:alert(1)"}');
select tests.expect_eq((select artwork_url from public.catalog_items where id='am555'), null::text, 'foreign art dropped');
select tests.expect_eq((select apple_url from public.catalog_items where id='am555'), null::text, 'foreign url dropped');

-- episode creates its podcast
select public.import_apple('{"kind":"episode","apple_id":1000600000001,"title":"Episode One","artist":"Switched on Pop","show_apple_id":934552872,"show_title":"Switched On Pop","dur_min":42,"release_date":"2026-10-01T10:00:00Z"}');
select tests.expect_eq((select show_id from public.catalog_items where id='ep1000600000001'), 'switchedonpop', 'episode joins seeded show');
select tests.expect_eq((select apple_id from public.catalog_items where id='switchedonpop'), 934552872::bigint, 'seeded show linked');
select public.import_apple('{"kind":"episode","apple_id":1000600000002,"title":"Pilot","artist":"New Show","show_apple_id":777,"show_title":"Brand New Music Show"}');
select tests.expect_eq((select type from public.catalog_items where id='pc777'), 'show', 'new show created');

-- seeded rows pick up Apple data instead of duplicating
select tests.expect_eq(public.import_apple('{"kind":"album","apple_id":1146195596,"title":"Blonde","artist":"Frank Ocean","artist_apple_id":442122051,"artwork":"https://is1-ssl.mzstatic.com/b/600x600bb.jpg","release_date":"2016-08-20T07:00:00Z","genre":"R&B/Soul"}'), 'blonde', 'seeded album reused');
select tests.expect_eq((select artwork_url from public.catalog_items where id='blonde'), 'https://is1-ssl.mzstatic.com/b/600x600bb.jpg', 'seeded album gets art');
select tests.expect_eq((select apple_id from public.artists where id='frank'), 442122051::bigint, 'seeded artist linked');
select tests.expect_count($$select * from public.artists where lower(name)='frank ocean'$$, 1, 'no duplicate artist');
select tests.expect_eq(public.import_apple('{"kind":"album","apple_id":1146195596,"title":"Blonde","artist":"Frank Ocean"}'), 'blonde', 'second import finds seeded row');
select tests.expect_eq(public.import_apple('{"kind":"album","apple_id":999001,"title":"Nostalgia, Ultra","artist":"Frank Ocean","artist_apple_id":442122051}'), 'am999001', 'new album');
select tests.expect_eq((select artist_id from public.catalog_items where id='am999001'), 'frank', 'new album joins seeded artist');

-- validation
select tests.expect_fail($$select public.import_apple('{"kind":"movie","apple_id":1,"title":"Nope"}')$$, 'bad kind');
select tests.expect_fail($$select public.import_apple('{"kind":"album","title":"No id"}')$$, 'missing id');
select tests.expect_fail($$select public.import_apple('{"kind":"episode","apple_id":2,"title":"Orphan"}')$$, 'episode without show');

-- wiki works for imported artists and albums
select public.edit_wiki('r:ar368183298','Little Simz is a rapper from London. Test edit for imports.');
select public.edit_wiki('a:am1440833098','A fourth album about self and family. Test edit for imports.');

-- direct writes still blocked
select tests.expect_fail($$insert into public.catalog_items (id, type, title, artist_name, source, added_by) values ('fake','album','X','Y','apple', auth.uid())$$, 'user marks item as apple');
select tests.expect_fail($$insert into public.artists (id, name, cc) values ('arfake','Fake','US')$$, 'direct artist insert');
reset role;
