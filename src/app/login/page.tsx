import { PageShell } from "@/components/shell/PageShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = typeof redirect === "string" ? redirect : "/";

  return (
    <PageShell className="grid place-items-center">
      <div className="w-full max-w-md">
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
            Warp x DoorDash Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access the Network of the Future modules.
          </p>
        </div>

        <Card className="bg-background/22 backdrop-blur">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use your email and password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirectTo} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
