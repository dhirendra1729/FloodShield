"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

/* -------------------------------------------------------------------------- */
/* Shared field chrome                                                        */
/* -------------------------------------------------------------------------- */

interface FieldShellProps {
  label: string;
  hint?: string;
  /** Right-aligned readout, e.g. the live value of a slider. */
  readout?: ReactNode;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
  className?: string;
}

function FieldShell({ label, hint, readout, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label htmlFor={id} className="fs-label">
          {label}
        </label>
        {readout && <span className="fs-numeric text-xs text-brand">{readout}</span>}
      </div>
      {children({ id, describedBy: hintId })}
      {hint && (
        <p id={hintId} className="text-2xs text-content-faint mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Slider                                                                     */
/* -------------------------------------------------------------------------- */

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  onChange,
  className,
}: SliderProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      className={className}
      readout={
        <>
          {value}
          {unit && <span className="text-content-subtle ml-0.5">{unit}</span>}
        </>
      }
    >
      {({ id, describedBy }) => (
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-full h-11 cursor-pointer appearance-none bg-transparent",
            "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
            "[&::-webkit-slider-runnable-track]:bg-surface-highest",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5",
            "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:-mt-[7px]",
            "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full",
            "[&::-moz-range-track]:bg-surface-highest",
            "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5",
            "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand",
            "[&::-moz-range-thumb]:border-0",
          )}
        />
      )}
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Number input                                                               */
/* -------------------------------------------------------------------------- */

export interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
  className?: string;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  onChange,
  className,
}: NumberFieldProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <div className="relative">
          <input
            id={id}
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            aria-describedby={describedBy}
            onChange={(e) => onChange(Number(e.target.value))}
            className={cn(
              "w-full h-11 rounded bg-surface-sunken border border-edge",
              "px-3 text-sm fs-numeric text-content",
              "transition-colors duration-fast",
              "hover:border-edge-strong focus:border-brand",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none",
              "[&::-webkit-inner-spin-button]:appearance-none",
              unit && "pr-14",
            )}
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-content-subtle pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Select                                                                     */
/* -------------------------------------------------------------------------- */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  hint?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SelectField({
  label,
  value,
  options,
  hint,
  onChange,
  className,
}: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <select
          id={id}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full h-11 rounded bg-surface-sunken border border-edge px-3 text-sm",
            "text-content transition-colors duration-fast",
            "hover:border-edge-strong focus:border-brand",
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Toggle                                                                     */
/* -------------------------------------------------------------------------- */

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  className?: string;
}

/** Uses role="switch" so assistive tech announces on/off state, not a checkbox. */
export function Toggle({ label, checked, onChange, hint, className }: ToggleProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex items-center justify-between gap-3 min-h-11", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-content cursor-pointer">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-2xs text-content-faint">
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hintId}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full shrink-0 transition-colors duration-fast",
          checked ? "bg-brand" : "bg-surface-highest",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-fast",
            checked ? "translate-x-[22px] bg-surface-base" : "translate-x-0.5 bg-content-subtle",
          )}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}

/**
 * Single-choice control. Implements the radiogroup pattern with arrow-key
 * navigation so it behaves like a native radio set.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabled = options.map((o, i) => ({ o, i })).filter(({ o }) => !o.disabled);
    const pos = enabled.findIndex(({ i }) => i === index);
    if (pos === -1) return;

    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (pos + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (pos - 1 + enabled.length) % enabled.length;
    else return;

    e.preventDefault();
    onChange(enabled[next].o.value);
    const el = e.currentTarget.parentElement?.children[enabled[next].i];
    if (el instanceof HTMLElement) el.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex rounded bg-surface-sunken border border-edge p-0.5 gap-0.5",
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "px-3 h-9 rounded-sm text-xs font-medium whitespace-nowrap",
              "transition-colors duration-fast",
              active
                ? "bg-brand-wash text-brand"
                : "text-content-subtle hover:text-content hover:bg-white/5",
              o.disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
