"use client";

import * as React from "react";
import { Users, Package, MapPin, Truck } from "lucide-react";
import { formatNumber } from "@/lib/sfs-calculator/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getGlossary } from "./glossary";

interface Props {
  driversRequired: number;
  totalPackages: number;
  totalStops: number;
  anchorPackages: number;
  satellitePackages: number;
  anchorStops: number;
  satelliteStores: number;
}

interface StatTileProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  unit: string;
  glossaryKey: string;
  breakdown?: string;
}

function StatTile({ icon, value, label, unit, glossaryKey, breakdown }: StatTileProps) {
  const gloss = getGlossary(glossaryKey);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help flex-col items-center rounded-lg border border-border/50 bg-muted/20 px-3 py-3 text-center transition-colors hover:bg-muted/30">
            <div className="mb-2 text-muted-foreground/70">{icon}</div>
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatNumber(value)}
            </span>
            <span className="text-[10px] text-muted-foreground/60">{unit}</span>
            <span className="mt-1 text-[11px] text-muted-foreground">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <p className="font-medium">{gloss.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{gloss.body}</p>
          {breakdown && (
            <p className="mt-1 border-t border-border/40 pt-1 text-[10px] text-muted-foreground">
              {breakdown}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Card showing operational footprint: drivers, packages, stops.
 */
export function OperationsStatsCard({
  driversRequired,
  totalPackages,
  totalStops,
  anchorPackages,
  satellitePackages,
  anchorStops,
  satelliteStores,
}: Props) {
  const satelliteStops = satelliteStores * 2;

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-5">
      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Operational Footprint
        </h3>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          icon={<Users className="h-4 w-4" />}
          value={driversRequired}
          label="Drivers"
          unit="required"
          glossaryKey="drivers_required"
        />
        <StatTile
          icon={<Package className="h-4 w-4" />}
          value={totalPackages}
          label="Packages"
          unit="total"
          glossaryKey="total_packages"
          breakdown={`${formatNumber(anchorPackages)} anchor + ${formatNumber(satellitePackages)} satellite`}
        />
        <StatTile
          icon={<MapPin className="h-4 w-4" />}
          value={totalStops}
          label="Stops"
          unit="total"
          glossaryKey="total_stops"
          breakdown={`${formatNumber(anchorStops)} anchor + ${formatNumber(satelliteStops)} satellite`}
        />
      </div>

      {/* Interpretation microcopy */}
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Operational footprint based on current input assumptions.
      </p>
    </div>
  );
}

