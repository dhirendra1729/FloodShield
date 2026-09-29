"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Layers, Play, TriangleAlert } from "lucide-react";

import {
  Button,
  Callout,
  Skeleton,
  Toggle,
} from "@/components/ui";
import type { BasemapId } from "@/lib/basemaps";

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

/**
 * Layer inventory. Every entry maps to a real GeoJSON or raster in
 * `frontend/public/data`; nothing here is drawn from placeholder geometry.
 */
const LAYER_GROUPS: {
  heading: string;
  items: { key: keyof Layers; label: string; hint: string }[];
}[] = [
  {
    heading: "Terrain and land cover",
    items: [
      { key: "dem", label: "Terrain elevation", hint: "Bundled DEM over the Bhuragaon reach" },
      { key: "lulc", label: "Land cover", hint: "Classified land-use raster" },
    ],
  },
  {
    heading: "Infrastructure",
    items: [
      { key: "roads", label: "Road network", hint: "OpenStreetMap extract" },
      { key: "buildings", label: "Buildings", hint: "Footprint polygons" },
      { key: "shelters", label: "Shelters", hint: "Designated relief locations" },
    ],
  },
  {
    heading: "Runoff analysis",
    items: [
      {
        key: "floodDepth",
        label: "Runoff flood estimate",
        hint: "Flat-water (bathtub) approximation — see note below",
      },
      {
        key: "aiSafeSpots",
        label: "Candidate refuges",
        hint: "Contiguous high ground above the estimated water surface",
      },
    ],
  },
];

interface Layers {
  dem: boolean;
  lulc: boolean;
  roads: boolean;
  buildings: boolean;
  shelters: boolean;
  floodDepth: boolean;
  aiSafeSpots: boolean;
}

const INITIAL_LAYERS: Layers = {
  dem: false,
  lulc: false,
  roads: true,
  buildings: false,
  shelters: false,
  floodDepth: false,
  aiSafeSpots: false,
};

export default function InundationMapView({ basemap }: { basemap: BasemapId }) {
  const [layers, setLayers] = useState<Layers>(INITIAL_LAYERS);
  const [safeSpots, setSafeSpots] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const toggle = (key: keyof Layers) => (value: boolean) =>
    setLayers((prev) => ({ ...prev, [key]: value }));

  /**
   * Drives the rainfall/runoff module, which is what writes flood_depth.png and
   * derives the candidate refuges. It is deliberately a separate action from the
   * dam-break solver in the studio — the two are different models and the UI
   * must not imply one produced the other.
   */
  const runRunoff = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const csv = await fetch("/data/sample_rainfall.csv", { cache: "no-store" });
      if (!csv.ok) throw new Error(`could not load rainfall series (${csv.status})`);
      const csvData = await csv.text();

      const res = await fetch("/api/wflow/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_data: csvData, soil_moisture: "Normal" }),
      });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message ?? "runoff run failed");

      setSafeSpots(json.safe_spots ?? []);
      setLayers((prev) => ({ ...prev, floodDepth: true, aiSafeSpots: true }));
      setHasRun(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "runoff run failed");
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row">
      {/* ------------------------------------------------------------------ */}
      {/* Controls                                                           */}
      {/* ------------------------------------------------------------------ */}
      <aside className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-edge bg-surface-sunken/60 overflow-y-auto fs-scroll max-h-[45vh] lg:max-h-none">
        <div className="p-4 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-content flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand" aria-hidden />
              Map layers
            </h2>
            <p className="text-2xs text-content-faint mt-1">
              Bhuragaon reach, Brahmaputra — pilot basin for this build.
            </p>
          </div>

          {LAYER_GROUPS.map((group) => (
            <fieldset key={group.heading} className="space-y-1">
              <legend className="fs-label mb-2">{group.heading}</legend>
              {group.items.map((item) => (
                <Toggle
                  key={item.key}
                  label={item.label}
                  hint={item.hint}
                  checked={layers[item.key]}
                  onChange={toggle(item.key)}
                />
              ))}
            </fieldset>
          ))}

          <div className="pt-4 border-t border-edge space-y-3">
            <Button
              variant="primary"
              className="w-full"
              loading={running}
              loadingLabel="Running…"
              onClick={runRunoff}
            >
              <Play className="w-4 h-4" aria-hidden />
              Run runoff estimate
            </Button>
            <p className="text-2xs text-content-faint leading-relaxed">
              Feeds the bundled rainfall series through the SCS-CN runoff module to
              produce the flood estimate and candidate refuges.
            </p>
          </div>

          {error && (
            <Callout tone="danger" title="Runoff run failed">
              {error}
            </Callout>
          )}

          <Callout tone="warning" title="What this layer is">
            The runoff flood estimate is a <strong>flat-water approximation</strong>:
            one still-water surface is fitted from peak discharge, and every DEM
            cell below it is flooded. It is not a solution of the shallow-water
            equations.
            <br />
            <br />
            For a solved depth and velocity field, run a scenario in{" "}
            <strong>Breach Studio</strong>, which uses the ANUGA 2D finite-volume
            solver.
          </Callout>

          {hasRun && !layers.floodDepth && (
            <p className="text-2xs text-content-faint">
              A runoff estimate is available — turn the layer back on to display it.
            </p>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Map                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 min-h-[55vh] lg:min-h-0 relative">
        <LeafletMap layers={layers} aiSafeSpots={safeSpots} basemap={basemap} />

        {!hasRun && (
          <div className="absolute bottom-4 left-4 z-[400] max-w-xs pointer-events-none">
            <div className="fs-panel px-3.5 py-3">
              <p className="text-2xs text-content-subtle leading-relaxed">
                <TriangleAlert
                  className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-warning"
                  aria-hidden
                />
                No runoff estimate computed yet. Turn on <strong>Terrain</strong> or{" "}
                <strong>Land cover</strong>, or run the estimate to add the flood
                layer.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
