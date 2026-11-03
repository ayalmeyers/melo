-- Security and behavior tests. Run by scripts/test-db.sh against a throwaway database.
create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.expect_fail(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'EXPECTED FAILURE BUT SUCCEEDED: %', label;
end $$;
create function tests.expect_count(q text, n int, label text) returns void language plpgsql as $$
declare c int;
begin execute 'select count(*) from (' || q || ') x' into c;
  if c <> n then raise exception 'COUNT MISMATCH (%): expected %, got %', label, n, c; end if; end $$;
create function tests.expect_eq(a anyelement, b anyelement, label text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'NOT EQUAL (%): % vs %', label, a, b; end if; end $$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email) values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@test.dev'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@test.dev'),
 ('cccccccc-0000-0000-0000-000000000003','c@test.dev'),
 ('dddddddd-0000-0000-0000-000000000004','d@test.dev');

-- ---------- person A ----------
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
insert into public.profiles (id, handle, name) values ('aaaaaaaa-0000-0000-0000-000000000001','ayal','Ayal');
select tests.expect_fail($$insert into public.profiles (id, handle, name) values ('bbbbbbbb-0000-0000-0000-000000000002','fake','Fake')$$, 'create someone else''s profile');
select tests.expect_fail($$update public.profiles set is_admin = true where id = auth.uid()$$, 'promote self to admin');
select tests.expect_fail($$insert into public.profiles (id, handle, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Bad Handle!','x')$$, 'bad handle');
insert into public.posts (kind, target_type, target_id, body) values ('take','item','brat','BRAT is a great album for 31 minutes.');
select tests.expect_fail($$insert into public.posts (kind, body) values ('review','no target')$$, 'review without item');
select tests.expect_fail($$insert into public.posts (author, kind, body) values ('bbbbbbbb-0000-0000-0000-000000000002','take','posting as B')$$, 'post as someone else');
insert into public.logs (item_id, rating) values ('zombie', 9), ('blonde', 10);
select public.edit_wiki('r:fela','Fela Kuti pioneered Afrobeat in Lagos with Africa 70. Edited in a test.');
select tests.expect_eq((select rev from public.wiki_pages where key='r:fela'), 2, 'wiki rev bumped');
select tests.expect_fail($$insert into public.wiki_pages (key, body) values ('r:kendrick','direct writes are not allowed here at all')$$, 'direct wiki write');
select tests.expect_fail($$select public.edit_wiki('r:nobody','This artist does not exist in the catalog.')$$, 'wiki for unknown entity');
insert into public.catalog_items (id, type, title, artist_name, cc, genre, added_by) values ('useradd1','album','New Album','Someone','NG','afro', auth.uid());
select tests.expect_fail($$insert into public.catalog_items (id, type, title, artist_name, source, added_by) values ('sneaky','album','X','Y','seed', auth.uid())$$, 'user marks item as seed');

-- ---------- person B ----------
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
insert into public.profiles (id, handle, name) values ('bbbbbbbb-0000-0000-0000-000000000002','maya','Maya');
select tests.expect_fail($$insert into public.profiles (id, handle, name) values ('bbbbbbbb-0000-0000-0000-000000000002','ayal','Dup')$$, 'duplicate handle');
select tests.expect_eq(public.handle_available('ayal'), false, 'handle taken');
select tests.expect_eq(public.handle_available('newname'), true, 'handle free');
do $$ declare pid uuid := (select id from public.posts limit 1); begin
  insert into public.votes (post_id, value) values (pid, 'disagree');
  insert into public.reactions (target_type, target_id, kind) values ('post', pid, 'laugh');
  insert into public.comments (post_id, body) values (pid, 'Cap.');
  update public.posts set body = 'hijacked' where id = pid;
  if (select body from public.posts where id = pid) = 'hijacked' then raise exception 'B edited A''s post'; end if;
  perform tests.expect_fail(format('insert into public.votes (user_id, post_id, value) values (%L, %L, %L)', 'aaaaaaaa-0000-0000-0000-000000000001', pid, 'agree'), 'vote as A');
end $$;
-- deleting someone else's post silently matches nothing
do $$ declare pid uuid := (select id from public.posts limit 1); begin
  delete from public.posts where id = pid;
  if not exists (select 1 from public.posts where id = pid) then raise exception 'B deleted A''s post'; end if;
end $$;
insert into public.forecast_predictions (forecast_id, p) values ('frank2027', 20), ('kpop200', 80);
select tests.expect_fail($$insert into public.forecast_resolutions (forecast_id, outcome, resolved_by) values ('frank2027','no', auth.uid())$$, 'non-admin resolves');
select tests.expect_count('select * from public.post_feed where agree + disagree = 1 and laughs = 1 and comment_count = 1', 1, 'feed counts');

-- B opens a group with A
do $$ declare cid uuid; begin
  cid := public.create_chat('Listening club', array['aaaaaaaa-0000-0000-0000-000000000001'::uuid]);
  insert into public.messages (chat_id, body) values (cid, 'first!');
  perform tests.expect_eq((select last_message_preview from public.chats where id = cid), 'first!', 'chat preview');
end $$;

-- ---------- person D: not in the chat ----------
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
insert into public.profiles (id, handle, name) values ('dddddddd-0000-0000-0000-000000000004','dre','Dre');
select tests.expect_count('select * from public.messages', 0, 'outsider reads messages');
select tests.expect_count('select * from public.chats', 0, 'outsider sees chats');
do $$ declare cid uuid := (select id from public.chats limit 1); begin
  -- cannot even see the chat id; try a guessed insert using the real id read as postgres later
  null;
end $$;
-- D blocks A, so A can't DM D
insert into public.blocks (blocked) values ('aaaaaaaa-0000-0000-0000-000000000001');

-- ---------- admin C ----------
reset role;
select set_config('request.jwt.claim.sub','',false);
insert into public.profiles (id, handle, name, is_admin) values ('cccccccc-0000-0000-0000-000000000003','melo_admin','Admin', true);
-- outsider insert into a real chat must fail
set role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
reset role;
do $$ declare cid uuid := (select id from public.chats limit 1); begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claim.sub','dddddddd-0000-0000-0000-000000000004',false);
  perform tests.expect_fail(format('insert into public.messages (chat_id, body) values (%L, %L)', cid, 'let me in'), 'outsider sends message');
  execute 'reset role';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-0000-0000-000000000001',false);
select tests.expect_fail($$select public.open_dm('dddddddd-0000-0000-0000-000000000004')$$, 'DM someone who blocked you');
select tests.expect_count('select * from public.messages', 1, 'member reads messages');

select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
insert into public.forecast_resolutions (forecast_id, outcome, resolved_by) values ('frank2027','no', auth.uid()), ('kpop200','yes', auth.uid());
-- B said 20% on a NO and 80% on a YES: Brier 0.04, skill 0.84, Ear 92
select tests.expect_eq((select ear from public.ear_scores where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 92, 'ear score');
select tests.expect_eq((select crowd_p from public.forecast_consensus where forecast_id = 'kpop200'), 80, 'consensus');
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
select tests.expect_fail($$update public.forecast_predictions set p = 99 where forecast_id = 'kpop200'$$, 'change a resolved forecast');
select tests.expect_fail($$insert into public.forecast_predictions (forecast_id, p) values ('frank2027', 50)$$, 'predict after resolution');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
delete from public.posts where author = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.expect_count('select * from public.posts', 0, 'admin moderates a post');

-- radar sees recent listening
select tests.expect_count('select * from public.breakout_radar(7, 10)', 2, 'radar rows');

-- ---------- waitlist ----------
set role anon;
select set_config('request.jwt.claim.sub','',false);
insert into public.waitlist (email, platform) values ('fan@example.com','Spotify');
select tests.expect_fail($$insert into public.waitlist (email) values ('not-an-email')$$, 'bad email');
select tests.expect_count('select * from public.waitlist', 0, 'anon reads waitlist');
set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
select tests.expect_count('select * from public.waitlist', 0, 'member reads waitlist');
select set_config('request.jwt.claim.sub','cccccccc-0000-0000-0000-000000000003',false);
select tests.expect_count('select * from public.waitlist', 1, 'admin reads waitlist');

-- ---------- account deletion ----------
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-0000-0000-000000000002',false);
reset role;
grant delete on auth.users to postgres;
set role authenticated;
select public.delete_account();
reset role;
select tests.expect_count($$select * from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 0, 'profile gone');
select tests.expect_count($$select * from public.forecast_predictions where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 0, 'predictions gone');
select tests.expect_count($$select * from public.chat_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 0, 'memberships gone');
