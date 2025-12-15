-- Warp x DoorDash: Network of the Future Portal (V1)
-- Admin audit log for user invite & access operations.
--
-- Run AFTER:
-- - supabase/sql/00_profiles.sql (public.is_admin)
-- - supabase/sql/04_user_invites.sql (profiles.status + is_portal_member)

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.user_admin_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  metadata jsonb not null default '{}'::jsonb,
  constraint user_admin_audit_action_check check (
    action in (
      'invite_sent',
      'invite_resent',
      'invite_link_generated',
      'invite_cancelled',
      'name_changed',
      'password_reset_sent',
      'password_reset_blocked',
      'password_reset_completed',
      'password_set',
      'role_changed',
      'status_changed',
      'user_deleted'
    )
  )
);

create index if not exists user_admin_audit_created_at_idx
  on public.user_admin_audit (created_at desc);
create index if not exists user_admin_audit_actor_created_at_idx
  on public.user_admin_audit (actor_id, created_at desc);
create index if not exists user_admin_audit_target_user_created_at_idx
  on public.user_admin_audit (target_user_id, created_at desc);
create index if not exists user_admin_audit_target_email_created_at_idx
  on public.user_admin_audit (target_email, created_at desc);

alter table public.user_admin_audit enable row level security;

drop policy if exists "Admins can read user admin audit" on public.user_admin_audit;
create policy "Admins can read user admin audit"
on public.user_admin_audit
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert user admin audit" on public.user_admin_audit;
create policy "Admins can insert user admin audit"
on public.user_admin_audit
for insert
to authenticated
with check (public.is_admin());

-- If the table already existed, make sure the check constraint includes newer action types.
do $$
begin
  if to_regclass('public.user_admin_audit') is not null then
    alter table public.user_admin_audit
      drop constraint if exists user_admin_audit_action_check;
    alter table public.user_admin_audit
      add constraint user_admin_audit_action_check check (
        action in (
          'invite_sent',
          'invite_resent',
          'invite_link_generated',
          'invite_cancelled',
          'name_changed',
          'password_reset_sent',
          'password_reset_blocked',
          'password_reset_completed',
          'password_set',
          'role_changed',
          'status_changed',
          'user_deleted'
        )
      );
  end if;
end $$;
