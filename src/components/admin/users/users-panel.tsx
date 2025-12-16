"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  cancelInvite,
  deleteUser,
  generateInviteLink,
  invitePortalUser,
  resendInvite,
  sendPasswordResetLinkAction,
  setUserRole,
  setUserStatus,
  updateUserFullNameAction,
} from "@/app/(authed)/admin/users/actions";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/account/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { IconChevronDown, IconDotsVertical } from "@/components/icons";

export type PortalUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: "user" | "admin";
  status: "active" | "invited" | "disabled";
  invitedAt?: string;
  invitedBy?: string;
  disabledAt?: string;
  createdAt?: string;
};

export type UserAdminAuditEvent = {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  targetEmail: string | null;
  metadata: Record<string, unknown>;
};

function formatTimestamp(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString();
}

function formatRelativeTime(iso: string) {
  const timestamp = new Date(iso).getTime();
  const deltaMs = Date.now() - timestamp;
  if (!Number.isFinite(deltaMs)) return "—";
  if (deltaMs < 45_000) return "just now";
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function isValidEmail(value: string | null | undefined) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function RoleBadge({ role }: { role: PortalUserRow["role"] }) {
  return (
    <Badge
      variant={role === "admin" ? "accent" : "muted"}
      className="px-2 py-0.5 text-[11px]"
    >
      {role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: PortalUserRow["status"] }) {
  if (status === "invited") {
    return (
      <Badge
        variant="outline"
        className="border-primary/25 px-2 py-0.5 text-[11px] text-primary"
      >
        invited
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
      </Badge>
    );
  }
  if (status === "disabled") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 px-2 py-0.5 text-[11px] text-destructive"
      >
        disabled
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="px-2 py-0.5 text-[11px]">
      active
    </Badge>
  );
}

function ActionBadge({ action }: { action: string }) {
  const variant =
    action === "invite_sent" ||
    action === "invite_resent" ||
    action === "invite_link_generated"
      ? "accent"
      : action === "password_set" ||
          action === "password_reset_sent" ||
          action === "password_reset_completed"
        ? "muted"
        : "outline";

  const label =
    action === "password_reset_sent"
      ? "Password reset link sent"
      : action === "password_reset_blocked"
        ? "Password reset blocked"
        : action === "password_reset_completed"
          ? "Password reset completed"
        : action.replaceAll("_", " ");

  return (
    <Badge
      variant={variant}
      className={cn(
        "px-2 py-0.5 font-mono text-[11px]",
        action === "password_reset_blocked"
          ? "border-destructive/40 text-destructive"
          : undefined,
      )}
    >
      {label}
    </Badge>
  );
}

function formatMetadata(meta: Record<string, unknown>) {
  const keys = [
    "role",
    "full_name",
    "from_role",
    "to_role",
    "from_status",
    "to_status",
    "status_from",
    "status_to",
    "before_full_name",
    "after_full_name",
    "email",
    "status",
    "reason",
    "via",
  ];
  const parts: string[] = [];
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) parts.push(`${k}=${v}`);
  }
  if (parts.length) return parts.join(" · ");
  const json = (() => {
    try {
      return JSON.stringify(meta);
    } catch {
      return "";
    }
  })();
  if (!json || json === "{}") return null;
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}

function InviteUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<"user" | "admin">("user");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<
    null | { type: "ok" | "error"; text: string }
  >(null);
  const [existingInvitedUserId, setExistingInvitedUserId] = React.useState<
    string | null
  >(null);
  const [existingDisabledUserId, setExistingDisabledUserId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    if (!open) {
      setMessage(null);
      setExistingInvitedUserId(null);
      setExistingDisabledUserId(null);
      setPending(false);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Sends a single-use invite link via Supabase. The user will set a password on first
            accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-full-name">Full name</Label>
            <Input
              id="invite-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              disabled={pending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              type="email"
              autoComplete="email"
              disabled={pending}
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium text-foreground">Role</div>
            <Tabs value={role} onValueChange={(v) => setRole(v === "admin" ? "admin" : "user")}>
              <TabsList className="h-9">
                <TabsTrigger value="user" className="text-xs">
                  User
                </TabsTrigger>
                <TabsTrigger value="admin" className="text-xs">
                  Admin
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {message ? (
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                message.type === "ok"
                  ? "border-primary/25 bg-primary/10 text-foreground"
                  : "border-destructive/30 bg-destructive/10 text-foreground",
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{message.text}</span>
                {existingInvitedUserId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      const result = await resendInvite(existingInvitedUserId);
                      if (!result.ok) {
                        setMessage({ type: "error", text: result.error });
                        setPending(false);
                        return;
                      }
                      setMessage({ type: "ok", text: result.message });
                      router.refresh();
                      setPending(false);
                    }}
                  >
                    Resend
                  </Button>
                ) : existingDisabledUserId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      const result = await setUserStatus(existingDisabledUserId, "active");
                      if (!result.ok) {
                        setMessage({ type: "error", text: result.error });
                        setPending(false);
                        return;
                      }
                      setMessage({ type: "ok", text: result.message });
                      router.refresh();
                      setPending(false);
                    }}
                  >
                    Enable
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setMessage(null);
              setExistingInvitedUserId(null);
              setExistingDisabledUserId(null);
              try {
                const result = await invitePortalUser({ email, fullName, role });
                if (!result.ok) {
                  if (result.code === "already_invited" && result.targetUserId) {
                    setExistingInvitedUserId(result.targetUserId);
                  }
                  if (result.code === "disabled" && result.targetUserId) {
                    setExistingDisabledUserId(result.targetUserId);
                  }
                  setMessage({ type: "error", text: result.error });
                  setPending(false);
                  return;
                }
                setMessage({ type: "ok", text: `Invite sent to ${result.email}.` });
                router.refresh();
                window.setTimeout(() => onOpenChange(false), 650);
              } catch {
                setMessage({ type: "error", text: "Failed to send invite. Try again." });
                setPending(false);
              }
            }}
          >
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  pendingLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  confirmVariant?: "primary" | "destructive";
  onConfirm: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<null | { type: "ok" | "error"; text: string }>(
    null,
  );

  React.useEffect(() => {
    if (!open) {
      setPending(false);
      setMessage(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {message ? (
          <div
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              message.type === "ok"
                ? "border-primary/25 bg-primary/10 text-foreground"
                : "border-destructive/30 bg-destructive/10 text-foreground",
            )}
          >
            {message.text}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Close
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setMessage(null);
              const res = await onConfirm();
              if (!res.ok) {
                setMessage({ type: "error", text: res.error });
                setPending(false);
                return;
              }
              setMessage({ type: "ok", text: res.message });
              window.setTimeout(() => onOpenChange(false), 700);
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MenuActionItem({
  disabled,
  disabledReason,
  onSelect,
  className,
  children,
}: {
  disabled?: boolean;
  disabledReason?: string;
  onSelect?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem
      aria-disabled={disabled ? "true" : undefined}
      title={disabled && disabledReason ? disabledReason : undefined}
      className={cn(disabled ? "cursor-not-allowed opacity-50" : undefined, className)}
      onSelect={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onSelect?.();
      }}
    >
      {children}
    </DropdownMenuItem>
  );
}

function InviteLinkDialog({
  open,
  onOpenChange,
  targetUserId,
  targetEmail,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  targetUserId: string;
  targetEmail: string | null;
}) {
  const [pending, setPending] = React.useState(false);
  const [link, setLink] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function fetchLink() {
    setPending(true);
    setError(null);
    setLink(null);
    const res = await generateInviteLink(targetUserId);
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    setLink(res.link);
    setPending(false);
  }

  React.useEffect(() => {
    if (!open) return;
    setReveal(false);
    void fetchLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetUserId]);

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite link</DialogTitle>
          <DialogDescription>
            Use this if the email didn’t arrive. This link is single-use and expires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              Target{targetEmail ? `: ${targetEmail}` : ""}
            </div>
            <Input
              value={pending ? "Generating…" : link ?? ""}
              readOnly
              type={reveal ? "text" : "password"}
              className="font-mono text-xs"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? "Hide" : "Reveal"}
            </Button>
            {link ? <CopyButton value={link} label="Copy link" /> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={fetchLink}
            >
              Generate new link
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Treat this like a password reset link. Anyone with it can join the portal under the
            assigned role.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UsersToast = { type: "ok" | "error"; text: string };

function SendResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onToast,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  user: PortalUserRow;
  onToast: (toast: UsersToast) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const email = user.email ?? "";
  const canSend = isValidEmail(email);

  React.useEffect(() => {
    if (!open) {
      setPending(false);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send password reset link</DialogTitle>
          <DialogDescription>
            We’ll email a password reset link to:
          </DialogDescription>
          <div className="mt-3 rounded-2xl border border-border bg-background/12 px-4 py-3">
            <div className="font-mono text-xs text-foreground">
              {email || "—"}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Their password won’t change until they set a new one.
            </div>
            {user.status === "disabled" ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Note: This user is currently disabled in the portal.
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {!canSend ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
            This user has no valid email on file.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
            {error}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={pending || !canSend}
            onClick={async () => {
              if (!canSend) return;
              setPending(true);
              setError(null);

              const res = await sendPasswordResetLinkAction({
                targetProfileId: user.id,
              });

              if (!res.ok) {
                setError(res.error);
                onToast({ type: "error", text: res.error });
                if (res.error === "User profile no longer exists.") {
                  router.refresh();
                }
                setPending(false);
                return;
              }

              onToast({ type: "ok", text: `Reset link sent to ${email}.` });
              router.refresh();
              setPending(false);
              onOpenChange(false);
            }}
          >
            {pending ? "Sending…" : "Send link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDetailsDialog({
  open,
  onOpenChange,
  user,
  onToast,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  user: PortalUserRow;
  onToast: (toast: UsersToast) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPending(false);
    setError(null);
    setFullName(user.fullName ?? "");
  }, [open, user.fullName]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);

            const res = await updateUserFullNameAction({
              targetProfileId: user.id,
              fullName,
            });

            if (!res.ok) {
              setError(res.error);
              onToast({ type: "error", text: res.error });
              if (res.error === "User profile no longer exists.") {
                router.refresh();
              }
              setPending(false);
              return;
            }

            onToast({
              type: "ok",
              text: `Updated name for ${user.email ?? "user"}`,
            });
            router.refresh();
            setPending(false);
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>
              Update the user’s profile details for this portal.
            </DialogDescription>
            <div className="mt-2 text-xs text-muted-foreground">
              Editing: <span className="font-mono text-foreground">{user.email ?? "—"}</span>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <Label htmlFor={`edit-full-name-${user.id}`}>Full name</Label>
            <Input
              id={`edit-full-name-${user.id}`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Neel Warp"
              autoComplete="name"
              disabled={pending}
              className="h-9"
              autoFocus
            />
            <div className="text-xs text-muted-foreground">
              This is shown in the Admin Directory and account surfaces.
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
              {error}
            </div>
          ) : null}

          <DialogFooter className="mt-6 gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteOpsMenu({ user, onToast }: { user: PortalUserRow; onToast: (toast: UsersToast) => void }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resendOpen, setResendOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/25 text-muted-foreground transition",
              "hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label="Invite actions"
          >
            <IconDotsVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit details…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            Send reset password link…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setResendOpen(true)}>
            Resend invite email…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLinkOpen(true)}>
            Copy invite link…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setCancelOpen(true)}
            className="text-destructive"
          >
            Cancel invite…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDetailsDialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) router.refresh();
        }}
        user={user}
        onToast={onToast}
      />

      <SendResetPasswordDialog
        open={resetOpen}
        onOpenChange={(next) => {
          setResetOpen(next);
          if (!next) router.refresh();
        }}
        user={user}
        onToast={onToast}
      />

      <ConfirmDialog
        open={resendOpen}
        onOpenChange={(next) => {
          setResendOpen(next);
          if (!next) router.refresh();
        }}
        title="Resend invite email"
        description="Sends a fresh single-use invite link email. Rate limits apply."
        confirmLabel="Resend"
        pendingLabel="Resending…"
        onConfirm={async () => {
          const res = await resendInvite(user.id);
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return { ok: true, message: res.message };
        }}
      />

      <InviteLinkDialog
        open={linkOpen}
        onOpenChange={(next) => {
          setLinkOpen(next);
          if (!next) router.refresh();
        }}
        targetUserId={user.id}
        targetEmail={user.email}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(next) => {
          setCancelOpen(next);
          if (!next) router.refresh();
        }}
        title="Cancel invite"
        description="This disables the user before they finish onboarding. If they click an old link, they will be blocked."
        confirmLabel="Cancel invite"
        pendingLabel="Cancelling…"
        confirmVariant="destructive"
        onConfirm={async () => {
          const res = await cancelInvite(user.id);
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return { ok: true, message: res.message };
        }}
      />
    </div>
  );
}

