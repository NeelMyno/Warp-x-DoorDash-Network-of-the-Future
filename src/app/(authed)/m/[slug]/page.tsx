import { notFound } from "next/navigation";

import {
  MODULE_SECTIONS,
  type ModuleSectionKey,
} from "@/config/modules";
import { Blocks } from "@/components/content/blocks";
import { requireUser } from "@/lib/auth/require-user";
import { getModuleContent } from "@/lib/content/get-module-content";

const SECTION_KEYS: ModuleSectionKey[] = ["end-vision", "progress", "roadmap"];

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { role } = await requireUser();
  const resolved = await getModuleContent(slug);
  if (!resolved) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-[length:var(--warp-fs-page-title)] font-semibold leading-[var(--warp-lh-page-title)] tracking-tight text-foreground">
          {resolved.moduleMeta.title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {resolved.moduleMeta.description}
        </p>
      </div>

      <div className="space-y-10">
        {SECTION_KEYS.map((key) => {
          const label = MODULE_SECTIONS.find((s) => s.key === key)?.label ?? key;
          const section = resolved.sections[key];

          return (
            <section key={key} id={key} className="space-y-4">
              <h3 className="text-[length:var(--warp-fs-section-title)] font-semibold leading-[var(--warp-lh-section-title)] text-foreground">
                {label}
              </h3>

              <Blocks blocks={section.blocks} showImageHints={role === "admin"} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
