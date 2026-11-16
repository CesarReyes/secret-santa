-- The secret draw: per-person keys, exclusions and sealed assignments.
--
-- The database never holds "who gives to whom" in clear. Each assignment row is the giver's id
-- plus a ciphertext only the giver's private key opens. Private keys live on devices; the backup
-- here is encrypted with the person's PIN and a pepper that lives in Edge Function secrets.

alter table public.groups add column drawn_at timestamptz;

-- Public keys: group mates (and the draw function) may read them; that's what public keys are for.
create table public.user_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  public_key text not null,
  key_id text not null,
  updated_at timestamptz not null default now()
);

-- Encrypted private-key backups: only their owner reads or writes them.
create table public.key_backups (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  salt text not null,
  iv text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

-- Pairs that never give to each other (either direction). Stored with a < b.
create table public.exclusions (
  group_id uuid not null,
  a uuid not null,
  b uuid not null,
  primary key (group_id, a, b),
  check (a < b),
  foreign key (group_id, a) references public.group_members(group_id, user_id) on delete cascade,
  foreign key (group_id, b) references public.group_members(group_id, user_id) on delete cascade
);

create table public.assignments (
  group_id uuid not null,
  giver_id uuid not null,
  ciphertext text not null,
  key_id text not null,
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  primary key (group_id, giver_id),
  foreign key (group_id, giver_id) references public.group_members(group_id, user_id) on delete cascade
);

alter table public.user_keys enable row level security;
alter table public.key_backups enable row level security;
alter table public.exclusions enable row level security;
alter table public.assignments enable row level security;

create policy "keys: own or same group" on public.user_keys for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_group(user_id));
create policy "keys: write own" on public.user_keys for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "keys: update own" on public.user_keys for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "backups: own" on public.key_backups for select to authenticated
  using (user_id = (select auth.uid()));
create policy "backups: write own" on public.key_backups for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "backups: update own" on public.key_backups for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "exclusions: members read" on public.exclusions for select to authenticated
  using (private.is_member(group_id));
create policy "exclusions: admins add while open" on public.exclusions for insert to authenticated
  with check (
    private.is_admin(group_id)
    and exists (select 1 from public.groups g where g.id = group_id and g.status = 'open')
  );
create policy "exclusions: admins remove while open" on public.exclusions for delete to authenticated
  using (
    private.is_admin(group_id)
    and exists (select 1 from public.groups g where g.id = group_id and g.status = 'open')
  );

-- Only the giver ever sees their row. Nobody can insert from the client: the draw function does.
create policy "assignments: own" on public.assignments for select to authenticated
  using (giver_id = (select auth.uid()));
create policy "assignments: mark viewed" on public.assignments for update to authenticated
  using (giver_id = (select auth.uid())) with check (giver_id = (select auth.uid()));

revoke all on public.user_keys, public.key_backups, public.exclusions, public.assignments from anon, authenticated;
grant select, insert, update on public.user_keys, public.key_backups to authenticated;
grant select, insert, delete on public.exclusions to authenticated;
grant select on public.assignments to authenticated;
grant update (viewed_at) on public.assignments to authenticated;

-- Atomic write of a draw: replace assignments and mark the group. Service role only.
create or replace function public.store_draw(p_group uuid, p_rows jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.assignments where group_id = p_group;
  insert into public.assignments (group_id, giver_id, ciphertext, key_id)
  select p_group, r.giver_id, r.ciphertext, r.key_id
  from jsonb_to_recordset(p_rows) as r(giver_id uuid, ciphertext text, key_id text);
  update public.groups set status = 'drawn', drawn_at = now() where id = p_group;
end $$;

revoke execute on function public.store_draw(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_draw(uuid, jsonb) to service_role;

-- Admins undo a draw: assignments are gone for good and the group can be edited again.
create or replace function public.undo_draw(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin(p_group) then
    raise exception 'only admins can undo the draw' using errcode = '42501';
  end if;
  delete from public.assignments where group_id = p_group;
  update public.groups set status = 'open', drawn_at = null where id = p_group;
end $$;

revoke execute on function public.undo_draw(uuid) from public, anon;
grant execute on function public.undo_draw(uuid) to authenticated;

-- How many have opened their assignment, without saying who has whom.
create or replace function public.draw_progress(p_group uuid) returns table (total int, viewed int)
language sql stable security definer set search_path = '' as $$
  select count(*)::int, count(viewed_at)::int
  from public.assignments
  where group_id = p_group and private.is_member(p_group);
$$;

revoke execute on function public.draw_progress(uuid) from public, anon;
grant execute on function public.draw_progress(uuid) to authenticated;
