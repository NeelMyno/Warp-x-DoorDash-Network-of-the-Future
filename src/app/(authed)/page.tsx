import { MODULE_REGISTRY } from "@/lib/modules/registry";
import { requireUser } from "@/lib/auth/require-user";
import { ModuleCard } from "@/components/modules/module-card";

export default async function PortalPage() {
  const { role } = await requireUser();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
          Portal
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose a module to view the end vision, current progress, and the next
          4 months’ roadmap.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULE_REGISTRY.map((m) => {
          const isLocked = role !== "admin" && m.slug !== "sfs-calculator";
          return (
            <ModuleCard
              key={m.slug}
              title={m.name}
              description={m.description}
              href={`/m/${m.slug}`}
              locked={isLocked}
            />
          );
        })}
        {role === "admin" ? (
          <ModuleCard
            title="Admin"
            description="Manage access, roles, and operational settings."
            href="/admin"
            badge="Admin"
          />
        ) : null}
      </div>
    </div>
  );
}
