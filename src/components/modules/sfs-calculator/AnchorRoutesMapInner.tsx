"use client";

import * as React from "react";
import Map, { Source, Layer, Marker, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLatBoundsLike } from "maplibre-gl";
import type { GeocodedMapStop } from "@/lib/geo/map-model";

// Use CartoDB Positron (free, no API key required)
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export interface AnchorRoutesMapInnerProps {
  anchor?: GeocodedMapStop;
  satellites: GeocodedMapStop[];
}

export function AnchorRoutesMapInner(props: AnchorRoutesMapInnerProps) {
  const { anchor, satellites } = props;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = React.useRef<any>(null);

  // Build GeoJSON for lines (anchor → each satellite)
  const linesGeoJson = React.useMemo(() => {
    if (!anchor) return { type: "FeatureCollection" as const, features: [] };
    
    const features = satellites.map((sat) => ({
      type: "Feature" as const,
      properties: { id: sat.id },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [anchor.lng, anchor.lat],
          [sat.lng, sat.lat],
        ],
      },
    }));

    return { type: "FeatureCollection" as const, features };
  }, [anchor, satellites]);

  // Calculate bounds to fit all points
  const initialBounds = React.useMemo<LngLatBoundsLike | undefined>(() => {
    const allPoints = anchor ? [anchor, ...satellites] : satellites;
    if (allPoints.length === 0) return undefined;
    if (allPoints.length === 1) {
      const p = allPoints[0];
      return [[p.lng - 0.1, p.lat - 0.1], [p.lng + 0.1, p.lat + 0.1]];
    }

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const p of allPoints) {
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
    }

    // Add 10% padding
    const lngPad = (maxLng - minLng) * 0.1 || 0.1;
    const latPad = (maxLat - minLat) * 0.1 || 0.1;

    return [
      [minLng - lngPad, minLat - latPad],
      [maxLng + lngPad, maxLat + latPad],
    ];
  }, [anchor, satellites]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <Map
        ref={mapRef}
        initialViewState={{
          bounds: initialBounds,
          fitBoundsOptions: { padding: 40 },
        }}
        style={{ width: "100%", height: 320 }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Route lines */}
        <Source id="routes" type="geojson" data={linesGeoJson}>
          <Layer
            id="route-lines"
            type="line"
            paint={{
              "line-color": "#6366f1",
              "line-width": 2,
              "line-opacity": 0.6,
            }}
          />
        </Source>

        {/* Satellite markers */}
        {satellites.map((sat) => (
          <Marker key={sat.id} longitude={sat.lng} latitude={sat.lat} anchor="center">
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-indigo-400 shadow-md"
              title={`${sat.name} (${sat.zip})`}
            />
          </Marker>
        ))}

        {/* Anchor marker (larger, distinct) */}
        {anchor && (
          <Marker longitude={anchor.lng} latitude={anchor.lat} anchor="center">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-orange-500 shadow-lg"
              title={`${anchor.name} (Anchor)`}
            >
              <span className="text-[10px] font-bold text-white">A</span>
            </div>
          </Marker>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-medium shadow-sm backdrop-blur-sm dark:bg-zinc-900/90">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border border-white bg-orange-500" />
          <span>Anchor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border border-white bg-indigo-400" />
          <span>Satellite</span>
        </div>
      </div>

      {/* Attribution (legal requirement for free tiles) */}
      <div className="absolute bottom-3 right-3 text-[9px] text-muted-foreground/70">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> · Tiles by <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer" className="hover:underline">CARTO</a>
      </div>

      {/* Illustrative disclaimer */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-white/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm dark:bg-zinc-900/80">
        Lines show anchor → satellite relationships (not driving routes)
      </div>
    </div>
  );
}

