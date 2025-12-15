"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { setPassword } from "@/app/auth/set-password/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Save password"}
    </Button>
  );
}

export function SetPasswordForm() {
  const [state, formAction] = React.useActionState(setPassword, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>

      {state.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
          {state.error}
        </div>
      ) : null}

      <SubmitButton />

      <p className="text-xs text-muted-foreground">
        Your invite link is single-use. If you hit an error, ask an admin to
        send a new invite.
      </p>
    </form>
  );
}
