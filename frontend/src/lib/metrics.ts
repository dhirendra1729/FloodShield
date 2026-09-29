import type { Tone } from "@/components/ui";

/**
 * Reading of a mass-conservation figure, shared by every view that displays one.
 *
 * These two functions live here rather than beside either consumer because the
 * number appears in more than one place, and a threshold stated twice drifts.
 * The bands are deliberately wide: a finite-volume solve should hold volume to
 * round-off, so anything past a hundredth of a percent is already a finding
 * worth flagging, and anything past one percent is a defect, not a nuance.
 */
export function driftTone(pct: number | null | undefined): Tone {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "neutral";
  const magnitude = Math.abs(pct);
  if (magnitude < 0.01) return "success";
  if (magnitude < 1) return "warning";
  return "danger";
}

/**
 * One line saying what the drift figure means. Kept next to [driftTone] so the
 * words and the colour cannot disagree about which band a value falls in.
 */
export function driftHint(pct: number | null | undefined): string | undefined {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return undefined;
  if (Math.abs(pct) < 0.01) return "Finite-volume conserved";
  if (Math.abs(pct) < 1) return "Volume changed over the run";
  return "Volume not conserved — check the run";
}
