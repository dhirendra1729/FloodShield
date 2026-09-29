"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleDashed, CircleSlash, ExternalLink } from "lucide-react";

import { Badge, Callout, Panel, Skeleton, type Tone } from "@/components/ui";

type Status = "met" | "partial" | "not-met";

const STATUS_META: Record<Status, { label: string; tone: Tone; icon: typeof CircleCheck }> = {
  met: { label: "Met", tone: "success", icon: CircleCheck },
  partial: { label: "Partially met", tone: "warning", icon: CircleDashed },
  "not-met": { label: "Not met", tone: "danger", icon: CircleSlash },
};

interface Deliverable {
  id: string;
  title: string;
  requirement: string;
  status: Status;
  /** What the build actually does, stated without hedging. */
  evidence: string;
  /** Where the shortfall is, if there is one. */
  gap?: string;
}

/**
 * Status here reflects what the repository does today, not what is planned.
 * A row marked "partially met" names the missing component in `gap` rather
 * than leaving the reader to infer it.
 */
const DELIVERABLES: Deliverable[] = [
  {
    id: "D1",
    title: "2D dam-break simulation",
    requirement:
      "Two-dimensional hydrodynamic simulation of a dam breach, at the resolution the problem statement names (SPH and Delft3D are both cited).",
    status: "partial",
    evidence:
      "ANUGA 4.x solves the 2D shallow-water equations on a finite-volume mesh and is verified against the exact Ritter (1892) dam-break solution — normalised RMSE and Pearson r are computed from the run, see the Verification view.",
    gap:
      "Neither SPH nor Delft3D-FLOW is executed. The Delft3D image available in this environment contains source only with no built Linux binaries, and PySPH is not installed. Both are reported as not executed rather than approximated.",
  },
  {
    id: "D2",
    title: "Dam parameter catalogue and benchmark presets",
    requirement:
      "A structured store of dam geometry and reservoir parameters, including historical failure cases for back-testing.",
    status: "met",
    evidence:
      "backend/catalog.py holds five presets with CWC NRLD / NDSA parameters, served over GET /api/dam/catalog. Three historical failures — Machchhu-II (1979), Teesta-III (2023) and Rishiganga (2021) — are back-tested against their recorded outcomes.",
  },
  {
    id: "D3",
    title: "Downstream inundation extent and GIS export",
    requirement:
      "Delineation of the flooded area downstream of the breach, delivered in forms a GIS user can open.",
    status: "met",
    evidence:
      "Peak depth, arrival time and maximum velocity are exported as ESRI Shapefile and KML from the simulation result, with the DEM raster as the georeferenced base.",
  },
  {
    id: "D4",
    title: "Satellite-based validation of the simulated extent",
    requirement:
      "Independent observation of the flood extent from satellite imagery, compared against the model (Google Earth Engine is named in the statement).",
    status: "partial",
    evidence:
      "Sentinel-1 SAR scenes are retrieved live through the STAC Element84 catalogue and read from the scene raster. Speckle is suppressed with a Refined Lee filter before Otsu thresholding delineates observed water, which is then scored against the simulated extent as IoU and Dice. An empty scene list is reported as an empty result.",
    gap:
      "The imagery route is STAC rather than Google Earth Engine, so a deployment without outbound network returns no scenes rather than a fallback estimate.",
  },
  {
    id: "D5",
    title: "Hazard classification for decision support",
    requirement:
      "Translation of the modelled field into something an emergency manager can act on.",
    status: "met",
    evidence:
      "Depth and depth-averaged velocity are combined into a USBR/ACER hazard index per cell, with arrival time carried alongside so a reach can be prioritised by when it wets, not only by how deep it gets.",
  },
];

interface HealthResponse {
  status?: string;
  system?: string;
  problem_statement?: string;
  solvers?: {
    primary?: string;
    anuga_version?: string;
    verification?: string;
    satellite?: string;
    unavailable?: Record<string, string>;
  };
}

