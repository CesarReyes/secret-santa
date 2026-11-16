-- Amigo Secreto: accounts (username + PIN), groups and memberships.
--
-- Accounts are never created from the client: the `accounts` Edge Function creates them with the
-- service role, using a synthetic email (<username>@usuarios.amigo-secreto.invalid). Everything an
-- admin can do is enforced here with RLS or security-definer RPCs, not only hidden in the UI.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,23}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  emoji text not null default '🎄' check (char_length(emoji) <= 16),
  event_at timestamptz,
  location text check (char_length(location) <= 120),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  budget_min numeric(8, 2) check (budget_min >= 0),
  budget_max numeric(8, 2) check (budget_max >= 0),
  status text not null default 'open' check (status in ('open', 'drawn', 'done')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint budget_range check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user on public.group_members (user_id);

-- Exactly one owner per group.
create unique index group_members_one_owner on public.group_members (group_id) where role = 'owner';

-- ---------------------------------------------------------------------------------------------
-- Helpers. security definer so RLS policies can call them without recursing into group_members.
-- ---------------------------------------------------------------------------------------------

create or replace function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_admin(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "profiles: self or same group" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group(id));
create policy "profiles: edit own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: members read" on public.groups for select to authenticated
  using (public.is_member(id));
create policy "groups: admins edit" on public.groups for update to authenticated
  using (public.is_admin(id)) with check (public.is_admin(id));

create policy "members: members read" on public.group_members for select to authenticated
  using (public.is_member(group_id));

-- Least privilege: the client reads; writes go through column grants or the RPCs below.
revoke all on public.profiles, public.groups, public.group_members from anon, authenticated;
grant select on public.profiles, public.groups, public.group_members to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, emoji, event_at, location, budget_min, budget_max) on public.groups to authenticated;

revoke execute on function public.is_member(uuid), public.is_admin(uuid), public.shares_group(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.shares_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- A signed-in user creates a new group and becomes its owner.
create or replace function public.create_group(
  p_name text,
  p_emoji text default '🎄',
  p_event_at timestamptz default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.groups (name, emoji, event_at, budget_min, budget_max, created_by)
  values (btrim(p_name), coalesce(p_emoji, '🎄'), p_event_at, p_budget_min, p_budget_max, uid)
  returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, uid, 'owner');
  return gid;
end $$;

-- Owner promotes/demotes admins. The owner role itself never moves through here.
create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_role not in ('admin', 'member') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'only the owner can change roles' using errcode = '42501';
  end if;
  update public.group_members set role = p_role
  where group_id = p_group and user_id = p_user and role <> 'owner';
end $$;

-- Admins remove members (never the owner). Anyone can leave a group they don't own.
create or replace function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user <> auth.uid() and not public.is_admin(p_group) then
    raise exception 'only admins can remove members' using errcode = '42501';
  end if;
  if exists (select 1 from public.groups where id = p_group and status <> 'open') then
    raise exception 'the draw already happened' using errcode = '55000';
  end if;
  delete from public.group_members
  where group_id = p_group and user_id = p_user and role <> 'owner';
end $$;

-- Admins add someone who already has an account (same family across several groups).
create or replace function public.add_member_by_username(p_group uuid, p_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not public.is_admin(p_group) then
    raise exception 'only admins can add members' using errcode = '42501';
  end if;
  if exists (select 1 from public.groups where id = p_group and status <> 'open') then
    raise exception 'the draw already happened' using errcode = '55000';
  end if;
  select id into target from public.profiles where username = lower(btrim(p_username));
  if target is null then
    raise exception 'unknown username' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id) values (p_group, target)
  on conflict do nothing;
  return target;
end $$;

revoke execute on function
  public.create_group(text, text, timestamptz, numeric, numeric),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.add_member_by_username(uuid, text)
from public, anon;
grant execute on function
  public.create_group(text, text, timestamptz, numeric, numeric),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.add_member_by_username(uuid, text)
to authenticated;
