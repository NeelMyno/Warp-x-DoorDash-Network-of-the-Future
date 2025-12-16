-- Warp x DoorDash: Network of the Future Portal
-- SFS Rate Cards for Route Economics Calculator
--
-- Run AFTER:
-- - supabase/sql/00_profiles.sql (for is_admin() and is_portal_member())

-- 1) Create the sfs_rate_cards table
create table if not exists public.sfs_rate_cards (
  id uuid primary key default gen_random_uuid(),
  market text not null,
  vehicle_type text not null check (vehicle_type in ('Cargo Van', 'Box Truck')),
  base_cost numeric not null default 0,
  cost_per_mile numeric not null,
  stop_fee numeric not null default 0,
  driver_cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Unique constraint: one rate card per market + vehicle type combination
  constraint sfs_rate_cards_market_vehicle_unique unique (market, vehicle_type)
);

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
-- Authenticated users can read rate cards
drop policy if exists "Authenticated can read rate cards" on public.sfs_rate_cards;
create policy "Authenticated can read rate cards"
on public.sfs_rate_cards
for select
to authenticated
using (true);

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

-- 5) Seed 10 markets x 2 vehicles = 20 rate cards
-- Uses upsert so migration is idempotent (safe to re-run)
insert into public.sfs_rate_cards (market, vehicle_type, base_cost, cost_per_mile, stop_fee, driver_cost)
values
  -- Chicago (spec reference)
  ('Chicago', 'Cargo Van', 0, 0.85, 0, 315),
  ('Chicago', 'Box Truck', 0, 1.40, 0, 450),
  -- Dallas (lower cost)
  ('Dallas', 'Cargo Van', 0, 0.80, 0, 300),
  ('Dallas', 'Box Truck', 0, 1.30, 0, 430),
  -- Los Angeles (higher cost)
  ('Los Angeles', 'Cargo Van', 0, 1.05, 0, 360),
  ('Los Angeles', 'Box Truck', 0, 1.65, 0, 520),
  -- New York City (highest cost)
  ('New York City', 'Cargo Van', 0, 1.20, 0, 420),
  ('New York City', 'Box Truck', 0, 1.95, 0, 600),
  -- Atlanta
  ('Atlanta', 'Cargo Van', 0, 0.82, 0, 305),
  ('Atlanta', 'Box Truck', 0, 1.32, 0, 440),
  -- Seattle (higher cost)
  ('Seattle', 'Cargo Van', 0, 1.10, 0, 390),
  ('Seattle', 'Box Truck', 0, 1.75, 0, 540),
  -- Miami
  ('Miami', 'Cargo Van', 0, 0.90, 0, 330),
  ('Miami', 'Box Truck', 0, 1.50, 0, 480),
  -- Denver
  ('Denver', 'Cargo Van', 0, 0.95, 0, 345),
  ('Denver', 'Box Truck', 0, 1.55, 0, 500),
  -- Phoenix (lower cost)
  ('Phoenix', 'Cargo Van', 0, 0.78, 0, 290),
  ('Phoenix', 'Box Truck', 0, 1.25, 0, 410),
  -- Boston (higher cost)
  ('Boston', 'Cargo Van', 0, 1.15, 0, 410),
  ('Boston', 'Box Truck', 0, 1.85, 0, 580)
on conflict (market, vehicle_type) do update set
  base_cost = excluded.base_cost,
  cost_per_mile = excluded.cost_per_mile,
  stop_fee = excluded.stop_fee,
  driver_cost = excluded.driver_cost,
  updated_at = now();

