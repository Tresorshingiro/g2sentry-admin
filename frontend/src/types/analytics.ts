export interface AnalyticsSummary {
  totalAssignments: number;
  totalAssignmentsChangePct: number;
  avgResponseMinutes: number;
  avgResponseChangeLabel: string;
  completionRatePct: number;
  completionRateChangePct: number;
  incidents: number;
  incidentsChange: number;
}

export interface WeeklyAssignmentStat {
  week: string;
  current: number;
  previous: number;
}

export interface JobTypeStat {
  label: string;
  value: number;
  color: string;
}

export interface DistrictAssignmentStat {
  district: string;
  count: number;
}

export interface ResponseTimeStat {
  month: string;
  minutes: number;
}

export interface GuardianPerformanceRow {
  id: string;
  name: string;
  initials: string;
  avatarClass: string;
  jobs: number;
  response: string;
  responseClass: string;
  reliabilityPct: number;
  rating: string;
  incidents: number;
  incidentsClass: string;
  earnings: string;
}

export interface ExportReportItem {
  id: string;
  title: string;
  format: 'PDF' | 'CSV';
  period: string;
  iconBg: string;
  iconColor: string;
}

/**
 * Dispatch KPIs from `GET /admin/analytics/dashboard` (the `kpis` field).
 *
 * Rates and latency percentiles are NULLABLE: the backend returns null for any
 * metric it has nothing to compute over (no jobs, no offers, no arrivals in the
 * window). Counts are always present. Do not narrow these to `number` — render
 * them through `formatMinutes` / `formatRatePct` in `@/lib/utils`.
 */
export interface DispatchLatencyMinutes {
  p50TimeToFirstOffer: number | null; p95TimeToFirstOffer: number | null;
  p50TimeToAccept: number | null;     p95TimeToAccept: number | null;
  p50TimeToOnSite: number | null;     p95TimeToOnSite: number | null;
  p50TimeToComplete: number | null;   p95TimeToComplete: number | null;
}

export interface KpisData {
  jobsCreated: number;
  jobsWithAcceptedOffer: number;
  totalOffers: number;
  acceptedOffers: number;
  expiredOffers: number;
  noShowAssignments: number;
  noShowManual?: number;
  noShowSystem?: number;
  jobsFailed: number;
  dispatchFailuresByReason: { reason: string; count: number }[];
  dispatchConversionRate: number | null;
  offerAcceptanceRate: number | null;
  offerExpiryRate: number | null;
  noShowRate: number | null;
  dispatchFailureRate: number | null;
  latencyMinutes: DispatchLatencyMinutes | null;
}
