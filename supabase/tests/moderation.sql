-- Moderation and notification tests. Runs after security.sql. Users: A ayal (member), C melo_admin (admin), D dre (member).
set role authenticated;

-- start clean: security.sql left D blocking A
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
delete from public.blocks where blocked = 'aaaaaaaa-0000-0000-0000-000000000001';

-- A posts; D comments, likes, follows A
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into public.posts (id, kind, body) values ('99999999-0000-0000-0000-000000000001','take','Test take for moderation and notifications.');
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
insert into public.comments (id, post_id, body) values ('99999999-0000-0000-0000-0000000000c1','99999999-0000-0000-0000-000000000001','Disagree strongly.');
insert into public.reactions (target_type, target_id, kind) values ('post','99999999-0000-0000-0000-000000000001','like');
delete from public.reactions where target_id = '99999999-0000-0000-0000-000000000001';
insert into public.reactions (target_type, target_id, kind) values ('post','99999999-0000-0000-0000-000000000001','like');
insert into public.follows (kind, target) values ('user','aaaaaaaa-0000-0000-0000-000000000001') on conflict do nothing;
select tests.expect_count($$select * from public.notifications$$, 0, 'D sees none of A''s notifications');
select tests.expect_fail($$insert into public.notifications (user_id, kind) values ('aaaaaaaa-0000-0000-0000-000000000001','follow')$$, 'forge a notification');

select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select tests.expect_count($$select * from public.notifications where kind = 'comment'$$, 1, 'comment notifies author');
select tests.expect_count($$select * from public.notifications where kind = 'like'$$, 1, 'like notifies once despite toggling');
select tests.expect_count($$select * from public.notifications where kind = 'follow'$$, 1, 'follow notifies');
-- A replies to D: D gets a reply, A gets nothing for their own comment
insert into public.comments (post_id, reply_to, body) values ('99999999-0000-0000-0000-000000000001','99999999-0000-0000-0000-0000000000c1','Fair, but no.');
select tests.expect_count($$select * from public.notifications where kind in ('comment','reply')$$, 1, 'no self notification');
select public.mark_notifications_read();
select tests.expect_count($$select * from public.notifications where read_at is null$$, 0, 'mark read');
select tests.expect_fail($$update public.notifications set kind = 'follow'$$, 'edit notification content');

-- A blocks D: D's later actions no longer notify A
insert into public.blocks (blocked) values ('dddddddd-0000-0000-0000-000000000004') on conflict do nothing;
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
insert into public.comments (post_id, body) values ('99999999-0000-0000-0000-000000000001','Blocked comment.');
select tests.expect_count($$select * from public.notifications where user_id = 'dddddddd-0000-0000-0000-000000000004' and kind = 'reply'$$, 1, 'D got the reply');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select tests.expect_count($$select * from public.notifications where kind = 'comment'$$, 1, 'blocked commenter does not notify');

-- push tokens are private and validated
insert into public.push_tokens (token) values ('ExponentPushToken[abc123]');
select tests.expect_fail($$insert into public.push_tokens (token) values ('not-a-token')$$, 'bad token');
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
select tests.expect_count($$select * from public.push_tokens$$, 0, 'tokens private');

-- reporting and the admin queue
insert into public.reports (target_type, target_id, reason) values ('post','99999999-0000-0000-0000-000000000001','spam');
select tests.expect_fail($$select * from public.report_queue()$$, 'member reads queue');
select tests.expect_fail($$select public.moderate((select id from public.reports limit 1), 'dismiss')$$, 'member moderates');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select tests.expect_count($$select * from public.report_queue() where target_id = '99999999-0000-0000-0000-000000000001' and author_handle = 'ayal' and content like 'Test take%'$$, 1, 'queue shows content and author');
select public.moderate((select id from public.reports where target_id = '99999999-0000-0000-0000-000000000001'), 'ban');
select tests.expect_count($$select * from public.posts where id = '99999999-0000-0000-0000-000000000001'$$, 0, 'ban removes content');
select tests.expect_count($$select * from public.report_queue() where target_id = '99999999-0000-0000-0000-000000000001'$$, 0, 'report closed');

-- banned accounts can't post, but admins can unban
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select tests.expect_eq(public.is_banned(), true, 'A banned');
select tests.expect_fail($$insert into public.posts (kind, body) values ('take','Back again with spam.')$$, 'banned posts');
select tests.expect_fail($$update public.profiles set banned_at = null where id = auth.uid()$$, 'self unban');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
insert into public.reports (target_type, target_id, reason) values ('profile','aaaaaaaa-0000-0000-0000-000000000001','appeal');
select public.moderate((select id from public.reports where target_type = 'profile' and target_id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'open'), 'unban');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into public.posts (kind, body) values ('take','Reformed and posting again.');
reset role;
