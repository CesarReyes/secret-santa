-- Member management: who still has a temporary PIN, renaming members, deleting a group.

-- Mirrors app_metadata.must_change_pin so group mates (and the draw) can see who hasn't
-- signed in yet. Only the `accounts` Edge Function (service role) writes it.
alter table public.profiles add column pin_pending boolean not null default false;

-- Admins rename people of lower rank in their group. A profile is shared across groups, so
-- nobody renames someone who runs another group.
create or replace function public.rename_member(p_group uuid, p_user uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  my_role text;
  their_role text;
  rank constant jsonb := '{"member": 0, "admin": 1, "owner": 2}';
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    update public.profiles set display_name = btrim(p_name) where id = p_user;
    return;
  end if;
  select role into my_role from public.group_members where group_id = p_group and user_id = auth.uid();
  select role into their_role from public.group_members where group_id = p_group and user_id = p_user;
  if my_role is null or my_role = 'member' or their_role is null
     or (rank ->> their_role)::int >= (rank ->> my_role)::int then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.group_members
    where user_id = p_user and group_id <> p_group and role in ('owner', 'admin')
  ) then
    raise exception 'runs another group' using errcode = '42501';
  end if;
  update public.profiles set display_name = btrim(p_name) where id = p_user;
end $$;

-- Only the owner deletes a group (memberships cascade).
create or replace function public.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'only the owner can delete the group' using errcode = '42501';
  end if;
  delete from public.groups where id = p_group;
end $$;

revoke execute on function public.rename_member(uuid, uuid, text), public.delete_group(uuid) from public, anon;
grant execute on function public.rename_member(uuid, uuid, text), public.delete_group(uuid) to authenticated;
