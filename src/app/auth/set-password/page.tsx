import { PageShell } from "@/components/shell/PageShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "@/app/auth/set-password/set-password-form";

export default function SetPasswordPage() {
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
            Create your password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish setting up your account to access the portal.
          </p>
        </div>

        <Card className="bg-background/22 backdrop-blur">
          <CardHeader>
            <CardTitle>Set password</CardTitle>
          </CardHeader>
          <CardContent>
            <SetPasswordForm />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
