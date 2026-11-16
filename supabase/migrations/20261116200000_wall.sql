-- Group wall: short posts with emoji reactions, live via Realtime.
-- Members read and write; authors delete their own posts and admins can moderate.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index posts_group_created on public.posts (group_id, created_at desc);

create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('🎄', '❤️', '😂', '🎁', '👏')),
  group_id uuid not null references public.groups(id) on delete cascade, -- denormalized for RLS and Realtime filters
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index post_reactions_group on public.post_reactions (group_id);

-- Keep the reaction's group in sync with its post (clients can't point it elsewhere).
create or replace function private.reaction_group() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select group_id into new.group_id from public.posts where id = new.post_id;
  return new;
end $$;
create trigger post_reactions_group before insert on public.post_reactions
  for each row execute function private.reaction_group();

alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;

create policy "posts: members read" on public.posts for select to authenticated
  using (private.is_member(group_id));
create policy "posts: members write as themselves" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_member(group_id));
create policy "posts: author or admin deletes" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin(group_id));

create policy "reactions: members read" on public.post_reactions for select to authenticated
  using (private.is_member(group_id));
create policy "reactions: react as myself" on public.post_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(group_id));
create policy "reactions: remove mine" on public.post_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.posts, public.post_reactions from anon, authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select, insert, delete on public.post_reactions to authenticated;

-- Realtime: deletes need the full old row so subscribers can filter by group.
alter table public.posts replica identity full;
alter table public.post_reactions replica identity full;
alter publication supabase_realtime add table public.posts, public.post_reactions;
