-- Taste match and lists. Users: A ayal, C melo_admin, D dre.
reset role;
delete from public.blocks;
delete from public.logs;
insert into public.logs (user_id, item_id, rating) values
 ('aaaaaaaa-0000-0000-0000-000000000001','blonde',10), ('aaaaaaaa-0000-0000-0000-000000000001','orange',9), ('aaaaaaaa-0000-0000-0000-000000000001','brat',8), ('aaaaaaaa-0000-0000-0000-000000000001','zombie',3),
 ('dddddddd-0000-0000-0000-000000000004','blonde',9), ('dddddddd-0000-0000-0000-000000000004','orange',9), ('dddddddd-0000-0000-0000-000000000004','brat',7),
 ('cccccccc-0000-0000-0000-000000000003','zombie',10), ('cccccccc-0000-0000-0000-000000000003','blonde',2);
set role anon;
select tests.expect_eq((select shared_items from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004')), 3, 'shared albums');
select tests.expect_eq((select score > 80 from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004')), true, 'close taste scores high');
select tests.expect_eq((select score < (select score from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004')) from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003')), true, 'opposite ratings score lower');
select tests.expect_eq((select 'blonde' = any(both_loved) from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004')), true, 'both loved');
select tests.expect_eq((select score from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')), 100, 'self is 100');

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select tests.expect_eq((select user_id from public.similar_listeners(5) limit 1), 'dddddddd-0000-0000-0000-000000000004'::uuid, 'closest listener first');
-- A blocks C: C never appears
insert into public.blocks (blocked) values ('cccccccc-0000-0000-0000-000000000003') on conflict do nothing;
select tests.expect_count($$select * from public.similar_listeners(5) where user_id = 'cccccccc-0000-0000-0000-000000000003'$$, 0, 'blocked hidden');

-- lists
insert into public.lists (id, title, description) values ('77777777-0000-0000-0000-000000000001', 'Best of the 2010s', 'Ranked.');
insert into public.list_items (list_id, item_id, note) values ('77777777-0000-0000-0000-000000000001','blonde','The one.'), ('77777777-0000-0000-0000-000000000001','brat',''), ('77777777-0000-0000-0000-000000000001','orange','');
select tests.expect_eq((select position from public.list_items where item_id = 'orange' and list_id = '77777777-0000-0000-0000-000000000001'), 2, 'appended in order');
select public.reorder_list('77777777-0000-0000-0000-000000000001', array['orange','blonde','brat']);
select tests.expect_eq((select item_id from public.list_items where list_id = '77777777-0000-0000-0000-000000000001' and position = 0), 'orange', 'reordered');
select tests.expect_eq((select item_count from public.list_cards where id = '77777777-0000-0000-0000-000000000001'), 3, 'card count');
select tests.expect_eq((select preview->0->>'id' from public.list_cards where id = '77777777-0000-0000-0000-000000000001'), 'orange', 'card preview follows order');
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
select tests.expect_fail($$insert into public.list_items (list_id, item_id) values ('77777777-0000-0000-0000-000000000001','zombie')$$, 'add to someone else''s list');
select tests.expect_fail($$select public.reorder_list('77777777-0000-0000-0000-000000000001', array['brat'])$$, 'reorder someone else''s list');
update public.lists set title = 'Hijacked' where id = '77777777-0000-0000-0000-000000000001';
select tests.expect_eq((select title from public.lists where id = '77777777-0000-0000-0000-000000000001'), 'Best of the 2010s', 'cannot rename others'' lists');
set role anon;
select tests.expect_count($$select * from public.list_items where list_id = '77777777-0000-0000-0000-000000000001'$$, 3, 'lists are public');
reset role;
