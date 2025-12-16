-- Warp x DoorDash: Network of the Future Portal (V1)
-- Extend admin audit log to support SFS rate card operations.
--
-- Run AFTER:
-- - supabase/sql/06_user_admin_audit.sql

-- Add new audit actions for SFS rate card CRUD
do $$
begin
  if to_regclass('public.user_admin_audit') is not null then
    alter table public.user_admin_audit
      drop constraint if exists user_admin_audit_action_check;
    alter table public.user_admin_audit
      add constraint user_admin_audit_action_check check (
        action in (
          -- User management actions
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
          'user_deleted',
          -- SFS rate card actions
          'sfs_rate_card_created',
          'sfs_rate_card_updated',
          'sfs_rate_card_deleted'
        )
      );
  end if;
end $$;

