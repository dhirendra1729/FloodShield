"use client";

import type { ReactNode } from "react";
import { Info, TriangleAlert, CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "./cn";

type CalloutTone = "info" | "warning" | "danger" | "success";

const STYLES: Record<
  CalloutTone,
  { wrap: string; icon: ReactNode }
> = {
  info: {
    wrap: "bg-info-wash border-info/30 text-info",
    icon: <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  },
  warning: {
    wrap: "bg-warning-wash border-warning/30 text-warning",
    icon: <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  },
  danger: {
    wrap: "bg-danger-wash border-danger/30 text-danger",
    icon: <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  },
  success: {
    wrap: "bg-success-wash border-success/30 text-success",
    icon: <CircleCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />,
  },
};

export interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Scoping and provenance note. Used wherever the honest answer is "this
 * number did not come from that model" — a claim the UI must make loudly
 * rather than bury in a footnote.
 */
export function Callout({ tone = "info", title, children, className }: CalloutProps) {
  const s = STYLES[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "note" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded border px-3.5 py-3 text-xs leading-relaxed",
        s.wrap,
        className,
      )}
    >
      {s.icon}
      <div className="min-w-0 [&_strong]:text-content [&_strong]:font-semibold">
        {title && <div className="font-semibold mb-0.5 text-content">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}
