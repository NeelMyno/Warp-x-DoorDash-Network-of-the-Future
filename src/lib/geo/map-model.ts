/**
 * Pure functions for building map model from ZIP geocode data.
 * This separates business logic from MapLibre rendering.
 */

import type { LatLng } from "./zip";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MapStop {
  id: string;
  name: string;
  zip: string;
  packages: number;
  isAnchor: boolean;
}

export interface GeocodedMapStop extends MapStop {
  lat: number;
  lng: number;
}

export interface MapLine {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  satelliteId: string;
}

export interface MapCoverageStats {
  totalStops: number;
  locatedStops: number;
  missingStops: number;
  anchorLocated: boolean;
  satellitesLocated: number;
  satellitesTotal: number;
  isCapped: boolean;
  cappedTo: number;
}

export type MapUnavailableReason =
  | "no_zips_in_csv"        // No zip_code column or all blank
  | "anchor_zip_missing"    // Anchor has no ZIP, can't draw routes
  | "anchor_geocode_failed" // Anchor ZIP exists but geocoding failed
  | "no_satellites_located" // Anchor located but 0 satellites could be geocoded
  | "geocode_all_failed";   // All geocoding attempts failed

export interface MapModelReady {
  status: "ready" | "partial";
  anchor: GeocodedMapStop;
  satellites: GeocodedMapStop[];
  lines: MapLine[];
  coverage: MapCoverageStats;
}

export interface MapModelUnavailable {
  status: "unavailable";
  reason: MapUnavailableReason;
  coverage: MapCoverageStats;
}

export type MapModel = MapModelReady | MapModelUnavailable;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_SATELLITES_ON_MAP = 150;

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildMapModelInput {
  anchorId: string;
  anchorZip: string | null | undefined;
  satellites: Array<{
    id: string;
    name: string;
    zip: string | null | undefined;
    packages: number;
  }>;
  zipToLatLng: Map<string, LatLng>;
}

/**
 * Build a map model from anchor/satellites and geocode results.
 * This is a pure function suitable for testing.
 */
