// Shared chart styling for Dashboard + Analytics.
// Goal: a deliberate, brand-aligned look — NOT the default chart-library rainbow.
//
// Two colour roles, kept strictly separate:
//   • STATUS  — semantic. Only for state: healthy / pending / failed / overdue.
//   • CATEGORICAL — brand-derived family. For nominal data (job types) where the
//     colour means "a category", never a status.

const SANS = "'IBM Plex Sans', system-ui, sans-serif";

// ── Status semantics (reserved — never use these for categorical data) ─────────
export const STATUS = {
  healthy: '#14B87A', // brand green — paid, completed, on-track
  info:    '#3B82F6', // blue — issued, in progress
  warning: '#F59E0B', // amber — disputed, expiring, ageing
  danger:  '#EF4444', // red — overdue, failed
  neutral: '#94A3B8', // slate — draft, idle, empty
} as const;

// ── Categorical palette — a single brand-green family, deep → light ────────────
// Ordered, so a ranked list reads as one coherent scale rather than a rainbow.
export const CATEGORICAL = [
  '#0E7C5A',
  '#14B87A',
  '#3FBF8E',
  '#6FD0AB',
  '#9BE0C7',
  '#C2EDDC',
  '#475569',
  '#94A3B8',
] as const;

// Sequential ramp for the activity heatmap (light → brand → deep).
export const HEAT_RAMP = ['#ECFDF5', '#A7F3D0', '#34D399', '#14B87A', '#047857'] as const;

// Ageing ramp — green (fresh) → red (stale). Semantic: older = worse.
export const AGING_COLORS = ['#14B87A', '#F59E0B', '#FB923C', '#EF4444'] as const;

// ── One deliberate corner-radius logic: 3px on the value-end of every bar ──────
export const BAR_RADIUS_V: [number, number, number, number] = [3, 3, 0, 0]; // vertical bars
export const BAR_RADIUS_H: [number, number, number, number] = [0, 3, 3, 0]; // horizontal bars

// ── Subtle tooltip: rounded, soft shadow, thin dashed vertical guide line ──────
export const chartTooltip = {
  backgroundColor: '#0F172A',
  borderColor: '#1E293B',
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: SANS },
  extraCssText: 'border-radius:8px;box-shadow:0 6px 20px rgba(15,23,42,0.16);',
  axisPointer: {
    type: 'line' as const,
    lineStyle: { color: '#CBD5E1', width: 1, type: 'dashed' as const },
  },
};

// ── Value axis: invisible, but draws faint dashed reference lines for scale ─────
export function valueAxisGrid() {
  return {
    type: 'value' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: { show: true, lineStyle: { color: '#EEF2F6', type: 'dashed' as const } },
  };
}

// Category axis with no reference lines (used as the cross-axis on bar charts).
export function categoryAxis(data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: 'category' as const,
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#94A3B8', fontSize: 9, fontFamily: SANS },
    ...extra,
  };
}
