"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

export interface PanelProps {
  /** Rendered as a heading so screen readers can navigate between panels. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned controls in the header row. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Removes the body padding — for maps and tables that bleed to the edge. */
  flush?: boolean;
}

/**
 * The shell's primary surface. Glass by default; use `flush` for edge-to-edge
 * content. The title is a real <h2> so panel structure survives without CSS.
 */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
}: PanelProps) {
  return (
    <section className={cn("fs-panel flex flex-col min-h-0", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-edge shrink-0">
          <div className="min-w-0">
            {title && (
              <h2 className="text-md font-semibold text-content truncate">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-content-subtle mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div
        className={cn(
          "min-h-0 flex-1",
          !flush && "px-5 py-4",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Interactive cards get hover affordance and a button-like cursor. */
  interactive?: boolean;
  onClick?: () => void;
}

/** A solid tile nested inside a Panel. */
export function Card({ children, className, interactive = false, onClick }: CardProps) {
  const Tag = interactive || onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      type={interactive || onClick ? "button" : undefined}
      className={cn(
        "fs-panel-solid p-4 text-left w-full",
        (interactive || onClick) &&
          "transition-colors duration-fast hover:bg-surface-high hover:border-edge-strong",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
