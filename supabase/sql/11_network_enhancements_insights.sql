-- Warp x DoorDash: Network of the Future Portal (V1)
-- Network enhancements: structured "Network insights" tables for the Network view

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.network_enhancements_automation_nodes (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.network_enhancements_views(id) on delete cascade,
  node_type text not null,
  name text not null,
  market text null,
  region text null,
  automation_status text not null,
  notes text null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint network_enhancements_automation_nodes_type_check check (node_type in ('hub','spoke')),
  constraint network_enhancements_automation_nodes_status_check check (automation_status in ('automated','partial','manual'))
);

create table if not exists public.network_enhancements_volume_thresholds (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.network_enhancements_views(id) on delete cascade,
  label text not null,
  changes jsonb not null default '[]'::jsonb,
  implication text null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint network_enhancements_volume_thresholds_changes_check check (
    jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) between 1 and 12
  )
);

create table if not exists public.network_enhancements_coverage_claims (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.network_enhancements_views(id) on delete cascade,
  title text not null,
  statement text not null,
  service_level text null,
  region text null,
  injection text null,
  limitations text null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.network_enhancements_cost_scenarios (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.network_enhancements_views(id) on delete cascade,
  name text not null,
  truck_utilization_pct numeric null,
  middle_mile_cost_per_box numeric null,
  all_in_cost_per_box numeric null,
  last_mile_cost_per_box numeric null,
  first_mile_cost_per_box numeric null,
  hub_sort_cost_per_box numeric null,
  spoke_sort_cost_per_box numeric null,
  dispatch_cost_per_box numeric null,
  notes text null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint network_enhancements_cost_scenarios_utilization_check check (
    truck_utilization_pct is null or (truck_utilization_pct >= 0 and truck_utilization_pct <= 100)
  )
);

create index if not exists network_enhancements_automation_nodes_view_order_idx
  on public.network_enhancements_automation_nodes (view_id, sort_order);

create index if not exists network_enhancements_automation_nodes_view_type_idx
  on public.network_enhancements_automation_nodes (view_id, node_type);

create index if not exists network_enhancements_volume_thresholds_view_order_idx
  on public.network_enhancements_volume_thresholds (view_id, sort_order);

create index if not exists network_enhancements_coverage_claims_view_order_idx
  on public.network_enhancements_coverage_claims (view_id, sort_order);

create index if not exists network_enhancements_cost_scenarios_view_order_idx
  on public.network_enhancements_cost_scenarios (view_id, sort_order);

create or replace function public.handle_network_enhancements_insights_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_network_enhancements_automation_nodes_updated_at on public.network_enhancements_automation_nodes;
create trigger on_network_enhancements_automation_nodes_updated_at
before update on public.network_enhancements_automation_nodes
for each row execute function public.handle_network_enhancements_insights_updated_at();

drop trigger if exists on_network_enhancements_volume_thresholds_updated_at on public.network_enhancements_volume_thresholds;
create trigger on_network_enhancements_volume_thresholds_updated_at
before update on public.network_enhancements_volume_thresholds
for each row execute function public.handle_network_enhancements_insights_updated_at();

drop trigger if exists on_network_enhancements_coverage_claims_updated_at on public.network_enhancements_coverage_claims;
create trigger on_network_enhancements_coverage_claims_updated_at
before update on public.network_enhancements_coverage_claims
for each row execute function public.handle_network_enhancements_insights_updated_at();

drop trigger if exists on_network_enhancements_cost_scenarios_updated_at on public.network_enhancements_cost_scenarios;
create trigger on_network_enhancements_cost_scenarios_updated_at
before update on public.network_enhancements_cost_scenarios
for each row execute function public.handle_network_enhancements_insights_updated_at();

alter table public.network_enhancements_automation_nodes enable row level security;
alter table public.network_enhancements_volume_thresholds enable row level security;
alter table public.network_enhancements_coverage_claims enable row level security;
alter table public.network_enhancements_cost_scenarios enable row level security;

drop policy if exists "Network enhancements insights are readable" on public.network_enhancements_automation_nodes;
create policy "Network enhancements insights are readable"
on public.network_enhancements_automation_nodes
for select
to authenticated
using (
  case
    when to_regprocedure('public.is_portal_member()') is not null then public.is_portal_member()
    else true
  end
);

drop policy if exists "Network enhancements insights are readable" on public.network_enhancements_volume_thresholds;
create policy "Network enhancements insights are readable"
on public.network_enhancements_volume_thresholds
for select
to authenticated
using (
  case
    when to_regprocedure('public.is_portal_member()') is not null then public.is_portal_member()
    else true
  end
);

drop policy if exists "Network enhancements insights are readable" on public.network_enhancements_coverage_claims;
create policy "Network enhancements insights are readable"
on public.network_enhancements_coverage_claims
for select
to authenticated
using (
  case
    when to_regprocedure('public.is_portal_member()') is not null then public.is_portal_member()
    else true
  end
);

drop policy if exists "Network enhancements insights are readable" on public.network_enhancements_cost_scenarios;
create policy "Network enhancements insights are readable"
on public.network_enhancements_cost_scenarios
for select
to authenticated
using (
  case
    when to_regprocedure('public.is_portal_member()') is not null then public.is_portal_member()
    else true
  end
);

drop policy if exists "Admins can insert network enhancements insights" on public.network_enhancements_automation_nodes;
create policy "Admins can insert network enhancements insights"
on public.network_enhancements_automation_nodes
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update network enhancements insights" on public.network_enhancements_automation_nodes;
create policy "Admins can update network enhancements insights"
on public.network_enhancements_automation_nodes
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete network enhancements insights" on public.network_enhancements_automation_nodes;
create policy "Admins can delete network enhancements insights"
on public.network_enhancements_automation_nodes
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert network enhancements insights" on public.network_enhancements_volume_thresholds;
create policy "Admins can insert network enhancements insights"
on public.network_enhancements_volume_thresholds
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update network enhancements insights" on public.network_enhancements_volume_thresholds;
create policy "Admins can update network enhancements insights"
on public.network_enhancements_volume_thresholds
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete network enhancements insights" on public.network_enhancements_volume_thresholds;
create policy "Admins can delete network enhancements insights"
on public.network_enhancements_volume_thresholds
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert network enhancements insights" on public.network_enhancements_coverage_claims;
create policy "Admins can insert network enhancements insights"
on public.network_enhancements_coverage_claims
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update network enhancements insights" on public.network_enhancements_coverage_claims;
create policy "Admins can update network enhancements insights"
on public.network_enhancements_coverage_claims
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete network enhancements insights" on public.network_enhancements_coverage_claims;
create policy "Admins can delete network enhancements insights"
on public.network_enhancements_coverage_claims
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert network enhancements insights" on public.network_enhancements_cost_scenarios;
create policy "Admins can insert network enhancements insights"
on public.network_enhancements_cost_scenarios
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update network enhancements insights" on public.network_enhancements_cost_scenarios;
create policy "Admins can update network enhancements insights"
on public.network_enhancements_cost_scenarios
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete network enhancements insights" on public.network_enhancements_cost_scenarios;
create policy "Admins can delete network enhancements insights"
on public.network_enhancements_cost_scenarios
for delete
to authenticated
using (public.is_admin());

