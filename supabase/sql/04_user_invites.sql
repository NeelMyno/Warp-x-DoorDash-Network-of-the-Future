-- Warp x DoorDash: Network of the Future Portal (V1)
-- Admin-managed invites + portal membership gating
--
-- Run AFTER:
-- - supabase/sql/00_profiles.sql
-- - supabase/sql/01_module_content.sql
-- - supabase/sql/03_assets.sql

-- 1) Extend public.profiles for invite lifecycle + user management.
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists status text not null default 'active',
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists disabled_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'invited', 'disabled'));

-- Best-effort backfill email from auth.users.
update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id and p.email is null and u.email is not null;

-- Unique email (case-insensitive) where email is present.
create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

-- Keep email populated for new auth users (best-effort).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email);
  return new;
end;
$$;

-- 2) Portal membership helper (used by RLS policies).
create or replace function public.is_portal_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status <> 'disabled'
  );
$$;

-- 3) Profiles RLS additions:
-- - Admins can update any profile
-- - Owners can update their own profile in a tightly-scoped way
drop policy if exists "Admins can insert profiles" on public.profiles;
create policy "Admins can insert profiles"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Profile owners can update limited fields" on public.profiles;
create policy "Profile owners can update limited fields"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and coalesce(email, '') = coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')
  and coalesce(invited_at::text, '') = coalesce((select p.invited_at::text from public.profiles p where p.id = auth.uid()), '')
  and coalesce(invited_by::text, '') = coalesce((select p.invited_by::text from public.profiles p where p.id = auth.uid()), '')
  and coalesce(disabled_at::text, '') = coalesce((select p.disabled_at::text from public.profiles p where p.id = auth.uid()), '')
  and (
    status = (select p.status from public.profiles p where p.id = auth.uid())
    or (
      (select p.status from public.profiles p where p.id = auth.uid()) = 'invited'
      and status = 'active'
    )
  )
);

-- 4) Tighten existing policies to require portal membership (profile exists + not disabled).
do $$
begin
  if to_regclass('public.module_sections') is not null then
    drop policy if exists "Published module sections are readable" on public.module_sections;
    create policy "Published module sections are readable"
    on public.module_sections
    for select
    to authenticated
    using (status = 'published' and public.is_portal_member());
  end if;

  if to_regclass('public.assets') is not null then
    drop policy if exists "Authenticated can read assets" on public.assets;
    create policy "Authenticated can read assets"
    on public.assets
    for select
    to authenticated
    using (public.is_portal_member());
  end if;
end $$;

-- Note: Storage policies on storage.objects are often managed in the Supabase dashboard.
-- If you're creating them manually, consider adding public.is_portal_member() to the SELECT policy.
