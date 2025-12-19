-- Warp x DoorDash: Network of the Future Portal
-- SFS Calculator V3 - Density Discount Tiers (admin-managed)
--
-- Run AFTER:
-- - supabase/sql/00_profiles.sql (for is_admin() and is_portal_member())

-- 1) Table
do $$
begin
  if to_regclass('public.sfs_density_discount_tiers') is null then
    create table public.sfs_density_discount_tiers (
      id uuid primary key default gen_random_uuid(),
      sort_order int not null,
      min_miles double precision not null,
      max_miles double precision null,
      discount_pct double precision not null,
      label text null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint sfs_density_tiers_discount_pct_check check (discount_pct >= 0 and discount_pct <= 0.5),
      constraint sfs_density_tiers_min_miles_check check (min_miles >= 0),
      constraint sfs_density_tiers_max_miles_check check (max_miles is null or max_miles > min_miles),
      constraint sfs_density_tiers_sort_order_unique unique (sort_order)
    );
  else
    alter table public.sfs_density_discount_tiers
      add column if not exists sort_order int not null default 1,
      add column if not exists min_miles double precision not null default 0,
      add column if not exists max_miles double precision null,
      add column if not exists discount_pct double precision not null default 0,
      add column if not exists label text null,
      add column if not exists is_active boolean not null default true,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  end if;
end $$;

-- Ensure constraints exist (safe to re-run)
alter table public.sfs_density_discount_tiers
  drop constraint if exists sfs_density_tiers_discount_pct_check,
  drop constraint if exists sfs_density_tiers_min_miles_check,
  drop constraint if exists sfs_density_tiers_max_miles_check,
  drop constraint if exists sfs_density_tiers_sort_order_unique;

alter table public.sfs_density_discount_tiers
  add constraint sfs_density_tiers_discount_pct_check check (discount_pct >= 0 and discount_pct <= 0.5),
  add constraint sfs_density_tiers_min_miles_check check (min_miles >= 0),
  add constraint sfs_density_tiers_max_miles_check check (max_miles is null or max_miles > min_miles),
  add constraint sfs_density_tiers_sort_order_unique unique (sort_order);

-- 2) Indexes
create index if not exists sfs_density_discount_tiers_sort_idx on public.sfs_density_discount_tiers (sort_order);
create index if not exists sfs_density_discount_tiers_is_active_idx on public.sfs_density_discount_tiers (is_active);

-- 3) updated_at trigger
create or replace function public.handle_sfs_density_discount_tiers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_sfs_density_discount_tiers_updated_at on public.sfs_density_discount_tiers;
create trigger on_sfs_density_discount_tiers_updated_at
before update on public.sfs_density_discount_tiers
for each row execute function public.handle_sfs_density_discount_tiers_updated_at();

-- 4) RLS
alter table public.sfs_density_discount_tiers enable row level security;

-- Portal members can read active tiers (fallback to authenticated if is_portal_member() isn't present)
drop policy if exists "Portal members can read active sfs density tiers" on public.sfs_density_discount_tiers;
do $$
begin
  if to_regprocedure('public.is_portal_member()') is not null then
    execute 'create policy "Portal members can read active sfs density tiers" on public.sfs_density_discount_tiers for select to authenticated using (public.is_portal_member() and is_active = true)';
  else
    execute 'create policy "Portal members can read active sfs density tiers" on public.sfs_density_discount_tiers for select to authenticated using (is_active = true)';
  end if;
end $$;

-- Admin write policies
drop policy if exists "Admins can insert sfs density tiers" on public.sfs_density_discount_tiers;
create policy "Admins can insert sfs density tiers"
on public.sfs_density_discount_tiers
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update sfs density tiers" on public.sfs_density_discount_tiers;
create policy "Admins can update sfs density tiers"
on public.sfs_density_discount_tiers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete sfs density tiers" on public.sfs_density_discount_tiers;
create policy "Admins can delete sfs density tiers"
on public.sfs_density_discount_tiers
for delete
to authenticated
using (public.is_admin());

-- 5) Seed default tiers (idempotent)
-- Default bands: 0–10 (20%), 10–20 (12%), 20–30 (6%), 30+ (0%).
insert into public.sfs_density_discount_tiers (sort_order, min_miles, max_miles, discount_pct, label, is_active)
values
  (1, 0, 10, 0.20, '0–10 mi', true),
  (2, 10, 20, 0.12, '10–20 mi', true),
  (3, 20, 30, 0.06, '20–30 mi', true),
  (4, 30, null, 0.00, '30+ mi', true)
on conflict (sort_order) do update set
  min_miles = excluded.min_miles,
  max_miles = excluded.max_miles,
  discount_pct = excluded.discount_pct,
  label = excluded.label,
  is_active = excluded.is_active,
  updated_at = now();
