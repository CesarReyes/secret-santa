-- Lets PostgREST embed profiles in group_members (select=..., profiles(...)).
-- Every account gets its profile in the same Edge Function call, so the FK always holds.
alter table public.group_members
  add constraint group_members_profile_fk foreign key (user_id) references public.profiles(id) on delete cascade;
