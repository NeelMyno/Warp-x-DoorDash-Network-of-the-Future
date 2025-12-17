-- Warp x DoorDash: Network of the Future Portal (V1)
-- Network enhancements (Hub / Spoke / Network) content store

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.network_enhancements_views (
  id uuid primary key default gen_random_uuid(),
  sub text not null,
  variant text null,
  diagram_asset_id uuid null references public.assets(id) on delete set null,
  pdf_asset_id uuid null references public.assets(id) on delete set null,
  network_highlights_md text null,
  network_thresholds jsonb null,
  network_coverage_md text null,
  network_cost_model jsonb null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint network_enhancements_views_sub_check check (sub in ('hub','spoke','network')),
  constraint network_enhancements_views_variant_check check (variant is null or variant in ('example','future')),
  constraint network_enhancements_views_variant_network_check check (
    (sub = 'network' and variant is null) or (sub in ('hub','spoke') and variant is not null)
  ),
  constraint network_enhancements_views_unique unique (sub, variant)
);

-- Postgres UNIQUE allows multiple NULLs, so (sub, variant) does not prevent
-- multiple ('network', NULL) rows. Add a partial unique index for the network row.
create unique index if not exists network_enhancements_views_network_unique
  on public.network_enhancements_views (sub)
  where sub = 'network';

create or replace function public.handle_network_enhancements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_network_enhancements_updated_at on public.network_enhancements_views;
create trigger on_network_enhancements_updated_at
before update on public.network_enhancements_views
for each row execute function public.handle_network_enhancements_updated_at();

alter table public.network_enhancements_views enable row level security;

drop policy if exists "Network enhancements are readable" on public.network_enhancements_views;
create policy "Network enhancements are readable"
on public.network_enhancements_views
for select
to authenticated
using (
  case
    when to_regprocedure('public.is_portal_member()') is not null then public.is_portal_member()
    else true
  end
);

drop policy if exists "Admins can insert network enhancements" on public.network_enhancements_views;
create policy "Admins can insert network enhancements"
on public.network_enhancements_views
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update network enhancements" on public.network_enhancements_views;
create policy "Admins can update network enhancements"
on public.network_enhancements_views
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete network enhancements" on public.network_enhancements_views;
create policy "Admins can delete network enhancements"
on public.network_enhancements_views
for delete
to authenticated
using (public.is_admin());

-- Seed rows so /m/network-enhancements always has something to resolve.
insert into public.network_enhancements_views (sub, variant)
values
  ('hub', 'example'),
  ('hub', 'future'),
  ('spoke', 'example'),
  ('spoke', 'future')
on conflict (sub, variant) do nothing;

insert into public.network_enhancements_views (sub, variant)
select 'network', null
where not exists (
  select 1 from public.network_enhancements_views where sub = 'network'
);
