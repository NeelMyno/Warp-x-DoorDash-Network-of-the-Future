import Link from "next/link";

import { ContentPanel } from "@/components/panels/ContentPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/get-profile";
import { CopyButton } from "@/components/account/CopyButton";

function formatTimestamp(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; pw?: string }>;
}) {
  const { supabase, user, role } = await requireUser();
  const { reason, pw } = await searchParams;

  const profile = await getProfile(supabase, user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
            Account
          </h2>
          <Badge
            variant={role === "admin" ? "accent" : "outline"}
            className="px-2 py-0.5 text-[11px]"
          >
            {role === "admin" ? "ADMIN" : "USER"}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This page shows the live identity and role the portal sees for your
          current session.
        </p>
      </div>

      {reason === "not-admin" ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
          <div className="text-sm font-semibold text-foreground">
            Admin access required
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            You were redirected because your profile role is not{" "}
            <span className="font-mono text-foreground">admin</span>.
          </div>
        </div>
      ) : null}

      {pw === "updated" ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4">
          <div className="text-sm font-semibold text-foreground">
            Password updated successfully
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Your password has been updated and your session is active.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentPanel
          title="Identity"
          description="Values from your authenticated Supabase session."
          right={
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Back to portal</Link>
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Full name</div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {profile?.fullName ?? "—"}
                </div>
              </div>
              {profile?.fullName ? <CopyButton value={profile.fullName} /> : null}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {user.email ?? "—"}
                </div>
              </div>
              {user.email ? <CopyButton value={user.email} /> : null}
            </div>
          </div>
        </ContentPanel>

        <ContentPanel
          title="Profile"
          description="Row from public.profiles (role is stored here)."
        >
          {profile ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {profile.role}
                    </div>
                  </div>
                  <Badge
                    variant={profile.role === "admin" ? "accent" : "muted"}
                    className="px-2 py-0.5 text-[11px]"
                  >
                    {profile.role === "admin" ? "ADMIN" : "USER"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="mt-1 text-sm font-medium text-foreground">
                      {profile.status ?? "—"}
                    </div>
                  </div>
                  <Badge
                    variant={
                      profile.status === "disabled"
                        ? "outline"
                        : profile.status === "invited"
                          ? "outline"
                          : "muted"
                    }
                    className="px-2 py-0.5 text-[11px]"
                  >
                    {profile.status ?? "unknown"}
                    {profile.status === "invited" ? (
                      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/15 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Profile email</div>
                  <div className="mt-1 truncate font-mono text-xs text-foreground">
                    {profile.email ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/15 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Full name</div>
                  <div className="mt-1 truncate text-sm text-foreground">
                    {profile.fullName ?? "—"}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/15 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="mt-1 font-mono text-xs text-foreground">
                    {formatTimestamp(profile.createdAt)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/15 px-4 py-3">
                  <div className="text-xs text-muted-foreground">Updated</div>
                  <div className="mt-1 font-mono text-xs text-foreground">
                    {formatTimestamp(profile.updatedAt)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
              No profile row found. Run{" "}
              <span className="font-mono text-foreground">
                supabase/sql/00_profiles.sql
              </span>{" "}
              in Supabase SQL editor to create the role model + signup trigger.
            </div>
          )}
        </ContentPanel>
      </div>

      {role === "admin" ? (
        <ContentPanel
          title="Setup & Diagnostics"
          description="Admin-only checks for Supabase setup drift."
          right={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin?tab=setup">Open diagnostics</Link>
            </Button>
          }
        >
          <div className="text-sm text-muted-foreground">
            Use this when environments drift or content/workflows behave unexpectedly.
          </div>
        </ContentPanel>
      ) : null}
    </div>
  );
}
