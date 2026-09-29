"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  Globe,
  Info,
  Layers,
  Pause,
  Play,
  Satellite,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Panel,
  Segmented,
  SelectField,
  Skeleton,
  Slider,
  Stat,
  TabPanel,
  Tabs,
  type SegmentedOption,
  type SelectOption,
  type TabItem,
  type Tone,
} from "@/components/ui";
import { driftHint, driftTone } from "@/lib/metrics";

/* -------------------------------------------------------------------------- */
/* API shapes                                                                 */
/* -------------------------------------------------------------------------- */

interface DamPreset {
  id: string;
  name: string;
  state: string;
  dam_height_m: number;
  reservoir_volume_mcm: number;
  crest_length_m: number;
  failure_mode?: string;
  default_model?: string;
  latitude?: number;
  longitude?: number;
  historical_event?: string;
}

interface SimResult {
  status: "success";
  dam_name: string;
  failure_mode: string;
  breach_model: string;
  terrain?: { dataset: string; tile: string; cell_size_m: number };
  breach_summary: {
    peak_discharge_m3s: number;
    formation_time_min: number;
    breach_width_m: number;
    volume_drained_mcm: number;
  };
  hydrograph: { time_minutes: number[]; discharge_m3s: number[] };
  hydrodynamics: {
    engine: string;
    max_depth_m: number;
    max_velocity_mps: number;
    inundated_area_km2: number;
    downstream_inundated_area_km2: number;
    downstream_first_arrival_min: number;
    mass_conservation_volume_drift_pct: number;
    wall_time_s: number;
    grid_shape: number[];
  };
  timeline: {
    time_minutes: number;
    wave_front_distance_km: number;
    inundated_km2: number;
  }[];
  hadr_settlements: {
    village_name: string;
    distance_km: number;
    wave_arrival_min: number | null;
    estimated_depth_m: number;
    hazard_level: string;
    evacuation_status: string;
  }[];
}

type TabId = "hydrograph" | "timeline" | "benchmark" | "satellite" | "hadr";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const FAILURE_MODES: SegmentedOption<string>[] = [
  { value: "overtopping", label: "Overtopping" },
  { value: "piping", label: "Piping" },
  { value: "sudden_collapse", label: "Sudden" },
];

const BREACH_MODELS: SelectOption[] = [
  { value: "froehlich", label: "Froehlich (2008) — non-homogeneous" },
  { value: "macdonald", label: "MacDonald & Langridge-Monopolis (1984)" },
  { value: "von_thun", label: "Von Thun & Gillette (1990)" },
];

