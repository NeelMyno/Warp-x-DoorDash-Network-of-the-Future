-- Warp x DoorDash: Network of the Future Portal
-- SFS Calculator V3 - Store Locations (admin-managed)
--
-- Run AFTER:
-- - supabase/sql/00_profiles.sql (for is_admin() and is_portal_member())

-- 1) Table
do $$
begin
  if to_regclass('public.sfs_store_locations') is null then
    create table public.sfs_store_locations (
      store_id text primary key,
      store_name text null,
      market text null,
      lat double precision not null,
      lon double precision not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  else
    alter table public.sfs_store_locations
      add column if not exists store_name text null,
      add column if not exists market text null,
      add column if not exists lat double precision not null default 0,
      add column if not exists lon double precision not null default 0,
      add column if not exists is_active boolean not null default true,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();

    alter table public.sfs_store_locations
      alter column store_id set not null,
      alter column lat set not null,
      alter column lon set not null,
      alter column is_active set not null;
  end if;
end $$;

-- 2) Indexes
create index if not exists sfs_store_locations_market_idx on public.sfs_store_locations (market);
create index if not exists sfs_store_locations_is_active_idx on public.sfs_store_locations (is_active);

-- 3) updated_at trigger
create or replace function public.handle_sfs_store_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_sfs_store_locations_updated_at on public.sfs_store_locations;
create trigger on_sfs_store_locations_updated_at
before update on public.sfs_store_locations
for each row execute function public.handle_sfs_store_locations_updated_at();

-- 4) RLS
alter table public.sfs_store_locations enable row level security;

-- Portal members can read active store locations (fallback to authenticated if is_portal_member() isn't present)
drop policy if exists "Portal members can read active sfs store locations" on public.sfs_store_locations;
do $$
begin
  if to_regprocedure('public.is_portal_member()') is not null then
    execute 'create policy "Portal members can read active sfs store locations" on public.sfs_store_locations for select to authenticated using (public.is_portal_member() and is_active = true)';
  else
    execute 'create policy "Portal members can read active sfs store locations" on public.sfs_store_locations for select to authenticated using (is_active = true)';
  end if;
end $$;

-- Admin write policies
drop policy if exists "Admins can insert sfs store locations" on public.sfs_store_locations;
create policy "Admins can insert sfs store locations"
on public.sfs_store_locations
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update sfs store locations" on public.sfs_store_locations;
create policy "Admins can update sfs store locations"
on public.sfs_store_locations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete sfs store locations" on public.sfs_store_locations;
create policy "Admins can delete sfs store locations"
on public.sfs_store_locations
for delete
to authenticated
using (public.is_admin());