function DeleteUserDialog({
  open,
  onOpenChange,
  targetEmail,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  targetEmail: string | null;
  onConfirm: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
}) {
  const [pending, setPending] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [message, setMessage] = React.useState<null | { type: "ok" | "error"; text: string }>(
    null,
  );

  React.useEffect(() => {
    if (!open) {
      setPending(false);
      setConfirmText("");
      setMessage(null);
    }
  }, [open]);

  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Permanently removes the user from Supabase Auth and deletes their profile row.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-foreground">
            <div className="font-medium">This cannot be undone.</div>
            <div className="mt-1 text-muted-foreground">
              Target{targetEmail ? `: ${targetEmail}` : ""}. Type{" "}
              <span className="font-mono text-foreground">DELETE</span> to confirm.
            </div>
          </div>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="h-9 font-mono text-xs"
            disabled={pending}
          />

          {message ? (
            <div
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                message.type === "ok"
                  ? "border-primary/25 bg-primary/10 text-foreground"
                  : "border-destructive/30 bg-destructive/10 text-foreground",
              )}
            >
              {message.text}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !canDelete}
            onClick={async () => {
              setPending(true);
              setMessage(null);
              const res = await onConfirm();
              if (!res.ok) {
                setMessage({ type: "error", text: res.error });
                setPending(false);
                return;
              }
              setMessage({ type: "ok", text: res.message });
              window.setTimeout(() => onOpenChange(false), 700);
            }}
          >
            {pending ? "Deleting…" : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DirectoryOpsMenu({
  user,
  currentUserId,
  isLastActiveAdmin,
  onToast,
}: {
  user: PortalUserRow;
  currentUserId: string;
  isLastActiveAdmin: boolean;
  onToast: (toast: UsersToast) => void;
}) {
  const router = useRouter();
  const isSelf = user.id === currentUserId;
  const disabledReason = isSelf
    ? "You can’t change your own role or disable/delete your own account."
    : isLastActiveAdmin
      ? "Cannot remove the last active admin."
      : null;

  const [roleTarget, setRoleTarget] = React.useState<null | "user" | "admin">(null);
  const [statusTarget, setStatusTarget] = React.useState<null | "active" | "disabled">(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const roleChangeBlocked =
    isSelf || (isLastActiveAdmin && user.role === "admin" && user.status === "active");
  const statusChangeBlocked =
    isSelf || (isLastActiveAdmin && user.role === "admin" && user.status === "active");
  const deleteBlocked =
    isSelf || (isLastActiveAdmin && user.role === "admin" && user.status === "active");

  const canShowRoleChange = user.status === "active";

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/25 text-muted-foreground transition",
              "hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label="User actions"
          >
            <IconDotsVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit details…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            Send reset password link…
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {canShowRoleChange ? (
            <>
              {user.role === "user" ? (
                <MenuActionItem
                  disabled={roleChangeBlocked}
                  disabledReason={disabledReason ?? undefined}
                  onSelect={() => setRoleTarget("admin")}
                >
                  Make admin…
                </MenuActionItem>
              ) : (
                <MenuActionItem
                  disabled={roleChangeBlocked}
                  disabledReason={disabledReason ?? undefined}
                  onSelect={() => setRoleTarget("user")}
                >
                  Make user…
                </MenuActionItem>
              )}
              <DropdownMenuSeparator />
            </>
          ) : null}

          {user.status === "active" ? (
            <MenuActionItem
              disabled={statusChangeBlocked}
              disabledReason={disabledReason ?? undefined}
              onSelect={() => setStatusTarget("disabled")}
              className="text-destructive"
            >
              Disable user…
            </MenuActionItem>
          ) : (
            <MenuActionItem
              disabled={statusChangeBlocked}
              disabledReason={disabledReason ?? undefined}
              onSelect={() => setStatusTarget("active")}
            >
              Enable user…
            </MenuActionItem>
          )}

          <DropdownMenuSeparator />

          <MenuActionItem
            disabled={deleteBlocked}
            disabledReason={disabledReason ?? undefined}
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            Delete user…
          </MenuActionItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDetailsDialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) router.refresh();
        }}
        user={user}
        onToast={onToast}
      />

      <SendResetPasswordDialog
        open={resetOpen}
        onOpenChange={(next) => {
          setResetOpen(next);
          if (!next) router.refresh();
        }}
        user={user}
        onToast={onToast}
      />

      <ConfirmDialog
        open={roleTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRoleTarget(null);
          if (!next) router.refresh();
        }}
        title={roleTarget === "admin" ? "Make admin" : "Make user"}
        description={
          roleTarget === "admin"
            ? "This user will gain access to admin-only modules and tools."
            : "This removes admin privileges for the user."
        }
        confirmLabel="Confirm"
        pendingLabel="Updating…"
        onConfirm={async () => {
          if (!roleTarget) return { ok: false, error: "Missing role." };
          const res = await setUserRole(user.id, roleTarget);
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return { ok: true, message: res.message };
        }}
      />

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(next) => {
          if (!next) setStatusTarget(null);
          if (!next) router.refresh();
        }}
        title={statusTarget === "disabled" ? "Disable user" : "Enable user"}
        description={
          statusTarget === "disabled"
            ? "Disables the account and blocks access on the next request."
            : "Re-enables the account. If they never set a password, they’ll be marked invited again."
        }
        confirmLabel={statusTarget === "disabled" ? "Disable" : "Enable"}
        pendingLabel={statusTarget === "disabled" ? "Disabling…" : "Enabling…"}
        confirmVariant={statusTarget === "disabled" ? "destructive" : "primary"}
        onConfirm={async () => {
          if (!statusTarget) return { ok: false, error: "Missing status." };
          const res = await setUserStatus(user.id, statusTarget);
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return { ok: true, message: res.message };
        }}
      />

      <DeleteUserDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) router.refresh();
        }}
        targetEmail={user.email}
        onConfirm={async () => {
          const res = await deleteUser(user.id);
          if (!res.ok) return { ok: false, error: res.error };
          router.refresh();
          return { ok: true, message: res.message };
        }}
      />
    </div>
  );
}

