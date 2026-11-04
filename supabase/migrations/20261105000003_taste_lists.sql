-- Taste match between two people, "people who hear like you", and Letterboxd-style lists.

-- ---------------------------------------------------------------
-- Taste match
-- ---------------------------------------------------------------
/*
  Score 0–100 from three signals, each explainable on screen:
    artists you both listen to (Jaccard overlap, 40%),
    albums and episodes you both logged (Jaccard overlap, 30%),
    how close your ratings are on what you both rated (30%, trusted fully after 5 shared ratings).
  Square roots lift small overlaps, which are normal between two real people.
*/
create or replace function public.taste_match(p_a uuid, p_b uuid)
returns table (score int, shared_items int, shared_artists int, co_rated int, agreement numeric, top_shared text[], both_loved text[])
language sql stable set search_path = public as $$
  with la as (select distinct on (item_id) item_id, rating from logs where user_id = p_a order by item_id, (rating is null), listened_at desc),
       lb as (select distinct on (item_id) item_id, rating from logs where user_id = p_b order by item_id, (rating is null), listened_at desc),
       aa as (select distinct ci.artist_id from la join catalog_items ci on ci.id = la.item_id where ci.artist_id is not null),
       ab as (select distinct ci.artist_id from lb join catalog_items ci on ci.id = lb.item_id where ci.artist_id is not null),
       both_items as (select la.item_id, la.rating ra, lb.rating rb from la join lb using (item_id)),
       s as (
         select (select count(*) from both_items)::int as si,
                (select count(*) from (select item_id from la union select item_id from lb) u)::int as ui,
                (select count(*) from aa join ab using (artist_id))::int as sa,
                (select count(*) from (select artist_id from aa union select artist_id from ab) u)::int as ua,
                (select count(*) from both_items where ra is not null and rb is not null)::int as cr,
                (select avg(1 - abs(ra - rb) / 9.0) from both_items where ra is not null and rb is not null) as ag
       )
  select case when p_a = p_b then 100 when s.ui = 0 then 0 else
           round(100 * (0.4 * sqrt(coalesce(s.sa::numeric / nullif(s.ua, 0), 0))
                      + 0.3 * sqrt(coalesce(s.si::numeric / nullif(s.ui, 0), 0))
                      + 0.3 * (0.5 + (coalesce(s.ag, 0.5) - 0.5) * least(1, s.cr / 5.0))))::int end,
         s.si, s.sa, s.cr, round(s.ag, 2),
         (select array_agg(item_id order by coalesce(ra, 5) + coalesce(rb, 5) desc) from (select * from both_items order by coalesce(ra, 5) + coalesce(rb, 5) desc limit 6) t),
         (select array_agg(item_id) from (select item_id from both_items where ra >= 8 and rb >= 8 order by ra + rb desc limit 6) t)
    from s
$$;
grant execute on function public.taste_match(uuid, uuid) to anon, authenticated;

/* People whose taste is closest to yours: anyone sharing at least two albums or artists, scored, best first. Blocked people never appear. */
create or replace function public.similar_listeners(p_limit int default 20)
returns table (user_id uuid, score int, shared_items int, shared_artists int)
language sql stable set search_path = public as $$
  with mine as (select distinct l.item_id, ci.artist_id from logs l join catalog_items ci on ci.id = l.item_id where l.user_id = auth.uid()),
  cand as (
    select l.user_id, count(distinct l.item_id) filter (where l.item_id in (select item_id from mine))
                   + count(distinct ci.artist_id) filter (where ci.artist_id in (select artist_id from mine)) as overlap
      from logs l join catalog_items ci on ci.id = l.item_id
     where l.user_id <> auth.uid()
       and (l.item_id in (select item_id from mine) or ci.artist_id in (select artist_id from mine where artist_id is not null))
       and not exists (select 1 from blocks b where (b.blocker = auth.uid() and b.blocked = l.user_id) or (b.blocker = l.user_id and b.blocked = auth.uid()))
       and exists (select 1 from profiles p where p.id = l.user_id and p.banned_at is null)
     group by l.user_id
    having count(distinct l.item_id) filter (where l.item_id in (select item_id from mine))
         + count(distinct ci.artist_id) filter (where ci.artist_id in (select artist_id from mine)) >= 2
     order by 2 desc limit 200
  )
  select c.user_id, t.score, t.shared_items, t.shared_artists
    from cand c cross join lateral public.taste_match(auth.uid(), c.user_id) t
   where auth.uid() is not null
   order by t.score desc, t.shared_items desc
   limit least(p_limit, 50)
