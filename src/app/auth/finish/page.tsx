import { BrandLogo } from "@/components/brand/BrandLogo";
import { ContentPanel } from "@/components/panels/ContentPanel";
import { PageShell } from "@/components/shell/PageShell";
import { FinishClient } from "@/app/auth/finish/finish-client";

export default function AuthFinishPage() {
  return (
    <PageShell className="grid place-items-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="sm:hidden">
            <BrandLogo size="md" href="/" priority />
          </div>
          <div className="hidden sm:block">
            <BrandLogo size="lg" href="/" priority />
          </div>
        </div>

        <ContentPanel
          title="Finishing sign in"
          description="Securing your session and preparing the portal."
          className="bg-background/22 backdrop-blur"
        >
          <FinishClient />
          <div className="text-sm text-muted-foreground">
            If this takes more than a few seconds, go back and request a fresh invite link.
          </div>
        </ContentPanel>
      </div>
    </PageShell>
  );
}

