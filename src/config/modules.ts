export type ModuleSectionKey = "end-vision" | "progress" | "roadmap";

/**
 * Layout variant for module pages.
 * - "standard": Single-column layout with bullets/prose blocks.
 * - "sfs_calculator": Reserved for SFS module with calculator UI (future).
 */
export type ModuleLayoutVariant = "standard" | "sfs_calculator";

export type ContentBlock =
  | {
      type: "bullets";
      title?: string;
      description?: string;
      items: string[];
    }
  | {
      type: "prose";
      title?: string;
      description?: string;
      content: string;
    }
  | {
      type: "image";
      assetId?: string;
      path?: string;
      alt: string;
      caption?: string;
      layout?: "full" | "wide";
      treatment?: "plain" | "panel";
      url?: string;
    }
  | {
      type: "empty";
      title: string;
      description?: string;
    };

export type ModuleConfig = {
  slug: string;
  title: string;
  description: string;
  layoutVariant: ModuleLayoutVariant;
  sections: Record<ModuleSectionKey, { label: string; blocks: ContentBlock[] }>;
};

export const MODULE_SECTIONS: Array<{
  key: ModuleSectionKey;
  label: string;
}> = [
  { key: "end-vision", label: "End vision" },
  { key: "progress", label: "Progress" },
  { key: "roadmap", label: "Roadmap" },
];

/**
 * Creates single-column section content for standard modules.
 * Each section has one bullets block (no timelines, no two-column layouts).
 */
function makeSections(content: {
  endVision: string[];
  progress: string[];
  roadmap: string[];
}): ModuleConfig["sections"] {
  return {
    "end-vision": {
      label: "End vision",
      blocks: [{ type: "bullets", items: content.endVision }],
    },
    progress: {
      label: "Progress",
      blocks: [{ type: "bullets", items: content.progress }],
    },
    roadmap: {
      label: "Roadmap",
      blocks: [{ type: "bullets", items: content.roadmap }],
    },
  };
}