export default function DeliverablesView() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setHealth(json);
      } catch {
        if (!cancelled) setHealth(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tally = DELIVERABLES.reduce(
    (acc, d) => ({ ...acc, [d.status]: acc[d.status] + 1 }),
    { met: 0, partial: 0, "not-met": 0 } as Record<Status, number>,
  );

  return (
    <div className="h-full overflow-y-auto fs-scroll">
      <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
        <header>
          <h2 className="text-xl font-bold text-content tracking-tight">
            Deliverables traceability
          </h2>
          <p className="text-sm text-content-subtle mt-1 max-w-[70ch]">
            What the problem statement asks for, and what this build does about each
            item today.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{tally.met} met</Badge>
          <Badge tone="warning">{tally.partial} partially met</Badge>
          {tally["not-met"] > 0 && (
            <Badge tone="danger">{tally["not-met"]} not met</Badge>
          )}
        </div>

        <Callout tone="warning" title="Verify the requirement text against the official portal">
          The wording quoted below was reconstructed from public problem-statement
          summaries rather than the SIH portal itself. Treat the{" "}
          <strong>status and evidence</strong> columns as accurate — they describe
          this repository — but confirm the requirement wording against the official
          statement before it is relied on.
        </Callout>

        {/* ---------------------------------------------------------------- */}
        {/* Deliverable rows                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-3">
          {DELIVERABLES.map((d) => {
            const meta = STATUS_META[d.status];
            const Icon = meta.icon;
            return (
              <Panel key={d.id} className="!shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="fs-numeric text-xs text-content-faint">{d.id}</span>
                    <Badge tone={meta.tone} icon={<Icon className="w-3 h-3" aria-hidden />}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="min-w-0 flex-1 basis-full sm:basis-0">
                    <h3 className="text-md font-semibold text-content">{d.title}</h3>
                    <p className="text-xs text-content-faint mt-1.5 leading-relaxed">
                      <span className="fs-label mr-1.5">Requirement</span>
                      {d.requirement}
                    </p>
                    <p className="text-sm text-content-muted mt-3 leading-relaxed">
                      {d.evidence}
                    </p>
                    {d.gap && (
                      <div className="mt-3">
                        <Callout tone="warning" title="Shortfall">
                          {d.gap}
                        </Callout>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Live solver status                                                */}
        {/* ---------------------------------------------------------------- */}
        <Panel
          title="Solver availability"
          subtitle="Read from GET /api/health on this deployment, not from configuration."
        >
          {checking ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : !health?.solvers ? (
            <p className="text-sm text-content-subtle">
              The backend did not answer, so no availability can be reported. Start
              the solver service with <code className="font-mono">./start.sh</code>.
            </p>
          ) : (
            <div className="space-y-3">
              <StatusRow label="Primary solver" value={health.solvers.primary} ok />
              <StatusRow
                label="ANUGA version"
                value={health.solvers.anuga_version}
                ok
              />
              <StatusRow label="Verification" value={health.solvers.verification} ok />
              <StatusRow label="Satellite" value={health.solvers.satellite} ok />

              {health.solvers.unavailable &&
                Object.entries(health.solvers.unavailable).map(([name, reason]) => (
                  <StatusRow key={name} label={name} value={reason} />
                ))}
            </div>
          )}
        </Panel>

        <p className="text-2xs text-content-faint leading-relaxed pb-2">
          <ExternalLink className="w-3 h-3 inline mr-1 -mt-0.5" aria-hidden />
          Interactive API documentation is served at{" "}
          <code className="font-mono">/docs</code> on the backend port while the
          stack is running.
        </p>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok = false,
}: {
  label: string;
  value?: string;
  ok?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 border-b border-edge last:border-b-0">
      <span className="fs-label w-40 shrink-0">{label}</span>
      <span
        className={
          ok ? "text-sm text-content-muted" : "text-sm text-content-subtle italic"
        }
      >
        {value ?? "—"}
      </span>
      {!ok && <Badge tone="danger">Not executed</Badge>}
    </div>
  );
}
