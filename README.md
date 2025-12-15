# Warp x DoorDash: Network of the Future Portal (V1)

Private, authenticated SaaS-style portal for Warp x DoorDash.

## Local dev

1) Install dependencies: `corepack pnpm install`

2) Verify Supabase env vars exist in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required for Admin → Users invites)

⚠️ Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side. Do not prefix it with `NEXT_PUBLIC_`.

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
- Optional hardening: update the Storage SELECT policy to also require `public.is_portal_member()`.

7) Create invites + portal membership gating (run once in Supabase SQL editor):
- Run `supabase/sql/04_user_invites.sql`
- Supabase Dashboard → Authentication → URL Configuration:
  - Add `${SITE_URL}/auth/callback` to allowed redirect URLs.
  - `${SITE_URL}` should match `NEXT_PUBLIC_SITE_URL` (or your Vercel domain).
- Supabase Dashboard → Authentication → Providers / Settings:
  - Configure invite link expiration as desired (the app treats links as single-use; expiry is controlled by Supabase).

8) Create admin audit log (run once in Supabase SQL editor):
- Run `supabase/sql/06_user_admin_audit.sql`
- This enables `/admin?tab=users` → Activity and enforces invite rate limits (resend/copy link).

9) Start the dev server: `corepack pnpm dev` (defaults to `http://localhost:1130`)

If the `profiles` table doesn’t exist yet, the UI defaults to role `user`.

## Setup verification (in-app)

- `/account` shows the current identity + profile role the portal sees for your session.
- `/admin?tab=setup` (admin-only) runs live checks against Supabase using your current session (so RLS/policies are actually tested).

## Routes

- `/login` (public)
- `/auth/callback` (public; exchanges email links for SSR cookie session)
- `/auth/finish` (public; completes invite links that arrive with URL hash tokens)
- `/auth/set-password` (first-accept password setup for invited users)
- `/` (portal)
- `/m/[slug]?section=end-vision|progress|roadmap` (module detail)
- `/admin` (admin-only; server-protected)

## Smoke test: Edit full name (admin)

1) As admin, open `/admin?tab=users`.
2) In Directory, open a row kebab → **Edit details…**
3) Change **Full name** → Save → toast appears → table updates.
4) Edit your own name → Save → refresh `/account` to confirm it reflects.

## Smoke test: Password reset link (admin)

1) As admin, open `/admin?tab=users`.
2) In Directory, open a row kebab → **Send reset password link…** → **Send link** → toast appears.
3) Switch to Activity → confirm `password_reset_sent` is logged.
4) Repeat quickly to trigger rate limit → UI shows a friendly error; Activity logs `password_reset_blocked`.
5) Open the recipient email → you should land on `/auth/update-password` after `/auth/callback` sets cookies.
6) Set a new password → redirected to `/account?pw=updated` and Activity logs `password_reset_completed`.