export function UsersPanel({
  users,
  currentUserId,
  dbAvailable,
  dbError,
  auditAvailable,
  auditError,
  auditEvents,
}: {
  users: PortalUserRow[];
  currentUserId: string;
  dbAvailable: boolean;
  dbError?: string;
  auditAvailable: boolean;
  auditError?: string;
  auditEvents: UserAdminAuditEvent[];
}) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [view, setView] = React.useState<"directory" | "activity">("directory");
  const [search, setSearch] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<
    "all" | "invites" | "details" | "role" | "status" | "password" | "delete"
  >("all");

  const [toast, setToast] = React.useState<null | (UsersToast & { id: number })>(null);

  React.useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const activeAdminCount = React.useMemo(
    () => users.filter((u) => u.role === "admin" && u.status === "active").length,
    [users],
  );

  const filteredAuditEvents = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const groups: Record<typeof actionFilter, string[] | null> = {
      all: null,
      invites: [
        "invite_sent",
        "invite_resent",
        "invite_link_generated",
        "invite_cancelled",
      ],
      details: ["name_changed"],
      role: ["role_changed"],
      status: ["status_changed"],
      password: [
        "password_set",
        "password_reset_sent",
        "password_reset_blocked",
        "password_reset_completed",
      ],
      delete: ["user_deleted"],
    };

    const allowed = groups[actionFilter];
    return auditEvents.filter((e) => {
      const matchesTerm = term
        ? (e.targetEmail ?? "").toLowerCase().includes(term)
        : true;
      const matchesAction = allowed ? allowed.includes(e.action) : true;
      return matchesTerm && matchesAction;
    });
  }, [auditEvents, actionFilter, search]);

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border px-4 py-3 text-sm backdrop-blur",
            toast.type === "ok"
              ? "border-primary/25 bg-primary/10 text-foreground"
              : "border-destructive/30 bg-destructive/10 text-foreground",
          )}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onValueChange={(next) =>
            setView(next === "activity" ? "activity" : "directory")
          }
        >
          <TabsList className="h-9">
            <TabsTrigger value="directory" className="text-xs">
              Directory
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">
              Activity
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!dbAvailable ? (
        <ContentPanel
          title="Users table unavailable"
          description="Verify Supabase migrations were applied for profiles + invites."
          className="border-destructive/30 bg-destructive/10"
        >
          <div className="text-sm text-muted-foreground">
            Error: <span className="font-mono text-foreground">{dbError ?? "—"}</span>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Run <span className="font-mono text-foreground">supabase/sql/04_user_invites.sql</span>{" "}
            in the Supabase SQL editor.
          </div>
        </ContentPanel>
      ) : view === "activity" ? (
        !auditAvailable ? (
          <ContentPanel
            title="Activity log unavailable"
            description="Run the admin audit migration to enable invite rate limits and activity history."
            className="border-destructive/30 bg-destructive/10"
          >
            <div className="text-sm text-muted-foreground">
              Error:{" "}
              <span className="font-mono text-foreground">{auditError ?? "—"}</span>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Run{" "}
              <span className="font-mono text-foreground">
                supabase/sql/06_user_admin_audit.sql
              </span>{" "}
              in the Supabase SQL editor.
            </div>
          </ContentPanel>
        ) : (
          <ContentPanel
            title="Activity"
            description="Latest admin/user access events (admin-only)."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search target email…"
                  className="h-9 w-56"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      {actionFilter === "all"
                        ? "All actions"
                        : actionFilter === "invites"
                          ? "Invites"
                          : actionFilter === "details"
                            ? "Details"
                          : actionFilter === "role"
                            ? "Role"
                            : actionFilter === "status"
                              ? "Status"
                              : actionFilter === "password"
                                ? "Password"
                                : "Delete"}
                      <IconChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setActionFilter("all")}>
                        All
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setActionFilter("invites")}>
                        Invites
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setActionFilter("details")}>
                        Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setActionFilter("role")}>
                        Role
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setActionFilter("status")}>
                      Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActionFilter("password")}>
                      Password
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setActionFilter("delete")}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                  Showing:{" "}
                  <span className="ml-1 font-mono">{filteredAuditEvents.length}</span>
                </Badge>
              </div>
            }
          >
            {filteredAuditEvents.length ? (
              <div className="space-y-2">
                {filteredAuditEvents.map((e) => {
                  const meta = formatMetadata(e.metadata);
                  return (
                    <div
                      key={e.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-background/12 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionBadge action={e.action} />
                          <span
                            className="text-xs text-muted-foreground"
                            title={formatTimestamp(e.createdAt)}
                          >
                            {formatRelativeTime(e.createdAt)}
                          </span>
                          {e.actorEmail ? (
                            <>
                              <span className="text-xs text-muted-foreground opacity-50">
                                •
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {e.actorEmail}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <div className="mt-2 truncate text-sm text-foreground">
                          {e.targetEmail ?? "—"}
                        </div>
                        {meta ? (
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {meta}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                No activity yet.
              </div>
            )}
          </ContentPanel>
        )
      ) : (
        <ContentPanel
          title="Portal users"
          description="Rows from public.profiles (admin-only)."
          right={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                Total: <span className="ml-1 font-mono">{users.length}</span>
              </Badge>
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                Invite user
              </Button>
            </div>
          }
        >
          {users.length ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/25 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id} className="bg-background/10">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-foreground">{u.fullName ?? "—"}</div>
                          {u.id === currentUserId ? (
                            <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                              You
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {u.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {u.status === "invited" && u.invitedAt
                          ? formatTimestamp(u.invitedAt)
                          : formatTimestamp(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {u.status === "invited" ? (
                          <InviteOpsMenu
                            user={u}
                            onToast={(t) => setToast({ ...t, id: Date.now() })}
                          />
                        ) : (
                          <DirectoryOpsMenu
                            user={u}
                            currentUserId={currentUserId}
                            isLastActiveAdmin={
                              u.role === "admin" &&
                              u.status === "active" &&
                              activeAdminCount <= 1
                            }
                            onToast={(t) => setToast({ ...t, id: Date.now() })}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
              No users found yet. Invite a teammate to get started.
            </div>
          )}
        </ContentPanel>
      )}

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