const TABS: TabItem<TabId>[] = [
  { id: "hydrograph", label: "Breach hydrograph", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "timeline", label: "Wavefront", icon: <Clock className="w-3.5 h-3.5" /> },
  { id: "benchmark", label: "Analytical benchmark", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { id: "satellite", label: "Sentinel-1 SAR", icon: <Satellite className="w-3.5 h-3.5" /> },
  { id: "hadr", label: "Downstream impact", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
];

const CHART_TOOLTIP = {
  background: "#1f1f21",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
} as const;

function hazardTone(level: string): Tone {
  switch (level) {
    case "EXTREME":
      return "danger";
    case "HIGH":
      return "warning";
    case "MODERATE":
      return "info";
    case "NONE":
      return "neutral";
    default:
      return "neutral";
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export interface DamBreakStudioProps {
  onSimulationComplete?: (result: SimResult) => void;
}

export default function DamBreakStudio({ onSimulationComplete }: DamBreakStudioProps) {
  const [benchmarks, setBenchmarks] = useState<DamPreset[]>([]);
  const [selectedDam, setSelectedDam] = useState<string>("");
  const [damDetails, setDamDetails] = useState<DamPreset | null>(null);

  const [damHeight, setDamHeight] = useState(25);
  const [reservoirVolume, setReservoirVolume] = useState(100.55);
  const [crestLength, setCrestLength] = useState(5125);
  const [failureMode, setFailureMode] = useState("overtopping");
  const [breachModel, setBreachModel] = useState("froehlich");
  const [simulationHours, setSimulationHours] = useState(4);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simResults, setSimResults] = useState<SimResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("hydrograph");

  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [satelliteData, setSatelliteData] = useState<any>(null);
  const [exporting, setExporting] = useState<"shp" | "kml" | null>(null);

  /* --- Catalog ---------------------------------------------------------- */

  const applyPreset = useCallback((dam: DamPreset) => {
    setDamDetails(dam);
    setSelectedDam(dam.id);
    setDamHeight(dam.dam_height_m);
    setReservoirVolume(dam.reservoir_volume_mcm);
    setCrestLength(dam.crest_length_m);
    setFailureMode(dam.failure_mode ?? "overtopping");
    setBreachModel(dam.default_model ?? "froehlich");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dam/catalog", { cache: "no-store" });
        const json = await res.json();
        if (cancelled || json.status !== "success" || !json.benchmarks?.length) return;
        setBenchmarks(json.benchmarks);
        const preferred =
          json.benchmarks.find((b: DamPreset) => b.id === "machchhu-ii") ??
          json.benchmarks[0];
        applyPreset(preferred);
      } catch {
        if (!cancelled) setRunError("Could not load the dam catalogue from the backend.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPreset]);

  const damOptions: SelectOption[] = useMemo(
    () =>
      benchmarks.map((b) => ({
        value: b.id,
        label: `${b.name} — ${b.state}`,
      })),
    [benchmarks],
  );

  /* --- Runners ---------------------------------------------------------- */

  const loadBenchmark = useCallback(async () => {
    try {
      const res = await fetch("/api/dam/benchmark", { cache: "no-store" });
      const data = await res.json();
      if (data.status !== "success") return;
      // The comparison is against a closed-form solution, not another solver:
      // one series is the numerical result, the other the exact reference.
      const chartData = (data.time_s ?? []).map((t: number, i: number) => ({
        time: t,
        anuga: data.anuga_floodshield_curve?.[i],
        analytical: data.analytical_curve?.[i],
      }));
      setBenchmarkData({ ...data, chartData });
    } catch {
      /* The tab renders its own unavailable state. */
    }
  }, []);

  const loadSatellite = useCallback(async (damName: string) => {
    try {
      const res = await fetch("/api/satellite/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dam_name: damName }),
      });
      setSatelliteData(await res.json());
    } catch (err) {
      // Keep the failure envelope: "no scene available" is a real answer and
      // must not be replaced by a placeholder score.
      setSatelliteData({ status: "error", message: String(err) });
    }
  }, []);

  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    setRunError(null);
    try {
      const res = await fetch("/api/dam/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dam_name: damDetails?.name ?? selectedDam,
          dam_height_m: damHeight,
          reservoir_volume_mcm: reservoirVolume,
          crest_length_m: crestLength,
          failure_mode: failureMode,
          breach_model: breachModel,
          simulation_hours: simulationHours,
          latitude: damDetails?.latitude ?? 22.7667,
          longitude: damDetails?.longitude ?? 70.8667,
        }),
      });
      const data = await res.json();
      if (data.status !== "success") {
        throw new Error(data.message ?? "the solver returned no result");
      }
      setSimResults(data);
      setPlaybackIdx(data.timeline ? data.timeline.length - 1 : 0);
      onSimulationComplete?.(data);
      loadBenchmark();
      loadSatellite(damDetails?.name ?? selectedDam);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "the solver returned no result");
    } finally {
      setIsSimulating(false);
    }
  }, [
    damDetails,
    selectedDam,
    damHeight,
    reservoirVolume,
    crestLength,
    failureMode,
    breachModel,
    simulationHours,
    onSimulationComplete,
    loadBenchmark,
    loadSatellite,
  ]);

  const exportGis = useCallback(
    async (kind: "shp" | "kml") => {
      setExporting(kind);
      try {
        const res = await fetch(`/api/gis/export/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dam_name: damDetails?.name ?? selectedDam }),
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          kind === "shp"
            ? `${selectedDam}_inundation_shapefile.zip`
            : `${selectedDam}_inundation.kml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch {
        setRunError(`The ${kind.toUpperCase()} export failed.`);
      } finally {
        setExporting(null);
      }
    },
    [damDetails, selectedDam],
  );

  /* --- Playback --------------------------------------------------------- */

  useEffect(() => {
    if (!isPlaying || !simResults?.timeline) return;
    const id = setInterval(() => {
      setPlaybackIdx((prev) => {
        if (prev >= simResults.timeline.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    return () => clearInterval(id);
  }, [isPlaying, simResults]);

  /* --- Derived ---------------------------------------------------------- */

  const hydrographData = useMemo(
    () =>
      simResults?.hydrograph
        ? simResults.hydrograph.time_minutes.map((t, i) => ({
            time: t,
            discharge: simResults.hydrograph.discharge_m3s[i],
          }))
        : [],
    [simResults],
  );

  const currentFrame = simResults?.timeline?.[playbackIdx] ?? null;
  const h = simResults?.hydrodynamics ?? null;
  const b = simResults?.breach_summary ?? null;
  const drift = h?.mass_conservation_volume_drift_pct ?? null;

  return (
    <div className="h-full min-h-0 flex flex-col xl:flex-row overflow-hidden">
      {/* ==================================================================== */}
      {/* Scenario controls                                                    */}
      {/* ==================================================================== */}
      <aside className="xl:w-[340px] shrink-0 border-b xl:border-b-0 xl:border-r border-edge bg-surface-sunken/60 overflow-y-auto fs-scroll max-h-[50vh] xl:max-h-none">
        <div className="p-4 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-content">Scenario</h2>
            <p className="text-2xs text-content-faint mt-1">
              Presets carry CWC NRLD / NDSA geometry. Editing a slider overrides the
              preset for this run only.
            </p>
          </div>

          <SelectField
            label="Dam preset"
            value={selectedDam}
            options={
              damOptions.length
                ? damOptions
                : [{ value: "", label: "Loading catalogue…", disabled: true }]
            }
            onChange={(id) => {
              const found = benchmarks.find((d) => d.id === id);
              if (found) applyPreset(found);
            }}
          />

          {damDetails?.historical_event && (
            <div className="fs-panel-solid px-3.5 py-3">
              <p className="fs-label flex items-center gap-1.5 mb-1.5">
                <Info className="w-3 h-3" aria-hidden />
                Historical record
              </p>
              <p className="text-xs text-content-subtle leading-relaxed">
                {damDetails.historical_event}
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Slider
              label="Dam height, H_d"
              value={damHeight}
              min={5}
              max={150}
              step={1}
              unit="m"
              onChange={setDamHeight}
            />
            <Slider
              label="Reservoir storage, V_w"
              value={reservoirVolume}
              min={0.5}
              max={1000}
              step={0.5}
              unit="MCM"
              onChange={setReservoirVolume}
            />
            <Slider
              label="Crest length, L_c"
              value={crestLength}
              min={50}
              max={6000}
              step={50}
              unit="m"
              onChange={setCrestLength}
            />
            <Slider
              label="Simulation window"
              value={simulationHours}
              min={1}
              max={12}
              step={0.5}
              unit="h"
              onChange={setSimulationHours}
            />
          </div>

          <div>
            <p className="fs-label mb-2">Failure mechanism</p>
            <Segmented
              label="Failure mechanism"
              options={FAILURE_MODES}
              value={failureMode}
              onChange={setFailureMode}
              className="w-full"
            />
          </div>

          <SelectField
            label="Breach formulation"
            value={breachModel}
            options={BREACH_MODELS}
            onChange={setBreachModel}
            hint="Empirical peak-discharge and breach-width relations."
          />

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            loading={isSimulating}
            loadingLabel="Solving 2D shallow water…"
            onClick={runSimulation}
          >
            <Play className="w-4 h-4" aria-hidden />
            Run hydrodynamic model
          </Button>

          {runError && <Callout tone="danger" title="Run failed">{runError}</Callout>}
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* Results                                                              */}
      {/* ==================================================================== */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Header ---------------------------------------------------------- */}
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-edge bg-surface-sunken/40">
          <div className="min-w-0">
            <h2 className="text-md font-semibold text-content flex items-center gap-2">
              <Waves className="w-4 h-4 text-brand shrink-0" aria-hidden />
              <span className="truncate">Dam-break inundation studio</span>
            </h2>
            <p className="text-2xs text-content-faint mt-0.5 truncate">
              {h?.engine ?? "ANUGA 4.x 2D finite-volume shallow-water solver"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={exporting !== null}
              onClick={() => exportGis("shp")}
              title="Download an ESRI Shapefile bundle for QGIS or ArcGIS"
            >
              <FileArchive className="w-3.5 h-3.5" aria-hidden />
              {exporting === "shp" ? "Exporting…" : "Shapefile"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={exporting !== null}
              onClick={() => exportGis("kml")}
              title="Download a KML for Google Earth"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden />
              {exporting === "kml" ? "Exporting…" : "KML"}
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto fs-scroll p-4 sm:p-5 space-y-4">
          {/* Metric strip ------------------------------------------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              label="Peak outflow, Q_p"
              value={b?.peak_discharge_m3s ?? null}
              precision={0}
              unit="m³/s"
              tone="danger"
              hint={b ? `Breach width ${b.breach_width_m} m` : undefined}
            />
            <Stat
              label="Max water depth"
              value={h?.max_depth_m ?? null}
              precision={2}
              unit="m"
              tone="brand"
              hint={h ? `Peak velocity ${h.max_velocity_mps} m/s` : undefined}
            />
            <Stat
              label="Inundated area"
              value={h?.inundated_area_km2 ?? null}
              precision={2}
              unit="km²"
              tone="info"
              hint={b ? `Breach formed in ${b.formation_time_min} min` : undefined}
            />
            {/* Read from the solve, never from a literal. The previous build
                hard-coded "-0.00%" here, so the tile showed a conserved mass
                balance whether or not the run had conserved anything. */}
            <Stat
              label="Mass balance drift"
              value={drift}
              precision={4}
              unit="%"
              tone={driftTone(drift)}
              hint={driftHint(drift)}
            />
          </div>

          {/* Tabs --------------------------------------------------------- */}
          <Panel flush bodyClassName="p-4 sm:p-5">
            <Tabs items={TABS} value={activeTab} onChange={setActiveTab} className="border-b border-edge -mx-4 sm:-mx-5 px-4 sm:px-5 -mt-4 sm:-mt-5 pt-1 mb-4" />

            {/* Hydrograph ------------------------------------------------- */}
            <TabPanel id="hydrograph" active={activeTab === "hydrograph"}>
              {!simResults ? (
                <EmptyState
                  icon={<BarChart3 className="w-7 h-7" />}
                  title="No run yet"
                  description="Set the scenario on the left and run the model. The breach discharge hydrograph appears here."
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="fs-label">
                      Breach discharge against time
                    </p>
                    <p className="text-xs text-content-subtle">
                      Volume drained{" "}
                      <span className="fs-numeric text-content">
                        {b?.volume_drained_mcm} MCM
                      </span>
                    </p>
                  </div>
                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hydrographData} margin={{ top: 8, right: 12, bottom: 20, left: 4 }}>
                        <defs>
                          <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff8a80" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#ff8a80" stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 11, fill: "#9a9aa3" }}
                          tickLine={false}
                          label={{ value: "Time (min)", position: "insideBottom", offset: -12, fill: "#9a9aa3", fontSize: 11 }}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#9a9aa3" }} tickLine={false} width={64} />
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Area
                          type="monotone"
                          dataKey="discharge"
                          stroke="#ff8a80"
                          strokeWidth={2}
                          fill="url(#qGrad)"
                          name="Discharge (m³/s)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </TabPanel>

            {/* Timeline --------------------------------------------------- */}
            <TabPanel id="timeline" active={activeTab === "timeline"}>
              {!simResults?.timeline?.length ? (
                <EmptyState
                  icon={<Clock className="w-7 h-7" />}
                  title="No wavefront timeline"
                  description="Run a scenario to step through wave arrival down the reach."
                />
              ) : (
                <div className="space-y-4">
                  <div className="fs-panel-solid p-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        className="!rounded-full !w-11 !h-11 !px-0"
                        onClick={() => setIsPlaying((v) => !v)}
                        aria-label={isPlaying ? "Pause playback" : "Play playback"}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" aria-hidden />
                        ) : (
                          <Play className="w-4 h-4" aria-hidden />
                        )}
                      </Button>
                      <div>
                        <p className="fs-label">Elapsed</p>
                        <p className="fs-numeric text-sm text-content">
                          T + {currentFrame?.time_minutes ?? 0} min
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-6">
                      <div>
                        <p className="fs-label">Wavefront reach</p>
                        <p className="fs-numeric text-sm text-info">
                          {currentFrame ? `${currentFrame.wave_front_distance_km} km` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="fs-label">Active inundation</p>
                        <p className="fs-numeric text-sm text-danger">
                          {currentFrame ? `${currentFrame.inundated_km2} km²` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      type="range"
                      min={0}
                      max={simResults.timeline.length - 1}
                      value={playbackIdx}
                      aria-label="Simulation time step"
                      onChange={(e) => {
                        setPlaybackIdx(Number(e.target.value));
                        setIsPlaying(false);
                      }}
                      className="w-full h-11 accent-[#bec6e0] cursor-pointer"
                    />
                    <div className="flex justify-between text-2xs text-content-faint fs-numeric">
                      <span>T+0 · breach initiation</span>
                      <span>
                        T+{simResults.timeline[simResults.timeline.length - 1]?.time_minutes} min ·
                        end of window
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabPanel>

            {/* Benchmark -------------------------------------------------- */}
            <TabPanel id="benchmark" active={activeTab === "benchmark"}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="fs-label">
                    Flume dam break against the exact Ritter (1892) solution
                  </p>
                  {benchmarkData?.metrics && (
                    <div className="flex items-center gap-2">
                      <Badge tone="success">
                        r = {benchmarkData.metrics.pearson_correlation}
                      </Badge>
                      <Badge tone="neutral">
                        RMSE {benchmarkData.metrics.rmse_m} m
                      </Badge>
                    </div>
                  )}
                </div>

                {!benchmarkData?.chartData?.length ? (
                  <EmptyState
                    icon={<Activity className="w-7 h-7" />}
                    title="Benchmark not loaded"
                    description="Run a scenario, or open the Verification view, to compute the flume comparison."
                  />
                ) : (
                  <div className="h-56 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={benchmarkData.chartData} margin={{ top: 8, right: 12, bottom: 20, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 11, fill: "#9a9aa3" }}
                          tickLine={false}
                          label={{ value: "Time (s)", position: "insideBottom", offset: -12, fill: "#9a9aa3", fontSize: 11 }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#9a9aa3" }}
                          tickLine={false}
                          width={52}
                          label={{ value: "Depth (m)", angle: -90, position: "insideLeft", fill: "#9a9aa3", fontSize: 11 }}
                        />
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                        <Line
                          type="monotone"
                          dataKey="analytical"
                          stroke="#4ade80"
                          strokeDasharray="5 3"
                          strokeWidth={2}
                          name="Ritter (1892) exact"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="anuga"
                          stroke="#adc6ff"
                          strokeWidth={2}
                          name="ANUGA 4.x SWE"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <Callout tone="info" title="What this comparison is, and is not">
                  The reference is a closed-form solution, not a second numerical
                  model. Delft3D-FLOW and PySPH appear in the problem statement but
                  are <strong>not executed here</strong> — the Delft3D image carries
                  source only and PySPH is not installed. No substitute curves are
                  plotted. See <strong>Deliverables</strong> for the full status.
                </Callout>
              </div>
            </TabPanel>

            {/* Satellite -------------------------------------------------- */}
            <TabPanel id="satellite" active={activeTab === "satellite"}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="fs-label">
                    Sentinel-1 SAR · Refined Lee filter · Otsu delineation
                  </p>
                  {satelliteData?.ground_truth_metrics ? (
                    <div className="flex items-center gap-2">
                      <Badge tone="success">
                        IoU {satelliteData.ground_truth_metrics.overlap_percentage}%
                      </Badge>
                      <Badge tone="info">
                        F1 {satelliteData.ground_truth_metrics.dice_f1}
                      </Badge>
                    </div>
                  ) : (
                    <Badge tone="warning">Not verified</Badge>
                  )}
                </div>

                {satelliteData?.status === "success" ? (
                  <div className="space-y-3">
                    <div className="fs-panel-solid p-4 space-y-3">
                      <p className="fs-label">Scene processed</p>
                      <p className="text-xs font-mono text-content break-all">
                        {satelliteData.scene?.id}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <MiniFact label="Acquired" value={satelliteData.scene?.datetime} />
                        <MiniFact label="Orbit" value={satelliteData.scene?.orbit_direction} />
                        <MiniFact label="Collection" value={satelliteData.scene?.collection} />
                      </div>
                    </div>

                    <div className="fs-panel-solid p-4 space-y-3">
                      <p className="fs-label">Detection and scoring</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Reported as relative: the STAC assets carry no
                            calibration vector, so this is not an absolute
                            backscatter level. */}
                        <MiniFact label="Otsu threshold" value={satelliteData.processing?.threshold} />
                        <MiniFact
                          label="Observed water"
                          value={
                            satelliteData.observed_area_km2 != null
                              ? `${satelliteData.observed_area_km2} km²`
                              : "—"
                          }
                        />
                        <MiniFact
                          label="Permanent water removed"
                          value={
                            satelliteData.reference_scene
                              ? `${satelliteData.processing?.permanent_water_pixels_removed ?? 0} px`
                              : "no reference scene"
                          }
                        />
                        <MiniFact
                          label="Verdict"
                          value={satelliteData.ground_truth_metrics?.status}
                        />
                      </div>

                      {satelliteData.water_polygon_geojson && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const blob = new Blob(
                              [JSON.stringify(satelliteData.water_polygon_geojson)],
                              { type: "application/geo+json" },
                            );
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${selectedDam}_observed_water.geojson`;
                            a.click();
                            window.URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden />
                          Observed water (.geojson)
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <Callout tone="warning" title="Verification unavailable — no score reported">
                    {satelliteData?.message ??
                      "Run a simulation to produce an extent, then request verification."}
                    <br />
                    <br />
                    IoU and Dice are only meaningful against a real Sentinel-1
                    acquisition over the simulated footprint. Where none is
                    available the pipeline says so rather than scoring against
                    placeholder data.
                  </Callout>
                )}
              </div>
            </TabPanel>

            {/* Downstream impact ------------------------------------------ */}
            <TabPanel id="hadr" active={activeTab === "hadr"}>
              {!simResults?.hadr_settlements?.length ? (
                <EmptyState
                  icon={<Layers className="w-7 h-7" />}
                  title="No downstream impact table"
                  description="Run a scenario to score settlements along the reach."
                />
              ) : (
                <div className="overflow-x-auto fs-scroll">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <caption className="sr-only">
                      Downstream settlements, wave arrival, peak depth and hazard
                      classification.
                    </caption>
                    <thead>
                      <tr className="border-b border-edge">
                        <th scope="col" className="fs-label pb-2 pr-3">Settlement</th>
                        <th scope="col" className="fs-label pb-2 pr-3">Chainage</th>
                        <th scope="col" className="fs-label pb-2 pr-3">Wave arrival</th>
                        <th scope="col" className="fs-label pb-2 pr-3">Peak depth</th>
                        <th scope="col" className="fs-label pb-2 pr-3">Hazard</th>
                        <th scope="col" className="fs-label pb-2">Evacuation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResults.hadr_settlements.map((v) => (
                        <tr
                          key={v.village_name}
                          className="border-b border-edge/60 hover:bg-white/[0.03]"
                        >
                          <th
                            scope="row"
                            className="py-2.5 pr-3 font-semibold text-content"
                          >
                            {v.village_name}
                          </th>
                          <td className="py-2.5 pr-3 fs-numeric text-content-subtle">
                            {v.distance_km} km
                          </td>
                          <td className="py-2.5 pr-3 fs-numeric">
                            {v.wave_arrival_min == null ? (
                              <span className="text-content-faint">not reached</span>
                            ) : (
                              <span className="text-warning">{v.wave_arrival_min} min</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 fs-numeric text-content">
                            {v.estimated_depth_m} m
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge tone={hazardTone(v.hazard_level)}>
                              {v.hazard_level}
                            </Badge>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={
                                v.evacuation_status === "NO_INUNDATION"
                                  ? "text-content-subtle text-2xs font-bold"
                                  : "text-danger text-2xs font-bold inline-flex items-center gap-1"
                              }
                            >
                              {v.evacuation_status !== "NO_INUNDATION" && (
                                <AlertTriangle className="w-3 h-3" aria-hidden />
                              )}
                              {v.evacuation_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabPanel>
          </Panel>

          {/* Provenance --------------------------------------------------- */}
          {simResults?.terrain && (
            <p className="text-2xs text-content-faint leading-relaxed pb-2">
              Terrain: {simResults.terrain.dataset}, tile {simResults.terrain.tile} at{" "}
              {simResults.terrain.cell_size_m} m. Grid{" "}
              {simResults.hydrodynamics.grid_shape?.join(" × ")}. Solve took{" "}
              {simResults.hydrodynamics.wall_time_s} s.
            </p>
          )}

          {isSimulating && !simResults && (
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function MiniFact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded bg-surface-sunken border border-edge px-2.5 py-2 min-w-0">
      <p className="fs-label truncate">{label}</p>
      <p className="text-xs text-content font-medium mt-0.5 break-words">
        {value ?? "—"}
      </p>
    </div>
  );
}
