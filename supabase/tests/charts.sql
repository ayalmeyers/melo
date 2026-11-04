-- Imports and charts. Users: A ayal, C melo_admin, D dre (D follows A after moderation.sql).
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select public.import_logs('spotify', '[{"item_id":"blonde","plays":120,"listened_at":"2025-03-01T00:00:00Z"},{"item_id":"nope","plays":3,"listened_at":null}]');
select tests.expect_count($$select * from public.logs where user_id = auth.uid() and source = 'spotify'$$, 1, 'import skips unknown items');
select public.import_logs('spotify', '[{"item_id":"blonde","plays":150,"listened_at":"2025-04-01T00:00:00Z"}]');
select tests.expect_eq((select plays from public.logs where user_id = auth.uid() and source = 'spotify' and item_id = 'blonde'), 150, 're-import updates, no duplicate');
select tests.expect_fail($$select public.import_logs('napster', '[]')$$, 'unknown source');
insert into public.logs (item_id, rating, listened_at) values ('brat', 8, now() + interval '30 days');
select tests.expect_eq((select listened_at <= now() + interval '1 hour' from public.logs where user_id = auth.uid() and item_id = 'brat' order by listened_at desc limit 1), true, 'future dates clamped');

-- This week: brat logged by C and D, zombie by D. Last week: zombie by A and C.
insert into public.logs (item_id, rating) values ('zombie', 6);
update public.logs set listened_at = now() - interval '9 days' where user_id = auth.uid() and item_id = 'zombie';
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
insert into public.logs (item_id, rating) values ('brat', 10), ('zombie', 4);
reset role;
delete from public.logs where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into public.logs (user_id, item_id, rating, listened_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'zombie', 9, now() - interval '10 days');
set role anon;
select tests.expect_eq((select subject_id from public.chart('public','albums') where rank = 1), 'brat', 'brat tops the public chart');
select tests.expect_eq((select prev_rank from public.chart('public','albums') where subject_id = 'zombie'), 1, 'zombie was number one last week');
select tests.expect_count($$select * from public.chart('public','albums') where subject_id = 'blonde'$$, 0, 'imports never chart');
select tests.expect_eq((select avg_rating from public.chart('public','albums') where subject_id = 'brat'), 4.50::numeric, 'average rating in stars');
select tests.expect_count($$select * from public.chart('public','artists')$$, 2, 'artist chart');

-- Friends: D sees only D and the people D follows (A). C's brat log drops out.
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
select tests.expect_eq((select listeners from public.chart('friends','albums') where subject_id = 'brat'), 1, 'friends chart counts only your circle');
reset role;
