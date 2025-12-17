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
- This enables `/admin` → Content Studio (module section blocks stored in `public.module_sections`).

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

9) Create SFS rate cards table (run once in Supabase SQL editor):
- Run `supabase/sql/05_sfs_rate_cards.sql`
- This enables the SFS Route Economics Calculator and Admin rate card management.
- Seeds **2 vehicle types** (Cargo Van, 26' Box Truck) with the PDF v2 values.
- Uses upsert, so re-running is safe and will update existing rows to match the spec.
- **Note:** If you see "Could not find the table ... schema cache" error after applying, restart Supabase services or refresh your local Supabase instance to clear schema cache.

10) Extend audit log for SFS rate card operations (run once in Supabase SQL editor):
- Run `supabase/sql/07_sfs_rate_card_audit.sql`
- This adds audit actions: `sfs_rate_card_created`, `sfs_rate_card_updated`, `sfs_rate_card_deleted`.

11) Start the dev server: `corepack pnpm dev` (defaults to `http://localhost:1130`)

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
- `/m/sfs?tab=overview|calculator` (SFS module with Route Economics Calculator)
- `/admin` (admin-only; server-protected)
- `/admin?tab=setup` (admin-only; includes SFS Rate Card management)

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

## Smoke test: SFS Route Economics Calculator

1) Visit `/m/sfs` → click **Calculator** tab.
2) Step 1: Click **Download template CSV** → upload it back into the uploader.
3) Step 2: Select vehicle type (Cargo Van / 26' Box Truck) → confirm "Rates applied" reflects DB values.
4) Step 3: Confirm you see one feasibility row per unique `anchor_id` (Pass/Fail).
5) Step 4: Select an anchor → confirm Anchor CPP / Blended CPP / Total route cost render.
6) Click **Copy selected** and **Copy all** → output matches the PDF `OUTPUT_TEMPLATE` format (per-anchor, separated by blank lines).
7) As admin, visit `/admin?tab=setup` → scroll to "SFS Rate Cards" → edit a value → refresh `/m/sfs?tab=calculator` to see it applied.

## Smoke test: Missing Table Error State

1) Before running migration (or after dropping table), visit `/m/sfs?tab=calculator`.
2) Calculator shows friendly "SFS calculator isn't configured yet" message (no Next error overlay).
3) Admin users see "Go to Admin → Setup" link; non-admins see "Contact an admin" message.

## SFS Calculator Release Checklist

Before shipping SFS calculator changes:

- [ ] `corepack pnpm lint` passes
- [ ] `corepack pnpm build` passes
- [ ] `npx tsx src/lib/sfs-calculator/compute.test.ts` passes
- [ ] Smoke test: Upload template CSV → results appear per anchor_id
- [ ] Smoke test: Vehicle type switch updates CPPs and costs
- [ ] Smoke test: Copy selected / Copy all matches PDF output template
- [ ] Smoke test: Admin rate card edits reflect in calculator without redeploy
- [ ] Smoke test: Audit log shows `sfs_rate_card_created/updated/deleted` entries
- [ ] Smoke test: Missing table shows friendly error state (no crash)

## Running tests

```bash
# SFS Calculator compute engine tests
npx tsx src/lib/sfs-calculator/compute.test.ts
```
