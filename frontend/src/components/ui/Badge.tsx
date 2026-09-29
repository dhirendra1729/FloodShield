"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-white/5 text-content-muted border-edge",
  brand: "bg-brand-wash text-brand border-brand/30",
  success: "bg-success-wash text-success border-success/30",
  warning: "bg-warning-wash text-warning border-warning/30",
  danger: "bg-danger-wash text-danger border-danger/30",
  info: "bg-info-wash text-info border-info/30",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  /** Optional leading glyph, e.g. a lucide icon at 12px. */
  icon?: ReactNode;
}

/** Compact status pill. Text is always present — colour is never the only cue. */
export function Badge({ children, tone = "neutral", className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "font-mono text-2xs uppercase tracking-wider font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
