"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Shown whenever a panel has no data yet. Every one of these states names the
 * specific action that fills it — "run a simulation", not "no data".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-2 py-10 px-6",
        className,
      )}
    >
      {icon && <div className="text-content-faint mb-1">{icon}</div>}
      <p className="text-sm font-medium text-content-muted">{title}</p>
      {description && (
        <p className="text-xs text-content-subtle max-w-[42ch] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Placeholder block for async content. width/height avoid layout shift. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded bg-gradient-to-r from-surface-high via-surface-highest to-surface-high",
        "bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    />
  );
}
