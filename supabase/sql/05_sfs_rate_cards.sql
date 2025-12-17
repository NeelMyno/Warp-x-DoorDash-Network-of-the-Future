-- Warp x DoorDash: Network of the Future Portal
-- SFS Rate Cards for Route Economics Calculator
--
-- Run AFTER:
-- - supabase/sql/00_profiles.sql (for is_admin() and is_portal_member())

-- NOTE:
-- This migration replaces the older market-based rate cards with the PDF v2 model:
-- - One row per vehicle type (no market column)
-- - Fields: base_fee, per_mile_rate, per_stop_rate
-- - Seeded with exactly 2 vehicle types from docs/calc/SFS calculator 1.pdf

-- 1) Ensure the sfs_rate_cards table exists with the v2 schema.
do $$
declare
  has_market boolean;
begin
  if to_regclass('public.sfs_rate_cards') is null then
    create table public.sfs_rate_cards (
      id uuid primary key default gen_random_uuid(),
      vehicle_type text not null,
      base_fee numeric not null default 0,
      per_mile_rate numeric not null default 0,
      per_stop_rate numeric not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint sfs_rate_cards_vehicle_type_check check (
        vehicle_type in ('Cargo Van', '26'' Box Truck')
      ),
      constraint sfs_rate_cards_vehicle_type_unique unique (vehicle_type)
    );
  else
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sfs_rate_cards'
        and column_name = 'market'
    ) into has_market;

    -- Drop old constraints if present.
    alter table public.sfs_rate_cards
      drop constraint if exists sfs_rate_cards_market_vehicle_unique,
      drop constraint if exists sfs_rate_cards_vehicle_type_check,
      drop constraint if exists sfs_rate_cards_vehicle_type_unique;

    -- If migrating from the legacy schema (market-based), drop legacy columns and clear old rows
    -- (otherwise a unique(vehicle_type) constraint would fail due to many duplicate rows).
    if has_market then
      alter table public.sfs_rate_cards
        drop column if exists market,
        drop column if exists base_cost,
        drop column if exists cost_per_mile,
        drop column if exists stop_fee,
        drop column if exists driver_cost;

      execute 'truncate table public.sfs_rate_cards';
    end if;

    -- Ensure v2 columns exist.
    alter table public.sfs_rate_cards
      add column if not exists base_fee numeric not null default 0,
      add column if not exists per_mile_rate numeric not null default 0,
      add column if not exists per_stop_rate numeric not null default 0,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();

    alter table public.sfs_rate_cards
      alter column vehicle_type set not null;

    -- Re-apply v2 constraints.
    alter table public.sfs_rate_cards
      add constraint sfs_rate_cards_vehicle_type_check check (
        vehicle_type in ('Cargo Van', '26'' Box Truck')
      ),
      add constraint sfs_rate_cards_vehicle_type_unique unique (vehicle_type);
  end if;
end $$;

-- 2) Trigger for updated_at
create or replace function public.handle_sfs_rate_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_sfs_rate_cards_updated_at on public.sfs_rate_cards;
create trigger on_sfs_rate_cards_updated_at
before update on public.sfs_rate_cards
for each row execute function public.handle_sfs_rate_cards_updated_at();

-- 3) Enable RLS
alter table public.sfs_rate_cards enable row level security;

-- 4) RLS Policies
-- Portal members can read rate cards (falls back to authenticated if is_portal_member() isn't present)
drop policy if exists "Portal members can read rate cards" on public.sfs_rate_cards;
do $$
begin
  if to_regprocedure('public.is_portal_member()') is not null then
    execute 'create policy "Portal members can read rate cards" on public.sfs_rate_cards for select to authenticated using (public.is_portal_member())';
  else
    execute 'create policy "Portal members can read rate cards" on public.sfs_rate_cards for select to authenticated using (true)';
  end if;
end $$;

-- Admins can insert rate cards
drop policy if exists "Admins can insert rate cards" on public.sfs_rate_cards;
create policy "Admins can insert rate cards"
on public.sfs_rate_cards
for insert
to authenticated
with check (public.is_admin());

-- Admins can update rate cards
drop policy if exists "Admins can update rate cards" on public.sfs_rate_cards;
create policy "Admins can update rate cards"
on public.sfs_rate_cards
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Admins can delete rate cards
drop policy if exists "Admins can delete rate cards" on public.sfs_rate_cards;
create policy "Admins can delete rate cards"
on public.sfs_rate_cards
for delete
to authenticated
using (public.is_admin());

-- 5) Seed v2 rate values (exactly as defined in the PDF).
-- Uses upsert so migration is idempotent (safe to re-run).
insert into public.sfs_rate_cards (vehicle_type, base_fee, per_mile_rate, per_stop_rate)
values
  ('Cargo Van', 95, 1.50, 20),
  ('26'' Box Truck', 175, 2.20, 50)
on conflict (vehicle_type) do update set
  base_fee = excluded.base_fee,
  per_mile_rate = excluded.per_mile_rate,
  per_stop_rate = excluded.per_stop_rate,
  updated_at = now();
