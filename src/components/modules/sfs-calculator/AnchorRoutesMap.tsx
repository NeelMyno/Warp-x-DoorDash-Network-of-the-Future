"use client";

import * as React from "react";
import { AlertCircle, Download, Loader2, MapPin, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { batchGeocodeZips, normalizeZip } from "@/lib/geo/zip";
import {
  buildAnchorMapModel,
  getUnavailableMessage,
  type MapModel,
  type MapCoverageStats,
} from "@/lib/geo/map-model";
import type { SfsStopWithDistance } from "@/lib/sfs-calculator/types";

// Dynamically import MapGL to avoid SSR issues
const MapComponent = dynamic(
  () => import("./AnchorRoutesMapInner").then((mod) => mod.AnchorRoutesMapInner),
  { ssr: false, loading: () => <MapSkeleton /> }
);

const LOADING_SLOW_THRESHOLD_MS = 3000;

export interface AnchorRoutesMapProps {
  anchorId: string;
  anchorZip?: string | null;
  satellites: SfsStopWithDistance[];
  onDownloadTemplate?: () => void;
}

type LoadingState = "idle" | "loading" | "loading_slow" | "done" | "error";

function MapSkeleton({ showSlowMessage = false }: { showSlowMessage?: boolean }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-background/5">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      {showSlowMessage && (
        <span className="text-xs text-muted-foreground">Still working…</span>
      )}
    </div>
  );
}

export function AnchorRoutesMap(props: AnchorRoutesMapProps) {
  const { anchorId, anchorZip, satellites, onDownloadTemplate } = props;

  const [loadingState, setLoadingState] = React.useState<LoadingState>("idle");
  const [mapModel, setMapModel] = React.useState<MapModel | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Ref for abort controller to cancel stale requests
  const abortControllerRef = React.useRef<AbortController | null>(null);
  // Ref for request ID to ignore stale responses
  const requestIdRef = React.useRef(0);

  // Check if we have any ZIPs at all (quick check before geocoding)
  const hasAnyZips = React.useMemo(() => {
    return Boolean(anchorZip) || satellites.some((s) => s.zip_code);
  }, [anchorZip, satellites]);

  // Build satellite input for map model
  const satelliteInputs = React.useMemo(() => {
    return satellites.map((s) => ({
      id: s.store_id || s.store_name,
      name: s.store_name,
      zip: s.zip_code ? normalizeZip(s.zip_code) : null,
      packages: s.packages,
    }));
  }, [satellites]);

  // Geocode and build map model
  const loadMap = React.useCallback(async () => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const thisRequestId = ++requestIdRef.current;

    if (!hasAnyZips) {
      const model = buildAnchorMapModel({
        anchorId,
        anchorZip: normalizeZip(anchorZip),
        satellites: satelliteInputs,
        zipToLatLng: new Map(),
      });
      setMapModel(model);
      setLoadingState("done");
      return;
    }

    setLoadingState("loading");
    setErrorMessage(null);

    // Show "still working" after threshold
    const slowTimer = setTimeout(() => {
      if (requestIdRef.current === thisRequestId) {
        setLoadingState("loading_slow");
      }
    }, LOADING_SLOW_THRESHOLD_MS);

    try {
      // Collect all ZIPs to geocode
      const zipsToGeocode: string[] = [];
      if (anchorZip) {
        const normalized = normalizeZip(anchorZip);
        if (normalized) zipsToGeocode.push(normalized);
      }
      for (const sat of satelliteInputs) {
        if (sat.zip) zipsToGeocode.push(sat.zip);
      }

      // Batch geocode with abort signal
      const zipToLatLng = await batchGeocodeZips(zipsToGeocode, {
        signal: controller.signal,
      });

      // Ignore if this request was superseded
      if (requestIdRef.current !== thisRequestId || controller.signal.aborted) {
        clearTimeout(slowTimer);
        return;
      }

      // Build map model
      const model = buildAnchorMapModel({
        anchorId,
        anchorZip: normalizeZip(anchorZip),
        satellites: satelliteInputs,
        zipToLatLng,
      });

      setMapModel(model);
      setLoadingState("done");
    } catch (err) {
      if (requestIdRef.current !== thisRequestId || controller.signal.aborted) {
        clearTimeout(slowTimer);
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Geocoding failed."
      );
      setLoadingState("error");
    } finally {
      clearTimeout(slowTimer);
    }
  }, [anchorId, anchorZip, hasAnyZips, satelliteInputs]);

  // Load map on mount and when inputs change
  React.useEffect(() => {
    loadMap();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadMap]);

  // Loading state
  if (loadingState === "loading" || loadingState === "loading_slow") {
    return <MapSkeleton showSlowMessage={loadingState === "loading_slow"} />;
  }

  // Error state (network/geocoding failure)
  if (loadingState === "error") {
    return (
      <MapErrorCard
        title="Couldn't load map"
        message={errorMessage || "We couldn't locate ZIP codes right now."}
        onRetry={loadMap}
      />
    );
  }

  // No model yet (shouldn't happen, but safe fallback)
  if (!mapModel) {
    return <MapSkeleton />;
  }

  // Unavailable states (various reasons)
  if (mapModel.status === "unavailable") {
    const { title, description } = getUnavailableMessage(mapModel.reason);
    return (
      <MapUnavailableCard
        title={title}
        description={description}
        coverage={mapModel.coverage}
        onDownloadTemplate={onDownloadTemplate}
        showDownload={mapModel.reason === "no_zips_in_csv"}
      />
    );
  }

  // Ready or partial: render the map
  return (
    <div className="space-y-2">
      {/* Coverage status bar */}
      <MapCoverageBar coverage={mapModel.coverage} />
      <MapComponent anchor={mapModel.anchor} satellites={mapModel.satellites} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

interface MapUnavailableCardProps {
  title: string;
  description: string;
  coverage: MapCoverageStats;
  onDownloadTemplate?: () => void;
  showDownload?: boolean;
}

function MapUnavailableCard({
  title,
  description,
  onDownloadTemplate,
  showDownload = false,
}: MapUnavailableCardProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-background/5 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      {showDownload && onDownloadTemplate && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadTemplate}
          className="mt-2 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Download template
        </Button>
      )}
    </div>
  );
}

interface MapErrorCardProps {
  title: string;
  message: string;
  onRetry: () => void;
}

function MapErrorCard({ title, message, onRetry }: MapErrorCardProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
        <AlertCircle className="h-6 w-6 text-amber-500" />
      </div>
      <div>
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{message}</p>
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          Map is optional—calculator results are unaffected.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}

function MapCoverageBar({ coverage }: { coverage: MapCoverageStats }) {
  const { locatedStops, totalStops, missingStops, isCapped, cappedTo } = coverage;

  // Don't show if everything is perfect
  if (locatedStops === totalStops && !isCapped) {
    return null;
  }

  const parts: string[] = [];

  if (missingStops > 0) {
    parts.push(`${missingStops} stop${missingStops > 1 ? "s" : ""} missing ZIP`);
  }

  if (isCapped) {
    parts.push(`showing top ${cappedTo} satellites`);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        {locatedStops}/{totalStops} stops on map
        {parts.length > 0 && ` · ${parts.join(" · ")}`}
      </span>
    </div>
  );
}

