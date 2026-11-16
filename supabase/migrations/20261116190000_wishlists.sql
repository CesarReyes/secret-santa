-- Wishlists: one list per person (shared by all their groups), visible to anyone who shares a
-- group with them. Photos live in a private Storage bucket under <owner_id>/...

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  note text check (char_length(note) <= 1000),
  url text check (url ~* '^https?://' and char_length(url) <= 2000),
  price numeric(8, 2) check (price >= 0),
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 mucho, 2 bastante, 3 detalle
  preview jsonb,
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlist_items_user on public.wishlist_items (user_id, priority, created_at);

alter table public.wishlist_items enable row level security;

create policy "wishlist: own or same group" on public.wishlist_items for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_group(user_id));
create policy "wishlist: add own" on public.wishlist_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "wishlist: edit own" on public.wishlist_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "wishlist: delete own" on public.wishlist_items for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.wishlist_items from anon, authenticated;
grant select, insert, update, delete on public.wishlist_items to authenticated;

-- Photos must sit in the owner's folder: <owner_id>/<uuid>.(jpg|webp). Also bumps updated_at.
create or replace function private.check_wishlist_photos() returns trigger
language plpgsql set search_path = '' as $$
declare
  p text;
begin
  foreach p in array new.photos loop
    if split_part(p, '/', 1) <> new.user_id::text or p !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$' then
      raise exception 'invalid photo path' using errcode = '22023';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;

create trigger wishlist_items_photos before insert or update on public.wishlist_items
  for each row execute function private.check_wishlist_photos();

-- ---------------------------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wishlist', 'wishlist', false, 2 * 1024 * 1024, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "wishlist photos: read own or same group" on storage.objects for select to authenticated
  using (
    bucket_id = 'wishlist'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and private.shares_group(((storage.foldername(name))[1])::uuid)
      )
    )
  );
create policy "wishlist photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "wishlist photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'wishlist' and (storage.foldername(name))[1] = (select auth.uid())::text);