export const MODULES: ModuleConfig[] = [
  {
    slug: "big-and-bulky",
    title: "Big and Bulky",
    description: "Oversized, high-touch delivery flows and network design.",
    layoutVariant: "standard",
    sections: makeSections({
      endVision: [
        "Predictable appointment-aware delivery with room-of-choice options.",
        "Damage prevention playbook (packaging, handling, exception routing).",
        "Capacity planning tuned for bulky dimensional constraints at spokes.",
      ],
      progress: [
        "Baseline current-state flow and exception taxonomy.",
        "Identify pilot lanes and density thresholds.",
        "Define carrier scorecard inputs and operating SOPs.",
      ],
      roadmap: [
        "Month 1: lane selection, assumptions, pilot design.",
        "Month 2: carrier onboarding + SOPs, monitoring dashboards.",
        "Month 3: run pilot, measure damage/OTD/CSAT.",
        "Month 4: iterate playbook and scale lanes based on thresholds.",
      ],
    }),
  },
  {
    slug: "sfs",
    title: "SFS",
    description: "Ship-from-store fulfillment and inventory-aware routing.",
    layoutVariant: "standard", // Future: switch to "sfs_calculator"
    sections: makeSections({
      endVision: [
        "Dynamic routing based on inventory confidence and promised delivery date.",
        "Operational guardrails for store pick/pack and handoff SLAs.",
        "Unified exception handling (substitutions, partials, cancellations).",
      ],
      progress: [
        "Define store readiness signals and compliance checks.",
        "Map handoff types (curbside, dock, parcel pickup) and failure modes.",
        "Outline data integrations needed for inventory + order status.",
      ],
      roadmap: [
        "Month 1: select stores/regions, define readiness checklist.",
        "Month 2: implement routing rules + store SOPs.",
        "Month 3: pilot with tight metrics and daily ops review.",
        "Month 4: expand SKU/store coverage and automate exception triage.",
      ],
    }),
  },
  {
    slug: "middle-mile-to-spokes",
    title: "Middle Mile to spokes",
    description: "Linehaul moves from hubs to spokes with tight cutoff control.",
    layoutVariant: "standard",
    sections: makeSections({
      endVision: [
        "Scheduled linehauls with dynamic capacity based on forecasted volume.",
        "Spoke arrival SLAs that unlock next-day last-mile waves.",
        "Real-time visibility for dwell, late departures, and missed scans.",
      ],
      progress: [
        "Identify candidate spokes and daily volume profiles.",
        "Define cutoff windows, appointments, and yard processes.",
        "Draft exception playbooks (missed departure, late arrival, overflow).",
      ],
      roadmap: [
        "Month 1: select lanes, set cutoffs and measurement.",
        "Month 2: onboard carriers, implement scan/visibility requirements.",
        "Month 3: run steady-state with weekly tuning.",
        "Month 4: expand to new spokes and tighten service guarantees.",
      ],
    }),
  },
  {
    slug: "first-mile-to-hubs-or-spokes",
    title: "First-mile to hubs or spokes",
    description: "Origin pickups and consolidation into the network.",
    layoutVariant: "standard",
    sections: makeSections({
      endVision: [
        "Pickup SLAs aligned to merchant operating hours and dock capacity.",
        "Consolidation rules for cost vs. speed tradeoffs.",
        "Standardized exceptions (no freight, late ready, refused).",
      ],
      progress: [
        "Define pickup windows and appointment mechanisms.",
        "Map packaging + palletization requirements.",
        "Identify consolidation points and visibility signals.",
      ],
      roadmap: [
        "Month 1: merchant selection + readiness checklist.",
        "Month 2: pilot pickups with strict scan compliance.",
        "Month 3: tune consolidation logic and exception playbooks.",
        "Month 4: expand lanes and formalize service tiers.",
      ],
    }),
  },
  {
    slug: "returns",
    title: "Returns",
    description: "Reverse logistics with fast disposition and visibility.",
    layoutVariant: "standard",
    sections: makeSections({
      endVision: [
        "Customer-friendly dropoff/pickup options with clear tracking.",
        "Disposition rules for resale, refurb, or recycle.",
        "Standardized QC and fraud signals at intake.",
      ],
      progress: [
        "Define return reason taxonomy and required data capture.",
        "Identify intake locations (stores, spokes, hubs) and processing SLAs.",
        "Draft disposition logic and reporting requirements.",
      ],
      roadmap: [
        "Month 1: select return categories and intake locations.",
        "Month 2: implement tracking + disposition rules.",
        "Month 3: measure refund speed, loss, and processing cost.",
        "Month 4: expand categories and add automation for QC decisions.",
      ],
    }),
  },
  {
    slug: "store-replenishments",
    title: "Store replenishments",
    description: "Inbound flows that keep stores in stock with tight scheduling.",
    layoutVariant: "standard",
    sections: makeSections({
      endVision: [
        "Consolidated inbound planning across hubs/spokes and store backrooms.",
        "Appointment-aware deliveries with high scan compliance.",
        "Exceptions for shortages, substitutions, and late arrivals.",
      ],
      progress: [
        "Map store receiving hours and dock/backroom capacity.",
        "Define order cadence and desired service levels.",
        "Identify visibility gaps for ASN, arrivals, and discrepancies.",
      ],
      roadmap: [
        "Month 1: select replenishment lanes + cadence targets.",
        "Month 2: implement scheduling + scan requirements.",
        "Month 3: run pilot and tune store receiving processes.",
        "Month 4: expand to additional stores and automate exception workflows.",
      ],
    }),
  },
];

export function isModuleSectionKey(
  value: string | undefined
): value is ModuleSectionKey {
  return value === "end-vision" || value === "progress" || value === "roadmap";
}

export function getModuleBySlug(slug: string) {
  return MODULES.find((m) => m.slug === slug) ?? null;
}

