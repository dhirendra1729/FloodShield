"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  /** Appended to the label, e.g. a count. */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * WAI-ARIA tablist: roving tabindex plus arrow/Home/End navigation, so the
 * whole strip is one tab stop and the arrow keys move between tabs.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  const enabled = items.filter((t) => !t.disabled);

  const move = (current: T, delta: number) => {
    const pos = enabled.findIndex((t) => t.id === current);
    if (pos === -1) return;
    onChange(enabled[(pos + delta + enabled.length) % enabled.length].id);
  };

  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-1 overflow-x-auto fs-scroll", className)}
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            disabled={t.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(t.id, 1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); move(t.id, -1); }
              else if (e.key === "Home") { e.preventDefault(); onChange(enabled[0].id); }
              else if (e.key === "End") {
                e.preventDefault();
                onChange(enabled[enabled.length - 1].id);
              }
            }}
            className={cn(
              "relative flex items-center gap-2 px-3.5 h-11 text-sm font-medium",
              "whitespace-nowrap rounded-t-sm transition-colors duration-fast shrink-0",
              active
                ? "text-brand after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-brand after:rounded-full"
                : "text-content-subtle hover:text-content hover:bg-white/5",
              t.disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            {t.icon}
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Wraps tab content with the relationship attributes screen readers expect.
 *
 * `active` is required and the panel renders nothing when false. Putting the
 * gate here rather than at each call site means a panel cannot be left
 * un-gated and silently stacked with the others — which is exactly what
 * happened to every panel in this app before the prop existed.
 */
export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={cn("min-h-0 focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
