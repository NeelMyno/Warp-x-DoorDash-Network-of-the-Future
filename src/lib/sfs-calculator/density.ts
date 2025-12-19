import type { SfsDensityTier, SfsDensityTierBreakdown } from "./types";

const EARTH_RADIUS_MILES = 3958.7613;

export const DEFAULT_DENSITY_TIERS: SfsDensityTier[] = [
  { sortOrder: 1, minMiles: 0, maxMiles: 10, discountPct: 0.2, label: "0–10 mi" },
  { sortOrder: 2, minMiles: 10, maxMiles: 20, discountPct: 0.12, label: "10–20 mi" },
  { sortOrder: 3, minMiles: 20, maxMiles: 30, discountPct: 0.06, label: "20–30 mi" },
  { sortOrder: 4, minMiles: 30, maxMiles: null, discountPct: 0.0, label: "30+ mi" },
] as const;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two lat/lon points in miles. */
export function haversineMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_MILES * c;
}

export function formatTierLabel(tier: Pick<SfsDensityTier, "minMiles" | "maxMiles" | "label">): string {
  if (tier.label && tier.label.trim()) return tier.label.trim();
  const min = tier.minMiles;
  const max = tier.maxMiles;
  if (typeof max === "number") return `${min}–${max} mi`;
  return `${min}+ mi`;
}

export function validateDensityTiers(
  tiers: SfsDensityTier[],
): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { ok: false, reason: "No tiers configured." };
  }

  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!Number.isFinite(t.minMiles) || t.minMiles < 0) {
      return { ok: false, reason: "Tier minMiles must be >= 0." };
    }
    if (t.maxMiles != null && (!Number.isFinite(t.maxMiles) || t.maxMiles <= t.minMiles)) {
      return { ok: false, reason: "Tier maxMiles must be > minMiles (or null for open ended)." };
    }
    if (!Number.isFinite(t.discountPct) || t.discountPct < 0 || t.discountPct > 0.5) {
      return { ok: false, reason: "Tier discountPct must be within [0, 0.5]." };
    }
    if (t.maxMiles == null && i !== sorted.length - 1) {
      return { ok: false, reason: "Only the last tier can be open-ended (maxMiles = null)." };
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevMax = prev.maxMiles;
    if (prevMax == null) {
      return { ok: false, reason: "Open-ended tier must be last." };
    }
    if (curr.minMiles < prevMax) {
      return { ok: false, reason: "Tiers overlap or are not ordered by range." };
    }
  }

  return { ok: true };
}

function pickTier(distanceMiles: number, tiers: SfsDensityTier[]): SfsDensityTier {
  for (const t of tiers) {
    const max = t.maxMiles ?? Infinity;
    if (distanceMiles >= t.minMiles && distanceMiles < max) return t;
  }
  return tiers[tiers.length - 1]!;
}

export function tierForDistance(distanceMiles: number, tiers: SfsDensityTier[]): SfsDensityTier {
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  return pickTier(distanceMiles, sorted);
}

export function computeDensityDiscount(
  satellites: Array<{ packages: number; distance_to_anchor_miles: number }>,
  tiers: SfsDensityTier[],
): {
  breakdown: SfsDensityTierBreakdown[];
  density_discount_pct: number;
  density_discount_cap_pct: number;
} {
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  const buckets = new Map<number, number>();

  for (const t of sorted) buckets.set(t.sortOrder, 0);

  for (const s of satellites) {
    const pkgs = Number.isFinite(s.packages) ? s.packages : 0;
    const d = Number.isFinite(s.distance_to_anchor_miles) ? s.distance_to_anchor_miles : Infinity;
    const tier = pickTier(d, sorted);
    buckets.set(tier.sortOrder, (buckets.get(tier.sortOrder) ?? 0) + pkgs);
  }

  const satellitePackages = Array.from(buckets.values()).reduce((a, b) => a + b, 0);

  const breakdown: SfsDensityTierBreakdown[] = sorted.map((t) => {
    const satellitePackagesForTier = buckets.get(t.sortOrder) ?? 0;
    const share = satellitePackages > 0 ? satellitePackagesForTier / satellitePackages : 0;
    const contribution = share * t.discountPct;
    return {
      sortOrder: t.sortOrder,
      minMiles: t.minMiles,
      maxMiles: t.maxMiles,
      label: formatTierLabel(t),
      discountPct: t.discountPct,
      satellitePackages: satellitePackagesForTier,
      satelliteShare: share,
      contribution,
    };
  });

  const rawDiscount = breakdown.reduce((acc, b) => acc + b.contribution, 0);
  const maxTierDiscount = Math.max(...sorted.map((t) => t.discountPct));
  const density_discount_cap_pct = Math.min(0.2, Math.max(0, maxTierDiscount));
  const density_discount_pct = Math.min(density_discount_cap_pct, Math.max(0, rawDiscount));

  return { breakdown, density_discount_pct, density_discount_cap_pct };
}