$$;
grant execute on function public.similar_listeners(int) to authenticated;

-- ---------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  ranked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_owner on public.lists(owner, updated_at desc);

create table if not exists public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  item_id text not null references public.catalog_items(id) on delete cascade,
  position int not null default 0,
  note text not null default '' check (char_length(note) <= 280),
  added_at timestamptz not null default now(),
  primary key (list_id, item_id)
);
create index if not exists list_items_item on public.list_items(item_id);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;
create policy "lists readable" on public.lists for select using (true);
create policy "make own lists" on public.lists for insert to authenticated with check (owner = auth.uid());
create policy "edit own lists" on public.lists for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "delete own lists" on public.lists for delete to authenticated using (owner = auth.uid() or public.is_admin());
create policy "list items readable" on public.list_items for select using (true);
create policy "fill own lists" on public.list_items for insert to authenticated with check (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()));
create policy "edit own list items" on public.list_items for update to authenticated using (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()));
create policy "remove own list items" on public.list_items for delete to authenticated using (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()) or public.is_admin());
grant select on public.lists, public.list_items to anon, authenticated;
grant insert, update, delete on public.lists, public.list_items to authenticated;

-- New items go to the end, lists cap at 250, and editing a list bumps it to the top of its owner's lists.
create or replace function public.list_item_defaults() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from list_items where list_id = new.list_id) >= 250 then raise exception 'A list can hold 250 items'; end if;
    new.position := coalesce((select max(position) + 1 from list_items where list_id = new.list_id), 0);
  end if;
  update lists set updated_at = now() where id = new.list_id;
  return new;
end $$;
drop trigger if exists list_item_defaults on public.list_items;
create trigger list_item_defaults before insert or update on public.list_items for each row execute function public.list_item_defaults();

do $$ begin
  drop trigger if exists block_banned on public.lists;
  create trigger block_banned before insert on public.lists for each row execute function public.block_banned();
  drop trigger if exists block_banned on public.list_items;
  create trigger block_banned before insert on public.list_items for each row execute function public.block_banned();
end $$;

/* Reorders a list in one call: p_items is the full new order. */
create or replace function public.reorder_list(p_list uuid, p_items text[])
returns void language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from lists where id = p_list and owner = auth.uid()) then raise exception 'Not your list' using errcode = '42501'; end if;
  update list_items li set position = o.ord - 1
    from unnest(p_items) with ordinality as o(item_id, ord)
   where li.list_id = p_list and li.item_id = o.item_id;
end $$;
grant execute on function public.reorder_list(uuid, text[]) to authenticated;

-- List cards: owner, size and the first four covers, for grids of lists.
create or replace view public.list_cards with (security_invoker = true) as
select l.*, p.handle as owner_handle, p.name as owner_name, p.color as owner_color,
       (select count(*) from list_items li where li.list_id = l.id)::int as item_count,
       (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'type', c.type, 'artwork_url', c.artwork_url) order by li.position), '[]'::jsonb)
          from (select * from list_items where list_id = l.id order by position limit 4) li join catalog_items c on c.id = li.item_id) as preview
  from lists l join profiles p on p.id = l.owner;
grant select on public.list_cards to anon, authenticated;
