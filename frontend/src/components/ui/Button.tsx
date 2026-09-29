"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * sm is 36px and is reserved for dense toolbars and data-table rows. Every
 * other size meets the 44px minimum touch target.
 */
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-md gap-2",
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-surface-base font-semibold hover:bg-brand-strong active:bg-brand-strong shadow-sm",
  secondary:
    "bg-surface-high text-content border border-edge hover:bg-surface-highest hover:border-edge-strong",
  ghost:
    "bg-transparent text-content-muted hover:bg-white/5 hover:text-content",
  danger:
    "bg-danger-wash text-danger border border-danger/40 hover:bg-danger/25",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Replaces the label with a spinner while keeping the button's width stable. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      loading = false,
      loadingLabel,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center rounded font-medium",
          "transition-colors duration-fast",
          "disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none",
          SIZES[size],
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
            {loadingLabel ?? children}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
