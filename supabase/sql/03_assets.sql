-- Warp x DoorDash: Network of the Future Portal (V1)
-- Asset library (Supabase Storage + DB index) for diagrams, maps, screenshots.
--
-- Requires:
-- - `supabase/sql/00_profiles.sql` (profiles + public.is_admin())

create extension if not exists "pgcrypto" with schema extensions;

-- 1) Storage bucket (private)
-- Note: Some Supabase projects restrict direct writes to `storage.buckets`.
-- If this block emits a NOTICE (or you still don't see the bucket), create it manually:
--   Storage → Buckets → New bucket
--     name/id: portal-assets
--     public: false
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('portal-assets', 'portal-assets', false)
  on conflict (id) do update set public = false;
exception
  when insufficient_privilege then
    raise notice 'Skipping bucket create/update: insufficient privileges. Create the private bucket "portal-assets" in the Supabase dashboard.';
  when undefined_table then
    raise notice 'Skipping bucket create/update: storage.buckets not found. Create the private bucket "portal-assets" in the Supabase dashboard.';
end $$;

-- 2) Assets index table
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  filename text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  notes text
);

alter table public.assets enable row level security;

drop policy if exists "Authenticated can read assets" on public.assets;
create policy "Authenticated can read assets"
on public.assets
for select
to authenticated
using (true);

drop policy if exists "Admins can insert assets" on public.assets;
create policy "Admins can insert assets"
on public.assets
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update assets" on public.assets;
create policy "Admins can update assets"
on public.assets
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete assets" on public.assets;
create policy "Admins can delete assets"
on public.assets
for delete
to authenticated
using (public.is_admin());

create index if not exists assets_uploaded_at_idx on public.assets (uploaded_at desc);
create index if not exists assets_filename_idx on public.assets (filename);

-- 3) Storage object policies (bucket remains private; access is via signed URLs)
-- We gate read access to authenticated users and write access to admins.
-- Important: Many Supabase projects don't allow policy DDL on `storage.objects` from the SQL editor
-- (e.g. ERROR: must be owner of table objects). If that happens, set up these policies in the
-- Supabase dashboard instead:
--
-- 1) SELECT (download/view) for authenticated:
--    using (bucket_id = 'portal-assets')
-- 2) INSERT/UPDATE/DELETE for admins:
--    using/with check (bucket_id = 'portal-assets' and public.is_admin())
do $$
begin
  alter table storage.objects enable row level security;

  drop policy if exists "Authenticated can read portal assets" on storage.objects;
  create policy "Authenticated can read portal assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'portal-assets');

  drop policy if exists "Admins can upload portal assets" on storage.objects;
  create policy "Admins can upload portal assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'portal-assets' and public.is_admin());

  drop policy if exists "Admins can update portal assets" on storage.objects;
  create policy "Admins can update portal assets"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'portal-assets' and public.is_admin())
  with check (bucket_id = 'portal-assets' and public.is_admin());

  drop policy if exists "Admins can delete portal assets" on storage.objects;
  create policy "Admins can delete portal assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'portal-assets' and public.is_admin());
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects policies: insufficient privileges. Create the Storage policies in the Supabase dashboard (see comments in this file).';
  when undefined_table then
    raise notice 'Skipping storage.objects policies: storage.objects not found. Ensure Storage is enabled in Supabase and create the policies in the dashboard.';
end $$;
