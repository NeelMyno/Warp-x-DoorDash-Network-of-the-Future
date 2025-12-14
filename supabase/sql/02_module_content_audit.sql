-- Warp x DoorDash: Network of the Future Portal (V1)
-- Module content audit log (draft/published snapshots) for admin-only review + restore.

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.module_section_audit (
  id uuid primary key default gen_random_uuid(),
  module_slug text not null,
  section_key text not null,
  status text not null,
  action text not null,
  blocks jsonb not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now(),
  constraint module_section_audit_section_key_check check (
    section_key in ('end-vision', 'progress', 'roadmap')
  ),
  constraint module_section_audit_status_check check (
    status in ('draft', 'published')
  ),
  constraint module_section_audit_action_check check (
    action in ('save_draft', 'publish', 'restore')
  )
);

create index if not exists module_section_audit_module_section_created_idx
on public.module_section_audit (module_slug, section_key, created_at desc);

create index if not exists module_section_audit_actor_created_idx
on public.module_section_audit (actor_id, created_at desc);

alter table public.module_section_audit enable row level security;

drop policy if exists "Admins can read module audit" on public.module_section_audit;
create policy "Admins can read module audit"
on public.module_section_audit
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert module audit" on public.module_section_audit;
create policy "Admins can insert module audit"
on public.module_section_audit
for insert
to authenticated
with check (public.is_admin());