-- Warp x DoorDash: Network of the Future Portal (V1)
-- Module section content storage with admin-only writes.

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
  blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint module_sections_section_key_check check (
    section_key in ('end-vision', 'progress', 'roadmap')
  ),
  constraint module_sections_unique unique (module_slug, section_key)
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
on public.module_sections (module_slug, section_key);

alter table public.module_sections enable row level security;

drop policy if exists "Module sections are readable" on public.module_sections;
create policy "Module sections are readable"
on public.module_sections
for select
to authenticated
using (true);

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
