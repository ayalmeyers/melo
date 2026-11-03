-- Row level security. Reads are public unless noted (the website shows public pages).
-- Writes always belong to the signed-in person, or to admins for moderation.

alter table public.genres enable row level security;
alter table public.artists enable row level security;
alter table public.catalog_items enable row level security;
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.logs enable row level security;
alter table public.posts enable row level security;
alter table public.forecasts enable row level security;
alter table public.comments enable row level security;
alter table public.votes enable row level security;
alter table public.reactions enable row level security;
alter table public.moments enable row level security;
alter table public.forecast_predictions enable row level security;
alter table public.forecast_resolutions enable row level security;
alter table public.wiki_pages enable row level security;
alter table public.wiki_revisions enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.waitlist enable row level security;

-- catalog
create policy "catalog readable" on public.genres for select using (true);
create policy "artists readable" on public.artists for select using (true);
create policy "items readable" on public.catalog_items for select using (true);
create policy "members add items" on public.catalog_items for insert to authenticated
  with check (added_by = auth.uid() and source = 'user');
create policy "admins edit items" on public.catalog_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete items" on public.catalog_items for delete to authenticated using (public.is_admin());

-- profiles: the admin flag can never be set by its owner
create policy "profiles readable" on public.profiles for select using (true);
create policy "create own profile" on public.profiles for insert to authenticated with check (id = auth.uid() and is_admin = false);
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (handle, name, bio, city, cc, top4, color, accepted_terms_at) on public.profiles to authenticated;

-- per-person rows: everyone reads, each person writes their own
create policy "follows readable" on public.follows for select using (true);
create policy "follow as self" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "unfollow as self" on public.follows for delete to authenticated using (follower = auth.uid());

create policy "own blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "block as self" on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "unblock as self" on public.blocks for delete to authenticated using (blocker = auth.uid());

create policy "logs readable" on public.logs for select using (true);
create policy "log as self" on public.logs for insert to authenticated with check (user_id = auth.uid());
create policy "edit own logs" on public.logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own logs" on public.logs for delete to authenticated using (user_id = auth.uid());

create policy "votes readable" on public.votes for select using (true);
create policy "vote as self" on public.votes for insert to authenticated with check (user_id = auth.uid());
create policy "change own vote" on public.votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove own vote" on public.votes for delete to authenticated using (user_id = auth.uid());

create policy "reactions readable" on public.reactions for select using (true);
create policy "react as self" on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "unreact as self" on public.reactions for delete to authenticated using (user_id = auth.uid());

create policy "predictions readable" on public.forecast_predictions for select using (true);
create policy "predict as self" on public.forecast_predictions for insert to authenticated with check (user_id = auth.uid());
create policy "update own prediction" on public.forecast_predictions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- authored content: everyone reads, authors write, admins moderate
create policy "posts readable" on public.posts for select using (true);
create policy "post as self" on public.posts for insert to authenticated with check (author = auth.uid());
create policy "edit own post" on public.posts for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "delete own post or moderate" on public.posts for delete to authenticated using (author = auth.uid() or public.is_admin());

create policy "comments readable" on public.comments for select using (true);
create policy "comment as self" on public.comments for insert to authenticated with check (author = auth.uid());
create policy "delete own comment or moderate" on public.comments for delete to authenticated using (author = auth.uid() or public.is_admin());

create policy "moments readable" on public.moments for select using (true);
create policy "moment as self" on public.moments for insert to authenticated with check (author = auth.uid());
create policy "delete own moment or moderate" on public.moments for delete to authenticated using (author = auth.uid() or public.is_admin());

create policy "forecasts readable" on public.forecasts for select using (true);
create policy "ask as self" on public.forecasts for insert to authenticated with check (created_by = auth.uid());
create policy "admins edit forecasts" on public.forecasts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete forecasts" on public.forecasts for delete to authenticated using (public.is_admin());

create policy "resolutions readable" on public.forecast_resolutions for select using (true);
create policy "admins resolve" on public.forecast_resolutions for insert to authenticated with check (public.is_admin() and resolved_by = auth.uid());
create policy "admins reopen" on public.forecast_resolutions for delete to authenticated using (public.is_admin());

-- wiki: read by all, written only through edit_wiki()
create policy "wiki readable" on public.wiki_pages for select using (true);
create policy "wiki history readable" on public.wiki_revisions for select using (true);

-- chats: only members see anything
create policy "members see chat" on public.chats for select to authenticated using (public.is_chat_member(id));
create policy "members rename chat" on public.chats for update to authenticated using (public.is_chat_member(id)) with check (public.is_chat_member(id));
create policy "members see members" on public.chat_members for select to authenticated using (public.is_chat_member(chat_id));
create policy "mark own read" on public.chat_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave chat" on public.chat_members for delete to authenticated using (user_id = auth.uid());
create policy "members read messages" on public.messages for select to authenticated using (public.is_chat_member(chat_id));
create policy "members send messages" on public.messages for insert to authenticated with check (author = auth.uid() and public.is_chat_member(chat_id));
create policy "delete own message" on public.messages for delete to authenticated using (author = auth.uid());

-- safety
create policy "report as self" on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
create policy "admins triage reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- waitlist: anyone can join, nobody but admins can read
create policy "anyone joins waitlist" on public.waitlist for insert to anon, authenticated with check (true);
create policy "admins read waitlist" on public.waitlist for select to authenticated using (public.is_admin());
