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
