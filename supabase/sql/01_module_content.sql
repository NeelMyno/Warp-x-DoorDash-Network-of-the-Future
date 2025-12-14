-- Warp x DoorDash: Network of the Future Portal (V1)
-- Module section content storage (draft + published) with admin-only writes.

create extension if not exists "pgcrypto" with schema extensions;

-- Ensure admin helper exists (used by RLS policies).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create table if not exists public.module_sections (
  id uuid primary key default gen_random_uuid(),
  module_slug text not null,
  section_key text not null,
  status text not null default 'draft',
  blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint module_sections_section_key_check check (
    section_key in ('end-vision', 'progress', 'roadmap')
  ),
  constraint module_sections_status_check check (
    status in ('draft', 'published')
  ),
  constraint module_sections_unique unique (module_slug, section_key, status)
);

create or replace function public.handle_module_sections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_module_sections_updated_at on public.module_sections;
create trigger on_module_sections_updated_at
before update on public.module_sections
for each row execute function public.handle_module_sections_updated_at();

create index if not exists module_sections_lookup_idx
on public.module_sections (module_slug, section_key, status);

create or replace view public.published_module_sections as
  select *
  from public.module_sections
  where status = 'published';

alter table public.module_sections enable row level security;

drop policy if exists "Published module sections are readable" on public.module_sections;
create policy "Published module sections are readable"
on public.module_sections
for select
to authenticated
using (status = 'published');

drop policy if exists "Admins can read module section drafts" on public.module_sections;
create policy "Admins can read module section drafts"
on public.module_sections
for select
to authenticated
using (status = 'draft' and public.is_admin());

drop policy if exists "Admins can insert module sections" on public.module_sections;
create policy "Admins can insert module sections"
on public.module_sections
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update module sections" on public.module_sections;
create policy "Admins can update module sections"
on public.module_sections
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete module sections" on public.module_sections;
create policy "Admins can delete module sections"
on public.module_sections
for delete
to authenticated
using (public.is_admin());

