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
  searchParams: Promise<{ reason?: string }>;
}) {
  const { supabase, user, role } = await requireUser();
  const { reason } = await searchParams;

  const profile = await getProfile(supabase, user.id);
  const { data: isAdminData } = await supabase.rpc("is_admin");
  const isAdminRpc = isAdminData === true;

  const adminSql = `update public.profiles set role = 'admin' where id = '${user.id}';`;

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
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4 shadow-[var(--warp-shadow-elev-1)]">
          <div className="text-sm font-semibold text-foreground">
            Admin access required
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            You were redirected because your profile role is not{" "}
            <span className="font-mono text-foreground">admin</span>.
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
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {user.email ?? "—"}
                </div>
              </div>
              {user.email ? <CopyButton value={user.email} /> : null}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">User ID</div>
                <div className="mt-1 truncate font-mono text-sm text-foreground">
                  {user.id}
                </div>
              </div>
              <CopyButton value={user.id} />
            </div>
          </div>
        </ContentPanel>

        <ContentPanel
          title="Profile"
          description="Row from public.profiles (role is stored here)."
          right={
            <Badge
              variant={isAdminRpc ? "accent" : "outline"}
              className="px-2 py-0.5 text-[11px]"
              title="Result of public.is_admin()"
            >
              is_admin(): {isAdminRpc ? "true" : "false"}
            </Badge>
          }
        >
          {profile ? (
            <div className="space-y-3">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ContentPanel
          title="What you can access"
          description="Based on the current profile role."
        >
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
              <div className="text-muted-foreground">Admin module</div>
              <Badge
                variant={role === "admin" ? "accent" : "muted"}
                className="px-2 py-0.5 text-[11px]"
              >
                {role === "admin" ? "Allowed" : "Not allowed"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/15 px-4 py-3">
              <div className="text-muted-foreground">Content Studio</div>
              <Badge
                variant={role === "admin" ? "accent" : "muted"}
                className="px-2 py-0.5 text-[11px]"
              >
                {role === "admin" ? "Allowed" : "Not allowed"}
              </Badge>
            </div>
          </div>
        </ContentPanel>

        {role !== "admin" ? (
          <ContentPanel
            title="Admin setup (informational)"
            description="No self-serve escalation: an existing admin must update your role."
          >
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Role is stored in{" "}
                <span className="font-mono text-foreground">
                  public.profiles.role
                </span>
                . An admin can run:
              </div>

              <div className="rounded-2xl border border-border bg-background/15 px-4 py-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                  {adminSql}
                </pre>
              </div>

              <div className="flex items-center justify-between gap-3">
                <CopyButton value={adminSql} label="Copy SQL" />
                <div className="text-xs text-muted-foreground">
                  Then refresh this page.
                </div>
              </div>
            </div>
          </ContentPanel>
        ) : (
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
              Use this when environments drift or content/workflows behave
              unexpectedly.
            </div>
          </ContentPanel>
        )}
      </div>
    </div>
  );
}

