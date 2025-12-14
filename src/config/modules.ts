export type ModuleSectionKey = "end-vision" | "progress" | "roadmap";

export type KpiItem = {
  label: string;
  value: string;
  delta?: string;
  helper?: string;
};

export type TimelineItem = {
  date: string;
  title: string;
  body?: string;
};

export type ContentBlock =
  | {
      type: "kpis";
      title?: string;
      items: KpiItem[];
    }
  | {
      type: "bullets";
      title: string;
      description?: string;
      items: string[];
    }
  | {
      type: "timeline";
      title: string;
      description?: string;
      items: TimelineItem[];
    }
  | {
      type: "image";
      assetId?: string;
      path?: string;
      alt: string;
      caption?: string;
      layout?: "full" | "wide" | "half-left" | "half-right";
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

function makeKpis(section: ModuleSectionKey): KpiItem[] {
  if (section === "end-vision") {
    return [
      { label: "Target SLA", value: "—", helper: "placeholder" },
      { label: "Coverage", value: "—", helper: "lanes / regions" },
      { label: "Quality", value: "—", helper: "damage / defects" },
      { label: "Cost delta", value: "—", delta: "—", helper: "vs. baseline" },
    ];
  }

  if (section === "progress") {
    return [
      { label: "Workstreams", value: "3", delta: "+1", helper: "in flight" },
      { label: "Validated", value: "—", helper: "signals" },
      { label: "Risks", value: "—", helper: "open items" },
      { label: "Last update", value: "Today", helper: "placeholder" },
    ];
  }

  return [
    { label: "Milestones", value: "4", helper: "next 4 months" },
    { label: "Pilot start", value: "Jan 2026", helper: "placeholder" },
    { label: "Owners", value: "TBD", helper: "workstream leads" },
    { label: "Scale gate", value: "TBD", helper: "thresholds" },
  ];
}

function makeTimeline(section: ModuleSectionKey): TimelineItem[] {
  if (section === "end-vision") {
    return [
      {
        date: "Dec 2025",
        title: "Define end-state metrics",
        body: "Clarify SLAs, cost targets, and quality thresholds.",
      },
      {
        date: "Jan 2026",
        title: "Select pilot lanes",
        body: "Pick regions and volume bands to validate assumptions.",
      },
      {
        date: "Feb 2026",
        title: "Instrument visibility",
        body: "Agree on scans, dashboards, and exception taxonomy.",
      },
      {
        date: "Mar 2026",
        title: "Scale-ready playbook",
        body: "Codify SOPs and scale criteria from pilot results.",
      },
    ];
  }

  if (section === "progress") {
    return [
      {
        date: "This week",
        title: "Baseline current state",
        body: "Map flows, constraints, and key failure modes.",
      },
      {
        date: "Next 2 weeks",
        title: "Pilot design",
        body: "Lane selection, operating assumptions, and SOPs.",
      },
      {
        date: "Next 30 days",
        title: "Carrier + partner alignment",
        body: "Onboard partners and confirm measurement plan.",
      },
      {
        date: "Next 60 days",
        title: "Run + iterate",
        body: "Execute the pilot and tune the playbook weekly.",
      },
    ];
  }

  return [
    {
      date: "Jan 2026",
      title: "Lane selection + assumptions",
      body: "Finalize scope, success metrics, and operating cadence.",
    },
    {
      date: "Feb 2026",
      title: "Build + onboarding",
      body: "Carrier onboarding, SOPs, and visibility requirements.",
    },
    {
      date: "Mar 2026",
      title: "Pilot execution",
      body: "Run steady-state and capture OTD/quality signals.",
    },
    {
      date: "Apr 2026",
      title: "Scale decision",
      body: "Iterate and expand based on thresholds and learnings.",
    },
  ];
}

function makeSections(content: {
  endVisionBullets: string[];
  progressBullets: string[];
  roadmapBullets: string[];
}): ModuleConfig["sections"] {
  return {
    "end-vision": {
      label: "End vision",
      blocks: [
        { type: "kpis", title: "Overview", items: makeKpis("end-vision") },
        {
          type: "bullets",
          title: "What success looks like",
          description: "V1 placeholder bullets; replace with real content.",
          items: content.endVisionBullets,
        },
        {
          type: "timeline",
          title: "Milestones",
          description: "Sequencing to reach the end vision (placeholder).",
          items: makeTimeline("end-vision"),
        },
      ],
    },
    progress: {
      label: "Progress",
      blocks: [
        { type: "kpis", title: "Snapshot", items: makeKpis("progress") },
        {
          type: "bullets",
          title: "Validated so far",
          description: "What’s true today and what’s been confirmed.",
          items: content.progressBullets,
        },
        {
          type: "timeline",
          title: "Cadence",
          description: "How progress will be tracked (placeholder).",
          items: makeTimeline("progress"),
        },
      ],
    },
    roadmap: {
      label: "Next 4 months’ steps roadmap",
      blocks: [
        { type: "kpis", title: "Next 4 months", items: makeKpis("roadmap") },
        {
          type: "bullets",
          title: "Planned steps",
          description: "A focused plan to de-risk and scale.",
          items: content.roadmapBullets,
        },
        {
          type: "timeline",
          title: "Timeline",
          description: "4-month plan with placeholder dates.",
          items: makeTimeline("roadmap"),
        },
      ],
    },
  };
}

export const MODULES: ModuleConfig[] = [
  {
    slug: "big-and-bulky",
    title: "Big and Bulky",
    description: "Oversized, high-touch delivery flows and network design.",
    sections: makeSections({
      endVisionBullets: [
        "Predictable appointment-aware delivery with room-of-choice options.",
        "Damage prevention playbook (packaging, handling, exception routing).",
        "Capacity planning tuned for bulky dimensional constraints at spokes.",
      ],
      progressBullets: [
        "Baseline current-state flow and exception taxonomy.",
        "Identify pilot lanes and density thresholds.",
        "Define carrier scorecard inputs and operating SOPs.",
      ],
      roadmapBullets: [
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
    sections: makeSections({
      endVisionBullets: [
        "Dynamic routing based on inventory confidence and promised delivery date.",
        "Operational guardrails for store pick/pack and handoff SLAs.",
        "Unified exception handling (substitutions, partials, cancellations).",
      ],
      progressBullets: [
        "Define store readiness signals and compliance checks.",
        "Map handoff types (curbside, dock, parcel pickup) and failure modes.",
        "Outline data integrations needed for inventory + order status.",
      ],
      roadmapBullets: [
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
    sections: makeSections({
      endVisionBullets: [
        "Scheduled linehauls with dynamic capacity based on forecasted volume.",
        "Spoke arrival SLAs that unlock next-day last-mile waves.",
        "Real-time visibility for dwell, late departures, and missed scans.",
      ],
      progressBullets: [
        "Identify candidate spokes and daily volume profiles.",
        "Define cutoff windows, appointments, and yard processes.",
        "Draft exception playbooks (missed departure, late arrival, overflow).",
      ],
      roadmapBullets: [
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
    sections: makeSections({
      endVisionBullets: [
        "Pickup SLAs aligned to merchant operating hours and dock capacity.",
        "Consolidation rules for cost vs. speed tradeoffs.",
        "Standardized exceptions (no freight, late ready, refused).",
      ],
      progressBullets: [
        "Define pickup windows and appointment mechanisms.",
        "Map packaging + palletization requirements.",
        "Identify consolidation points and visibility signals.",
      ],
      roadmapBullets: [
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
    sections: makeSections({
      endVisionBullets: [
        "Customer-friendly dropoff/pickup options with clear tracking.",
        "Disposition rules for resale, refurb, or recycle.",
        "Standardized QC and fraud signals at intake.",
      ],
      progressBullets: [
        "Define return reason taxonomy and required data capture.",
        "Identify intake locations (stores, spokes, hubs) and processing SLAs.",
        "Draft disposition logic and reporting requirements.",
      ],
      roadmapBullets: [
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
    sections: makeSections({
      endVisionBullets: [
        "Consolidated inbound planning across hubs/spokes and store backrooms.",
        "Appointment-aware deliveries with high scan compliance.",
        "Exceptions for shortages, substitutions, and late arrivals.",
      ],
      progressBullets: [
        "Map store receiving hours and dock/backroom capacity.",
        "Define order cadence and desired service levels.",
        "Identify visibility gaps for ASN, arrivals, and discrepancies.",
      ],
      roadmapBullets: [
        "Month 1: select replenishment lanes + cadence targets.",
        "Month 2: implement scheduling + scan requirements.",
        "Month 3: run pilot and tune store receiving processes.",
        "Month 4: expand to additional stores and automate exception workflows.",
      ],
    }),
  },
];

export function isModuleSectionKey(
  value: string | undefined,
): value is ModuleSectionKey {
  return value === "end-vision" || value === "progress" || value === "roadmap";
}

export function getModuleBySlug(slug: string) {
  return MODULES.find((m) => m.slug === slug) ?? null;
}
