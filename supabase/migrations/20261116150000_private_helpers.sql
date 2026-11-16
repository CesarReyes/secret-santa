-- Move RLS helpers out of the exposed `public` schema so they aren't callable through /rest/v1/rpc.
-- Policies still need USAGE + EXECUTE for `authenticated`, but `private` is not in the API schemas.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_admin(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;

create or replace function private.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Policies -> private helpers.
alter policy "profiles: self or same group" on public.profiles
  using (id = (select auth.uid()) or private.shares_group(id));
alter policy "groups: members read" on public.groups using (private.is_member(id));
alter policy "groups: admins edit" on public.groups using (private.is_admin(id)) with check (private.is_admin(id));
alter policy "members: members read" on public.group_members using (private.is_member(group_id));

-- RPCs -> private helpers (bodies otherwise unchanged).
create or replace function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user <> auth.uid() and not private.is_admin(p_group) then
    raise exception 'only admins can remove members' using errcode = '42501';
  end if;
  if exists (select 1 from public.groups where id = p_group and status <> 'open') then
    raise exception 'the draw already happened' using errcode = '55000';
  end if;
  delete from public.group_members
  where group_id = p_group and user_id = p_user and role <> 'owner';
end $$;

create or replace function public.add_member_by_username(p_group uuid, p_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not private.is_admin(p_group) then
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

drop function public.is_member(uuid);
drop function public.is_admin(uuid);
drop function public.shares_group(uuid);

-- Platform helper that ended up callable by API roles.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
