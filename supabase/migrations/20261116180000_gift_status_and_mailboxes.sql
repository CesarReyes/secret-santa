-- Gift status and the anonymous santa <-> giftee chat.
--
-- Mailboxes are keyed by sha256(access), where `access` is derived from a per-pair secret that
-- only the two phones know. Messages have no author, only a side. Nothing in these tables says
-- which people a mailbox belongs to; reads and writes go through RPCs that check the caller
-- knows the mailbox's access value.

alter table public.assignments
  add column gift_status text not null default 'pending' check (gift_status in ('pending', 'bought', 'delivered'));
grant update (gift_status) on public.assignments to authenticated;

-- The mailbox secret sealed for the person who RECEIVES the gift (the giver gets it inside
-- their own assignment). Rows are inserted in a random order unrelated to `assignments`.
create table public.mailbox_receivers (
  group_id uuid not null,
  receiver_id uuid not null,
  ciphertext text not null,
  key_id text not null,
  primary key (group_id, receiver_id),
  foreign key (group_id, receiver_id) references public.group_members(group_id, user_id) on delete cascade
);

create table public.mailboxes (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  group_id uuid not null references public.groups(id) on delete cascade
);

create table public.mailbox_messages (
  id bigint generated always as identity primary key,
  mailbox_id text not null references public.mailboxes(id) on delete cascade,
  side text not null check (side in ('santa', 'giftee')),
  ciphertext text not null check (char_length(ciphertext) <= 8000),
  created_at timestamptz not null default now()
);
create index mailbox_messages_mailbox on public.mailbox_messages (mailbox_id, id);

alter table public.mailbox_receivers enable row level security;
alter table public.mailboxes enable row level security;
alter table public.mailbox_messages enable row level security;

create policy "mailbox_receivers: own" on public.mailbox_receivers for select to authenticated
  using (receiver_id = (select auth.uid()));

-- No policies on mailboxes/messages: clients only reach them through the RPCs below.
revoke all on public.mailbox_receivers, public.mailboxes, public.mailbox_messages from anon, authenticated;
grant select on public.mailbox_receivers to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Draw storage now also writes mailboxes. Service role only.
-- ---------------------------------------------------------------------------------------------

drop function public.store_draw(uuid, jsonb);

create or replace function public.store_draw(p_group uuid, p_assignments jsonb, p_receivers jsonb, p_mailboxes jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.assignments where group_id = p_group;
  delete from public.mailbox_receivers where group_id = p_group;
  delete from public.mailboxes where group_id = p_group;

  insert into public.assignments (group_id, giver_id, ciphertext, key_id)
  select p_group, r.giver_id, r.ciphertext, r.key_id
  from jsonb_to_recordset(p_assignments) as r(giver_id uuid, ciphertext text, key_id text);

  insert into public.mailbox_receivers (group_id, receiver_id, ciphertext, key_id)
  select p_group, r.receiver_id, r.ciphertext, r.key_id
  from jsonb_to_recordset(p_receivers) as r(receiver_id uuid, ciphertext text, key_id text);

  insert into public.mailboxes (id, group_id)
  select r.id, p_group from jsonb_to_recordset(p_mailboxes) as r(id text);

  update public.groups set status = 'drawn', drawn_at = now() where id = p_group;
end $$;

revoke execute on function public.store_draw(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.store_draw(uuid, jsonb, jsonb, jsonb) to service_role;

create or replace function public.undo_draw(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin(p_group) then
    raise exception 'only admins can undo the draw' using errcode = '42501';
  end if;
  delete from public.assignments where group_id = p_group;
  delete from public.mailbox_receivers where group_id = p_group;
  delete from public.mailboxes where group_id = p_group; -- messages cascade
  update public.groups set status = 'open', drawn_at = null where id = p_group;
end $$;

-- Progress now includes gift status counts (still no names).
drop function public.draw_progress(uuid);
create or replace function public.draw_progress(p_group uuid)
returns table (total int, viewed int, bought int, delivered int)
language sql stable security definer set search_path = '' as $$
  select count(*)::int,
         count(viewed_at)::int,
         count(*) filter (where gift_status in ('bought', 'delivered'))::int,
         count(*) filter (where gift_status = 'delivered')::int
  from public.assignments
  where group_id = p_group and private.is_member(p_group);
$$;

revoke execute on function public.draw_progress(uuid) from public, anon;
grant execute on function public.draw_progress(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Mailbox RPCs. Knowing `access` is the permission; group membership is checked too.
-- ---------------------------------------------------------------------------------------------

create or replace function public.mailbox_read(p_access text, p_after bigint default 0)
returns table (id bigint, side text, ciphertext text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.side, m.ciphertext, m.created_at
  from public.mailbox_messages m
  join public.mailboxes b on b.id = m.mailbox_id
  where b.id = encode(sha256(convert_to(p_access, 'UTF8')), 'hex')
    and private.is_member(b.group_id)
    and m.id > coalesce(p_after, 0)
  order by m.id
  limit 500;
$$;

create or replace function public.mailbox_send(p_access text, p_side text, p_ciphertext text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  box public.mailboxes;
  new_id bigint;
begin
  select * into box from public.mailboxes where id = encode(sha256(convert_to(p_access, 'UTF8')), 'hex');
  if box.id is null or not private.is_member(box.group_id) then
    raise exception 'unknown mailbox' using errcode = '42501';
  end if;
  insert into public.mailbox_messages (mailbox_id, side, ciphertext)
  values (box.id, p_side, p_ciphertext)
  returning id into new_id;
  return new_id;
end $$;

revoke execute on function public.mailbox_read(text, bigint), public.mailbox_send(text, text, text) from public, anon;
grant execute on function public.mailbox_read(text, bigint), public.mailbox_send(text, text, text) to authenticated;
