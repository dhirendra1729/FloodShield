"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FlaskConical, RefreshCw } from "lucide-react";

import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Panel,
  Skeleton,
  Stat,
  type Tone,
} from "@/components/ui";
import { driftHint, driftTone } from "@/lib/metrics";

/**
 * Shape of GET /api/dam/benchmark. Mirrors the handler in backend/src/main.py;
 * every field is produced by the flume run, none is defaulted here.
 */
interface BenchmarkResponse {
  status: "success" | "error";
  message?: string;
  benchmark_suite?: string;
  reference?: string;
  reference_citation?: string;
  setup?: Record<string, number>;
  time_s?: number[];
  anuga_floodshield_curve?: number[];
  analytical_curve?: number[];
  analytical_dam_section?: { depth_m: number; velocity_mps: number };
  metrics?: Record<string, number | string>;
  cross_solver_comparison?: Record<string, { executed: boolean; reason: string }>;
}

function verdictTone(verdict: string | undefined): Tone {
  if (!verdict) return "neutral";
  return verdict.startsWith("VERIFIED") ? "success" : "danger";
}

export default function VerificationView() {
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dam/benchmark?dx=0.2", { cache: "no-store" });
      const json: BenchmarkResponse = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message ?? "benchmark run failed");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "benchmark run failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Intentionally run once. The flume solve is deterministic and cached
    // server-side, so re-fetching on every render would only add latency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl">
        <Panel title="Verification unavailable">
          <EmptyState
            icon={<FlaskConical className="w-8 h-8" />}
            title="The flume benchmark did not run"
            description={
              error ??
              "The backend returned no result. Check that the solver service is running, then retry."
            }
            action={
              <Button variant="secondary" onClick={load}>
                <RefreshCw className="w-4 h-4" aria-hidden />
                Retry
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  const m = data.metrics ?? {};
  const verdict = m.validation_verdict as string | undefined;
  const num = (k: string): number | null =>
    typeof m[k] === "number" ? (m[k] as number) : null;

  // Zip the two series against their shared time axis. Lengths are guaranteed
  // equal by the handler, which builds all three from the same loop.
  const chartData =
    data.time_s && data.anuga_floodshield_curve && data.analytical_curve
      ? data.time_s.map((t, i) => ({
          t,
          anuga: data.anuga_floodshield_curve![i],
          ritter: data.analytical_curve![i],
        }))
      : [];

  const dam = data.analytical_dam_section;

  return (
    <div className="h-full overflow-y-auto fs-scroll">
      <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
        {/* -------------------------------------------------------------- */}
        {/* Verdict                                                         */}
        {/* -------------------------------------------------------------- */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-content tracking-tight">
              Solver verification
            </h2>
            <p className="text-sm text-content-subtle mt-1 max-w-[70ch]">
              {data.benchmark_suite} against {data.reference}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {verdict && <Badge tone={verdictTone(verdict)}>{verdict}</Badge>}
            <Button size="sm" variant="ghost" onClick={load} aria-label="Re-run benchmark">
              <RefreshCw className="w-4 h-4" aria-hidden />
            </Button>
          </div>
        </header>

        {/* -------------------------------------------------------------- */}
        {/* Metrics — every value comes from the run, none is defaulted.    */}
        {/* -------------------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Stat
            label="Normalised RMSE"
            value={num("normalised_rmse")}
            precision={4}
            tone="brand"
            hint="RMSE ÷ initial depth"
          />
          <Stat
            label="Pearson r"
            value={num("pearson_correlation")}
            precision={5}
            tone="brand"
            hint="Solver vs exact, at the gauge"
          />
          <Stat
            label="Mass drift"
            value={num("mass_drift_pct")}
            precision={4}
            unit="%"
            tone={driftTone(num("mass_drift_pct"))}
            hint={driftHint(num("mass_drift_pct"))}
          />
          <Stat
            label="Dam-section error"
            value={num("dam_section_depth_error_m")}
            precision={4}
            unit="m"
            tone="warning"
            hint="Solver depth minus exact"
          />
          <Stat
            label="Front arrival error"
            value={num("front_arrival_error_s")}
            precision={3}
            unit="s"
            tone="warning"
            hint="Same depth threshold, both series"
          />
          <Stat
            label="Solve throughput"
            value={
              data.setup?.duration_s && num("wall_time_s")
                ? data.setup.duration_s / (num("wall_time_s") as number)
                : null
            }
            precision={1}
            unit="× real time"
            tone="brand"
            hint={
              data.setup?.duration_s && num("wall_time_s")
                ? `${data.setup.duration_s} s of flood in ${num("wall_time_s")} s wall clock`
                : "Needs both the span and the wall clock"
            }
          />
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Chart                                                           */}
        {/* -------------------------------------------------------------- */}
        <Panel
          title="Depth at the gauge"
          subtitle={
            data.setup
              ? `Gauge at ${data.setup.gauge_position_m} m, ${data.setup.cells?.toLocaleString()} cells, ${data.setup.cell_size_m} m resolution, frictionless bed`
              : undefined
          }
        >
          {chartData.length === 0 ? (
            <EmptyState
              title="No series returned"
              description="The handler returned neither curve, so there is nothing to plot."
            />
          ) : (
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 24, left: 4 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v: number) => v.toFixed(1)}
                    stroke="#9a9aa3"
                    fontSize={11}
                    label={{
                      value: "Time (s)",
                      position: "insideBottom",
                      offset: -14,
                      fill: "#9a9aa3",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    stroke="#9a9aa3"
                    fontSize={11}
                    width={52}
                    label={{
                      value: "Depth (m)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#9a9aa3",
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1f1f21",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#c6c6cd" }}
                    labelFormatter={(label) => `t = ${Number(label).toFixed(3)} s`}
                    formatter={(value, name) => [
                      `${Number(value).toFixed(4)} m`,
                      String(name),
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={28}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) =>
                      value === "anuga" ? "ANUGA 4.x SWE" : "Ritter (1892) exact"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="ritter"
                    stroke="#4ade80"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="anuga"
                    stroke="#adc6ff"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        {/* -------------------------------------------------------------- */}
        {/* Setup and reference                                             */}
        {/* -------------------------------------------------------------- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Test setup">
            {data.setup && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {Object.entries(data.setup).map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <dt className="fs-label truncate">
                      {key.replace(/_/g, " ").replace(/ (m|s)$/, " ($1)")}
                    </dt>
                    <dd className="fs-numeric text-sm text-content mt-0.5 truncate">
                      {typeof value === "number" ? value.toLocaleString() : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <Panel title="Exact solution at the dam section">
            <div className="space-y-4">
              {dam && (
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="Depth"
                    value={dam.depth_m}
                    precision={4}
                    unit="m"
                    tone="success"
                    hint="h = 4h₀/9"
                  />
                  <Stat
                    label="Velocity"
                    value={dam.velocity_mps}
                    precision={4}
                    unit="m/s"
                    tone="success"
                    hint="u = ⅔√(gh₀)"
                  />
                </div>
              )}
              {data.reference_citation && (
                <p className="text-xs text-content-subtle leading-relaxed border-l-2 border-edge pl-3">
                  {data.reference_citation}
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Cross-solver status — reported, never faked                     */}
        {/* -------------------------------------------------------------- */}
        {data.cross_solver_comparison && (
          <Panel
            title="Cross-solver comparison"
            subtitle="Reported for completeness. Neither alternative solver was executed."
          >
            <div className="space-y-3">
              {Object.entries(data.cross_solver_comparison).map(([name, info]) => (
                <div
                  key={name}
                  className="fs-panel-solid px-4 py-3 flex flex-wrap items-start gap-3"
                >
                  <Badge tone={info.executed ? "success" : "warning"}>
                    {info.executed ? "Executed" : "Not executed"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-content">
                      {name.replace(/_/g, " ").toUpperCase()}
                    </p>
                    <p className="text-xs text-content-subtle mt-0.5">{info.reason}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout tone="info" className="mt-4">
              An exact analytical solution is a <strong>stronger</strong> reference
              than a second numerical code: two shallow-water solvers agree with each
              other by construction, whereas agreement with a closed-form solution
              tests the discretisation itself.
            </Callout>
          </Panel>
        )}
      </div>
    </div>
  );
}
