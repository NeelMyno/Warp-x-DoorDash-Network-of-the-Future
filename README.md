# Warp x DoorDash: Network of the Future Portal (V1)

Private, authenticated SaaS-style portal for Warp x DoorDash.

## Local dev

1) Install dependencies: `corepack pnpm install`

2) Verify Supabase env vars exist in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3) Create `profiles` + roles (run once in Supabase SQL editor):
- Run `supabase/sql/00_profiles.sql`
- To grant an admin role, update the row in `public.profiles` for that user id.

4) Create module content tables (run once in Supabase SQL editor):
- Run `supabase/sql/01_module_content.sql`
- This enables `/admin` → Content Studio (draft/published blocks stored in `public.module_sections`).

5) Create module content audit tables (run once in Supabase SQL editor):
- Run `supabase/sql/02_module_content_audit.sql`
- This enables `/admin` → History + Restore.

6) Create asset library tables + Storage policies (run once in Supabase SQL editor):
- Run `supabase/sql/03_assets.sql`
- If you see an error like `must be owner of table objects`, create the Storage policies via the dashboard (Storage → Policies) using the policy logic shown in `supabase/sql/03_assets.sql`.
- If bucket creation fails, create a private Storage bucket named `portal-assets` in Supabase dashboard.

7) Start the dev server: `corepack pnpm dev` (defaults to `http://localhost:1130`)

If the `profiles` table doesn’t exist yet, the UI defaults to role `user`.

## Setup verification (in-app)

- `/account` shows the current user id/email, profile role, and an admin-role SQL snippet (informational only).
- `/admin?tab=setup` (admin-only) runs live checks against Supabase using your current session (so RLS/policies are actually tested).

## Routes

- `/login` (public)
- `/` (portal)
- `/m/[slug]?section=end-vision|progress|roadmap` (module detail)
- `/admin` (admin-only; server-protected)
