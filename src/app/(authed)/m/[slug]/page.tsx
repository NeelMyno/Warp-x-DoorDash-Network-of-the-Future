import { notFound, redirect } from "next/navigation";

import {
  MODULE_SECTIONS,
  type ModuleSectionKey,
} from "@/config/modules";
import { getModuleBySlug, normalizeModuleTab } from "@/lib/modules/registry";
import { Blocks, isBlocksEmpty } from "@/components/content/blocks";
import { NetworkEnhancementsModule } from "@/components/modules/network-enhancements/NetworkEnhancementsModule";
import { resolveModuleLayout } from "@/components/modules/layouts/resolve-module-layout";
import { requireUser } from "@/lib/auth/require-user";
import { getModuleContent } from "@/lib/content/get-module-content";
import { getSfsRateCards } from "@/lib/sfs-calculator/get-rate-cards";
import { getSfsDensityTiers } from "@/lib/sfs-calculator/get-density-tiers";
import type { SfsDensityTier, SfsRateCard } from "@/lib/sfs-calculator/types";
import { DEFAULT_SFS_RATE_CARDS } from "@/lib/sfs-calculator/types";
import type { SfsConfigError } from "@/components/modules/sfs/sfs-calculator";

const SECTION_KEYS: ModuleSectionKey[] = ["end-vision", "progress", "roadmap"];

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; sub?: string; variant?: string; panel?: string }>;
}) {
  const { slug } = await params;
  const { tab, sub, variant, panel } = await searchParams;
  const { role, supabase } = await requireUser();

  // Lookup module in registry
  const moduleEntry = getModuleBySlug(slug);
  if (!moduleEntry) notFound();

  if (slug === "network-enhancements") {
    const normalizedSub =
      sub === "spoke" || sub === "network" ? sub : "hub";
    if (normalizedSub === "network") {
      const shouldRedirect =
        sub !== normalizedSub || !!variant || !!panel;
      if (shouldRedirect) {
        redirect(
          `/m/${slug}?sub=${normalizedSub}`,
        );
      }
    } else {
      const normalizedVariant = variant === "future" ? "future" : "example";
      const shouldRedirect =
        sub !== normalizedSub || variant !== normalizedVariant || panel;
      if (shouldRedirect) {
        redirect(
          `/m/${slug}?sub=${normalizedSub}&variant=${encodeURIComponent(normalizedVariant)}`,
        );
      }
    }

    return (
      <NetworkEnhancementsModule
        slug={slug}
        role={role}
        subParam={sub}
        variantParam={variant}
        supabase={supabase}
      />
    );
  }

  const resolved = await getModuleContent(slug);
  if (!resolved) notFound();

  // Build sections for the layout
  const sections = SECTION_KEYS.map((key) => {
    const label = MODULE_SECTIONS.find((s) => s.key === key)?.label ?? key;
    const section = resolved.sections[key];
    const isEmpty = isBlocksEmpty(section.blocks);

    return {
      key,
      label,
      isEmpty,
      content: (
        <Blocks blocks={section.blocks} showImageHints={role === "admin"} />
      ),
    };
  });

  // Fetch rate cards for calculator layouts (with structured result)
  let rateCards: SfsRateCard[] = [];
  let configError: SfsConfigError | null = null;
  let densityTiers: SfsDensityTier[] | undefined;
  let adminWarnings: { densityTiers?: string } | null = null;

  if (moduleEntry.layout === "calculator") {
    const result = await getSfsRateCards(supabase);
    if (result.ok) {
      rateCards = result.rateCards;
    } else {
      configError = { reason: result.reason, message: result.message };
      // V3 requirement: allow calculator to operate using default rates even if DB is missing.
      rateCards = [
        { id: "default-cargo-van", ...DEFAULT_SFS_RATE_CARDS["Cargo Van"] },
        { id: "default-26-box-truck", ...DEFAULT_SFS_RATE_CARDS["26' Box Truck"] },
      ];
    }

    const tiersResult = await getSfsDensityTiers(supabase, { isAdmin: role === "admin" });
    densityTiers = tiersResult.tiers;

    if (role === "admin" && tiersResult.adminWarning) {
      adminWarnings = { densityTiers: tiersResult.adminWarning };
    }
  }

  // Resolve and render the appropriate layout
  return resolveModuleLayout({
    moduleEntry,
    title: resolved.moduleMeta.title,
    description: resolved.moduleMeta.description,
    sections,
    activeTab: normalizeModuleTab(moduleEntry, tab),
    rateCards,
    densityTiers,
    configError,
    adminWarnings,
    isAdmin: role === "admin",
  });
}
