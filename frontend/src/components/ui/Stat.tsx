"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";
import type { Tone } from "./Badge";

const VALUE_TONES: Record<Tone, string> = {
  neutral: "text-content",
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export interface StatProps {
  label: string;
  /**
   * Numeric or pre-formatted value. `null` / `undefined` renders an explicit
   * not-computed state — never a placeholder number. A metric the backend did
   * not return must not be able to masquerade as a measured zero.
   */
  value: number | string | null | undefined;
  unit?: string;
  /** Decimal places applied when `value` is a number. */
  precision?: number;
  tone?: Tone;
  icon?: ReactNode;
  /** One line of provenance, e.g. which solver produced the number. */
  hint?: string;
  className?: string;
}

function renderValue(value: number | string, precision: number): string {
  if (typeof value !== "number") return value;
  if (!Number.isFinite(value)) return "—";

  // A small non-zero value rounds to "0.00" at the requested precision and
  // would then read as an exact zero. That matters where the true figure is
  // floating-point noise: mass-conservation drift on a finite-volume solve
  // lands near 1e-14, and printing "0.00" would claim a guarantee the solver
  // never made. Show the exponent instead, so the reader sees what it is.
  if (precision > 0 && value !== 0 && Math.abs(value) < Math.pow(10, -precision) / 2) {
    return value.toExponential(2);
  }

  return value.toFixed(precision);
}

export function Stat({
  label,
  value,
  unit,
  precision = 2,
  tone = "neutral",
  icon,
  hint,
  className,
}: StatProps) {
  const isMissing = value === null || value === undefined || value === "";
  const tone_ = isMissing ? "neutral" : tone;
  const shown = isMissing ? null : renderValue(value, precision);
  // A long reading — a five-figure correlation, or an exponent — will not fit
  // the tile at the default size and would otherwise wrap mid-number, reading
  // as two separate quantities. Step the size down instead.
  const isLong = shown !== null && shown.length >= 8;

  return (
    <div className={cn("fs-panel-solid px-4 py-3 min-w-0", className)}>
      <div className="fs-label flex items-center gap-1.5 truncate">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "fs-numeric mt-1 flex items-baseline gap-1 whitespace-nowrap",
          isLong ? "text-lg" : "text-xl",
          isMissing ? "text-content-faint" : VALUE_TONES[tone_],
        )}
      >
        {isMissing ? (
          <span className="text-content-faint">—</span>
        ) : (
          <>
            {shown}
            {unit && (
              <span className="text-xs font-medium text-content-subtle">{unit}</span>
            )}
          </>
        )}
      </div>
      {/* Two lines rather than truncation: a hint cut off mid-sentence loses
          the provenance it exists to carry. */}
      <div className="text-2xs text-content-faint mt-0.5 line-clamp-2">
        {isMissing ? "not computed" : hint ?? " "}
      </div>
    </div>
  );
}
