import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRWF(amount: number): string {
  if (amount >= 1_000_000) return `RWF ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `RWF ${Math.round(amount / 1_000)}k`;
  return `RWF ${amount.toLocaleString()}`;
}

export function formatDelta(delta: number, isPercent = false): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}${isPercent ? '%' : ''}`;
}

/** Placeholder for a metric the backend could not compute. */
export const NO_VALUE = '—';

/**
 * Format a latency in minutes. Analytics percentiles come back `null` when
 * there is nothing to measure over (e.g. no offers in the window), so this
 * renders a placeholder rather than throwing on `null.toFixed()`.
 */
export function formatMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return NO_VALUE;
  return `${value.toFixed(1)} min`;
}

/**
 * Format a 0–1 rate as a percentage. `null` renders as a placeholder instead
 * of coercing to "0.0%", which would read as a genuine measurement of zero.
 */
export function formatRatePct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return NO_VALUE;
  return `${(rate * 100).toFixed(1)}%`;
}
