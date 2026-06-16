import { describe, expect, it } from 'vitest';
import { cn, formatDelta, formatRWF } from '@/lib/utils';

// ─── formatRWF ────────────────────────────────────────────────────────────────

describe('formatRWF', () => {
  it('formats zero', () => {
    expect(formatRWF(0)).toBe('RWF 0');
  });

  it('formats amounts under 1,000 as plain RWF', () => {
    expect(formatRWF(1)).toBe('RWF 1');
    expect(formatRWF(500)).toBe('RWF 500');
    expect(formatRWF(999)).toBe('RWF 999');
  });

  it('formats amounts >= 1,000 in rounded thousands', () => {
    expect(formatRWF(1_000)).toBe('RWF 1k');
    expect(formatRWF(1_400)).toBe('RWF 1k');   // rounds down
    expect(formatRWF(1_500)).toBe('RWF 2k');   // rounds up
    expect(formatRWF(45_000)).toBe('RWF 45k');
    expect(formatRWF(999_999)).toBe('RWF 1000k');
  });

  it('formats amounts >= 1,000,000 in millions with one decimal', () => {
    expect(formatRWF(1_000_000)).toBe('RWF 1.0M');
    expect(formatRWF(1_500_000)).toBe('RWF 1.5M');
    expect(formatRWF(2_750_000)).toBe('RWF 2.8M');
    expect(formatRWF(10_000_000)).toBe('RWF 10.0M');
  });
});

// ─── formatDelta ──────────────────────────────────────────────────────────────

describe('formatDelta', () => {
  it('prefixes positive numbers with +', () => {
    expect(formatDelta(5)).toBe('+5');
    expect(formatDelta(100)).toBe('+100');
  });

  it('does not double-prefix negatives', () => {
    expect(formatDelta(-3)).toBe('-3');
  });

  it('formats zero without a sign', () => {
    expect(formatDelta(0)).toBe('0');
  });

  it('appends % when isPercent is true', () => {
    expect(formatDelta(10, true)).toBe('+10%');
    expect(formatDelta(-5, true)).toBe('-5%');
    expect(formatDelta(0, true)).toBe('0%');
  });
});

// ─── cn ───────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('deduplicates conflicting tailwind utilities (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('ignores falsy values', () => {
    expect(cn('base', false && 'hidden', undefined, null, 'active')).toBe('base active');
  });

  it('handles conditional objects', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold');
  });
});
