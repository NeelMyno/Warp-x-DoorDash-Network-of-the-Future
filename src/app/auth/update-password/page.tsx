import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { PageShell } from "@/components/shell/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/app/auth/update-password/update-password-form";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?reason=invalid-link");

  return (
    <PageShell className="grid place-items-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="sm:hidden">
              <BrandLogo size="md" href="/" priority />
            </div>
            <div className="hidden sm:block">
              <BrandLogo size="lg" href="/" priority />
            </div>
          </div>
          <h1 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
            Set a new password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong password to regain access to the portal.
          </p>
        </div>

        <Card className="bg-background/22 backdrop-blur">
          <CardHeader>
            <CardTitle>Update password</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