export function buildAnchorMapModel(input: BuildMapModelInput): MapModel {
  const { anchorId, anchorZip, satellites, zipToLatLng } = input;

  // Filter satellites with valid ZIPs, sort by packages desc, cap to limit
  const satsWithZip = satellites
    .filter((s) => s.zip)
    .sort((a, b) => b.packages - a.packages);

  const cappedSatellites = satsWithZip.slice(0, MAX_SATELLITES_ON_MAP);
  const isCapped = satsWithZip.length > MAX_SATELLITES_ON_MAP;

  const totalStops = 1 + satellites.length; // anchor + all satellites
  const satellitesTotal = satellites.length;

  // Check if we have any ZIPs at all
  const hasAnyZips = Boolean(anchorZip) || satellites.some((s) => s.zip);
  if (!hasAnyZips) {
    return {
      status: "unavailable",
      reason: "no_zips_in_csv",
      coverage: {
        totalStops,
        locatedStops: 0,
        missingStops: totalStops,
        anchorLocated: false,
        satellitesLocated: 0,
        satellitesTotal,
        isCapped: false,
        cappedTo: MAX_SATELLITES_ON_MAP,
      },
    };
  }

  // Try to geocode anchor
  const anchorCoords = anchorZip ? zipToLatLng.get(anchorZip) : undefined;

  // If anchor has no ZIP at all
  if (!anchorZip) {
    const satellitesLocated = countLocatedSatellites(cappedSatellites, zipToLatLng);
    return {
      status: "unavailable",
      reason: "anchor_zip_missing",
      coverage: {
        totalStops,
        locatedStops: satellitesLocated,
        missingStops: totalStops - satellitesLocated,
        anchorLocated: false,
        satellitesLocated,
        satellitesTotal,
        isCapped,
        cappedTo: MAX_SATELLITES_ON_MAP,
      },
    };
  }

  // If anchor ZIP exists but geocoding failed
  if (!anchorCoords) {
    const satellitesLocated = countLocatedSatellites(cappedSatellites, zipToLatLng);
    return {
      status: "unavailable",
      reason: "anchor_geocode_failed",
      coverage: {
        totalStops,
        locatedStops: satellitesLocated,
        missingStops: totalStops - satellitesLocated,
        anchorLocated: false,
        satellitesLocated,
        satellitesTotal,
        isCapped,
        cappedTo: MAX_SATELLITES_ON_MAP,
      },
    };
  }

  // Geocode satellites
  const geocodedSatellites: GeocodedMapStop[] = [];
  for (const sat of cappedSatellites) {
    if (!sat.zip) continue;
    const coords = zipToLatLng.get(sat.zip);
    if (coords) {
      geocodedSatellites.push({
        id: sat.id,
        name: sat.name,
        zip: sat.zip,
        packages: sat.packages,
        isAnchor: false,
        lat: coords.lat,
        lng: coords.lng,
      });
    }
  }

  const satellitesLocated = geocodedSatellites.length;

  // If no satellites could be located
  if (satellitesLocated === 0 && satellitesTotal > 0) {
    return {
      status: "unavailable",
      reason: "no_satellites_located",
      coverage: {
        totalStops,
        locatedStops: 1, // anchor is located
        missingStops: totalStops - 1,
        anchorLocated: true,
        satellitesLocated: 0,
        satellitesTotal,
        isCapped,
        cappedTo: MAX_SATELLITES_ON_MAP,
      },
    };
  }

  // Build anchor stop
  const anchor: GeocodedMapStop = {
    id: anchorId,
    name: anchorId,
    zip: anchorZip,
    packages: 0,
    isAnchor: true,
    lat: anchorCoords.lat,
    lng: anchorCoords.lng,
  };

  // Build lines from anchor to each satellite
  const lines: MapLine[] = geocodedSatellites.map((sat) => ({
    from: { lat: anchor.lat, lng: anchor.lng },
    to: { lat: sat.lat, lng: sat.lng },
    satelliteId: sat.id,
  }));

  const locatedStops = 1 + satellitesLocated;
  const isPartial = locatedStops < totalStops || isCapped;

  return {
    status: isPartial ? "partial" : "ready",
    anchor,
    satellites: geocodedSatellites,
    lines,
    coverage: {
      totalStops,
      locatedStops,
      missingStops: totalStops - locatedStops,
      anchorLocated: true,
      satellitesLocated,
      satellitesTotal,
      isCapped,
      cappedTo: MAX_SATELLITES_ON_MAP,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function countLocatedSatellites(
  satellites: Array<{ zip: string | null | undefined }>,
  zipToLatLng: Map<string, LatLng>
): number {
  let count = 0;
  for (const sat of satellites) {
    if (sat.zip && zipToLatLng.has(sat.zip)) {
      count++;
    }
  }
  return count;
}

/**
 * Get human-readable message for unavailable reason.
 */
export function getUnavailableMessage(reason: MapUnavailableReason): {
  title: string;
  description: string;
} {
  switch (reason) {
    case "no_zips_in_csv":
      return {
        title: "Map unavailable",
        description: "ZIP codes weren't provided in the uploaded CSV. Add a zip_code column to enable maps.",
      };
    case "anchor_zip_missing":
      return {
        title: "Anchor ZIP missing",
        description: "The anchor store doesn't have a ZIP code, so routes can't be drawn.",
      };
    case "anchor_geocode_failed":
      return {
        title: "Couldn't locate anchor",
        description: "We couldn't find coordinates for the anchor's ZIP code.",
      };
    case "no_satellites_located":
      return {
        title: "No satellite locations",
        description: "None of the satellite ZIP codes could be located.",
      };
    case "geocode_all_failed":
      return {
        title: "Geocoding failed",
        description: "We couldn't locate any ZIP codes. Please check the data or try again.",
      };
  }
}

