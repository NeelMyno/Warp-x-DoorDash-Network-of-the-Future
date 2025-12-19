import type {
  SfsAnchorResult,
  SfsCalculatorInputs,
  SfsDensityTier,
  SfsDensityTierBreakdown,
  SfsRateCard,
  SfsStop,
} from "./types";
import { computeSfsEconomics } from "./compute";

export type SatelliteClassification = "Density benefit" | "Regular cost";

export type SfsSatelliteImpact = {
  store_id: string;
  store_name: string;
  packages: number;
  distance_to_anchor_miles: number;
  tier_label: string;
  tier_discount_pct: number;
  tier_sort_order: number;
  incremental_savings: number;
  classification: SatelliteClassification;
};

export type SfsTierDistributionRow = {
  label: string;
  discountPct: number;
  satellitePackages: number;
  satelliteShare: number;
  satelliteStoreCount: number;
  contributionPctPoints: number;
};

export type SfsSatelliteImpactSummary = {
  anchor_id: string;
  regular_blended_cost: number;
  regular_blended_cpp: number;
  discounted_blended_cost: number;
  discounted_blended_cpp: number;
  savings_dollars: number;
  savings_pct: number;
  weighted_discount_pct: number;
  tier_distribution: SfsTierDistributionRow[];
  impacts: SfsSatelliteImpact[];
};

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function computeRegularScenario(result: Pick<SfsAnchorResult, "base_portion_before_density" | "stop_fees_total" | "total_packages">) {
  const regular_blended_cost = clampNonNegative(result.base_portion_before_density) + clampNonNegative(result.stop_fees_total);
  const regular_blended_cpp =
    result.total_packages > 0 ? regular_blended_cost / result.total_packages : 0;
  return { regular_blended_cost, regular_blended_cpp };
}

function buildTierDistribution(
  tiers: SfsDensityTierBreakdown[],
  satellites: Array<{ tier_sort_order: number }>,
): SfsTierDistributionRow[] {
  const countsBySort = new Map<number, number>();
  for (const s of satellites) {
    countsBySort.set(s.tier_sort_order, (countsBySort.get(s.tier_sort_order) ?? 0) + 1);
  }

  return tiers.map((t) => {
    const satelliteStoreCount = countsBySort.get(t.sortOrder) ?? 0;
    const contributionPctPoints = t.satelliteShare * t.discountPct;
    return {
      label: t.label,
      discountPct: t.discountPct,
      satellitePackages: t.satellitePackages,
      satelliteShare: t.satelliteShare,
      satelliteStoreCount,
      contributionPctPoints,
    };
  });
}

/**
 * Computes per-satellite "impact" values for a single anchor group:
 * - Full scenario = anchor + all satellites
 * - For each satellite s: scenario_without_s = anchor + satellites excluding s
 * - incremental_savings(s) = max(0, total_cost_without_s - total_cost_with_all)
 *
 * This preserves the underlying V3 cost model (tier-weighted discount, cap, stop fees unchanged).
 */
export function computeSatelliteImpacts(args: {
  inputs: SfsCalculatorInputs;
  anchorId: string;
  anchorStops: SfsStop[];
  rateCard: SfsRateCard;
  densityTiers: SfsDensityTier[];
}): { fullResult: SfsAnchorResult; summary: SfsSatelliteImpactSummary } {
  const { inputs, anchorId, anchorStops, rateCard, densityTiers } = args;

  const [fullResult] = computeSfsEconomics(inputs, anchorStops, rateCard, {
    densityTiers,
  });
  if (!fullResult) {
    throw new Error(`No result for anchor_id=${anchorId}`);
  }

  const satellitesWithDistance = fullResult.stops_with_distance.filter((s) => s.stop_type === "Satellite");
  const regular = computeRegularScenario(fullResult);

  const discounted_blended_cost = clampNonNegative(fullResult.blended_cost);
  const discounted_blended_cpp = fullResult.total_packages > 0 ? discounted_blended_cost / fullResult.total_packages : 0;

  const savings_dollars = clampNonNegative(regular.regular_blended_cost - discounted_blended_cost);
  const savings_pct =
    regular.regular_blended_cost > 0 ? savings_dollars / regular.regular_blended_cost : 0;

  const impacts: SfsSatelliteImpact[] = [];
  const satelliteIndexes = anchorStops
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => s.stop_type === "Satellite");

  for (const { idx } of satelliteIndexes) {
    const stopsWithout = anchorStops.filter((_, i) => i !== idx);
    const [withoutResult] = computeSfsEconomics(inputs, stopsWithout, rateCard, {
      densityTiers,
    });
    const costWithout = clampNonNegative(withoutResult?.blended_cost ?? 0);
    const incremental = clampNonNegative(costWithout - discounted_blended_cost);

    const stopWithMeta = satellitesWithDistance.find((s) => {
      const raw = anchorStops[idx]!;
      return (
        s.store_name === raw.store_name &&
        s.packages === raw.packages &&
        s.pickup_window_start_minutes === raw.pickup_window_start_minutes &&
        s.pickup_window_end_minutes === raw.pickup_window_end_minutes
      );
    });

    const store_id = stopWithMeta?.store_id ?? anchorStops[idx]!.store_id ?? "";
    const store_name = stopWithMeta?.store_name ?? anchorStops[idx]!.store_name;
    const packages = stopWithMeta?.packages ?? anchorStops[idx]!.packages;
    const distance_to_anchor_miles = stopWithMeta?.distance_to_anchor_miles ?? 0;
    const tier_label = stopWithMeta?.tier_label ?? "—";
    const tier_discount_pct = stopWithMeta?.tier_discount_pct ?? 0;
    const tier_sort_order = stopWithMeta?.tier_sort_order ?? 0;

    impacts.push({
      store_id,
      store_name,
      packages,
      distance_to_anchor_miles,
      tier_label,
      tier_discount_pct,
      tier_sort_order,
      incremental_savings: incremental,
      classification: incremental > 0 ? "Density benefit" : "Regular cost",
    });
  }

  const tier_distribution = buildTierDistribution(
    fullResult.density_tiers,
    satellitesWithDistance.map((s) => ({ tier_sort_order: s.tier_sort_order })),
  );

  return {
    fullResult,
    summary: {
      anchor_id: anchorId,
      regular_blended_cost: regular.regular_blended_cost,
      regular_blended_cpp: regular.regular_blended_cpp,
      discounted_blended_cost,
      discounted_blended_cpp,
      savings_dollars,
      savings_pct,
      weighted_discount_pct: fullResult.density_discount_pct,
      tier_distribution,
      impacts,
    },
  };
}
