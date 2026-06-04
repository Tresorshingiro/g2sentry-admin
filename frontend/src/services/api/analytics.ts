import type {
  AnalyticsSummary,
  DistrictAssignmentStat,
  ExportReportItem,
  GuardianPerformanceRow,
  JobTypeStat,
  ResponseTimeStat,
  WeeklyAssignmentStat,
} from '@/types/analytics';
import { apiGet } from '@/lib/api-client';
import { fetchGuardianRoster } from './guardians';

export interface RawJobFactsDaily {
  date: string;
  district: string;
  jobType: string;
  jobCount: number;
  completedCount: number;
  cancelledCount: number;
  avgResponseMinutes: string | number | null;
  totalRevenue: string | number;
}

interface RawGuardianPerfDaily {
  date: string;
  guardianId: string;
  jobsAssigned: number;
  jobsCompleted: number;
  noShowCount: number;
  completionRate: string | number;
  avgResponseMinutes: string | number | null;
  avgRating: string | number | null;
}

const JOB_TYPE_COLORS: Record<string, string> = {
  PATROL: '#14B87A',
  ESCORT: '#5DCAA5',
  EVENT_SECURITY: '#3B82F6',
  DOOR_SUPERVISION: '#8B5CF6',
  VIP_PROTECTION: '#F59E0B',
  EMERGENCY_RESPONSE: '#EF4444',
  COMPOUND_SECURITY: '#64748B',
  STATIC_POST: '#9CA3AF',
};

const JOB_TYPE_LABELS: Record<string, string> = {
  PATROL: 'Patrol',
  ESCORT: 'Escort',
  EVENT_SECURITY: 'Event Security',
  DOOR_SUPERVISION: 'Door Supervision',
  VIP_PROTECTION: 'VIP Protection',
  EMERGENCY_RESPONSE: 'Emergency Response',
  COMPOUND_SECURITY: 'Compound Security',
  STATIC_POST: 'Static Post',
};

const PERF_AVATAR_COLORS = [
  'bg-slate-700 text-white', 'bg-green-700 text-white', 'bg-blue-700 text-white',
  'bg-violet-700 text-white', 'bg-amber-600 text-white', 'bg-rose-700 text-white',
  'bg-cyan-700 text-white', 'bg-teal-700 text-white',
];

export async function fetchAnalyticsSummary(
  periodStart?: Date,
  periodEnd?: Date,
): Promise<AnalyticsSummary> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);

  const now = new Date();
  const rangeStart = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd   = periodEnd   ?? now;
  const durationMs = rangeEnd.getTime() - rangeStart.getTime();
  const cmpEnd     = new Date(rangeStart.getTime() - 86_400_000);
  const cmpStart   = new Date(rangeStart.getTime() - durationMs - 86_400_000);

  const thisMonth = raw.filter(r => { const d = new Date(r.date); return d >= rangeStart && d <= rangeEnd; });
  const lastMonth = raw.filter(r => { const d = new Date(r.date); return d >= cmpStart && d <= cmpEnd; });

  const totalThis = thisMonth.reduce((s, r) => s + r.jobCount, 0);
  const totalLast = lastMonth.reduce((s, r) => s + r.jobCount, 0);
  const totalChangePct = totalLast > 0 ? Math.round(((totalThis - totalLast) / totalLast) * 100) : 0;

  const completedThis = thisMonth.reduce((s, r) => s + r.completedCount, 0);
  const completedLast = lastMonth.reduce((s, r) => s + r.completedCount, 0);
  const completionThis = totalThis > 0 ? Math.round((completedThis / totalThis) * 100) : 0;
  const completionLast = totalLast > 0 ? Math.round((completedLast / totalLast) * 100) : 0;

  const respThis = thisMonth.filter(r => r.avgResponseMinutes != null);
  const avgRespThis = respThis.length > 0
    ? Math.round(respThis.reduce((s, r) => s + Number(r.avgResponseMinutes), 0) / respThis.length)
    : 0;
  const respLast = lastMonth.filter(r => r.avgResponseMinutes != null);
  const avgRespLast = respLast.length > 0
    ? Math.round(respLast.reduce((s, r) => s + Number(r.avgResponseMinutes), 0) / respLast.length)
    : 0;
  const respDiff = avgRespThis - avgRespLast;

  return {
    totalAssignments: totalThis,
    totalAssignmentsChangePct: totalChangePct,
    avgResponseMinutes: avgRespThis,
    avgResponseChangeLabel: respDiff === 0
      ? 'No change vs last month'
      : `${respDiff > 0 ? '+' : ''}${respDiff} min vs last month`,
    completionRatePct: completionThis,
    completionRateChangePct: completionThis - completionLast,
    incidents: 0,
    incidentsChange: 0,
  };
}

export async function fetchWeeklyAssignments(
  periodStart?: Date,
  periodEnd?: Date,
): Promise<WeeklyAssignmentStat[]> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);
  if (!raw.length) return [];

  const now = new Date();
  const rangeStart = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd   = periodEnd   ?? now;
  const durationMs = rangeEnd.getTime() - rangeStart.getTime();
  const cmpEnd     = new Date(rangeStart.getTime() - 86_400_000);
  const cmpStart   = new Date(rangeStart.getTime() - durationMs - 86_400_000);

  const weekOfMonth = (d: Date) => Math.ceil(d.getDate() / 7);
  const byWeekThis = new Map<number, number>();
  const byWeekLast = new Map<number, number>();

  for (const r of raw) {
    const d = new Date(r.date);
    if (d >= rangeStart && d <= rangeEnd) {
      const w = weekOfMonth(d);
      byWeekThis.set(w, (byWeekThis.get(w) ?? 0) + r.jobCount);
    } else if (d >= cmpStart && d <= cmpEnd) {
      const w = weekOfMonth(d);
      byWeekLast.set(w, (byWeekLast.get(w) ?? 0) + r.jobCount);
    }
  }

  const allWeeks = new Set([...byWeekThis.keys(), ...byWeekLast.keys()]);
  return Array.from(allWeeks)
    .sort((a, b) => a - b)
    .map(w => ({
      week: `Wk ${w}`,
      current: byWeekThis.get(w) ?? 0,
      previous: byWeekLast.get(w) ?? 0,
    }));
}

export async function fetchGuardianPerformance(): Promise<GuardianPerformanceRow[]> {
  const [rawPerf, rosterRes] = await Promise.all([
    apiGet<RawGuardianPerfDaily[]>('/admin/analytics/guardians').catch(() => [] as RawGuardianPerfDaily[]),
    fetchGuardianRoster(1, 100).catch(() => ({ items: [] as import('@/types/guardian-roster').GuardianListItem[] })),
  ]);

  const nameMap = new Map<string, string>();
  for (const g of rosterRes.items) {
    nameMap.set(g.id, g.user.fullName ?? g.guardianCode);
  }

  type Agg = {
    totalCompleted: number; totalAssigned: number; noShows: number;
    respSum: number; respJobs: number; ratingSum: number; ratingCount: number;
  };
  const byGuardian = new Map<string, Agg>();

  for (const r of rawPerf) {
    const agg = byGuardian.get(r.guardianId) ?? {
      totalCompleted: 0, totalAssigned: 0, noShows: 0,
      respSum: 0, respJobs: 0, ratingSum: 0, ratingCount: 0,
    };
    agg.totalCompleted += r.jobsCompleted;
    agg.totalAssigned  += r.jobsAssigned;
    agg.noShows        += r.noShowCount;
    if (r.avgResponseMinutes != null && r.jobsAssigned > 0) {
      agg.respSum  += Number(r.avgResponseMinutes) * r.jobsAssigned;
      agg.respJobs += r.jobsAssigned;
    }
    if (r.avgRating != null && Number(r.avgRating) > 0) {
      agg.ratingSum   += Number(r.avgRating);
      agg.ratingCount += 1;
    }
    byGuardian.set(r.guardianId, agg);
  }

  const rows: GuardianPerformanceRow[] = [];
  let colorIdx = 0;
  for (const [guardianId, agg] of Array.from(byGuardian.entries()).sort((a, b) => b[1].totalCompleted - a[1].totalCompleted)) {
    const name       = nameMap.get(guardianId) ?? `Guardian …${guardianId.slice(-4)}`;
    const initials   = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const avgResp    = agg.respJobs > 0 ? Math.round(agg.respSum / agg.respJobs) : 0;
    const avgRating  = agg.ratingCount > 0 ? agg.ratingSum / agg.ratingCount : 0;
    const reliabilityPct = agg.totalAssigned > 0 ? Math.round((agg.totalCompleted / agg.totalAssigned) * 100) : 0;

    rows.push({
      id: guardianId,
      name,
      initials,
      avatarClass: PERF_AVATAR_COLORS[colorIdx++ % PERF_AVATAR_COLORS.length],
      jobs: agg.totalCompleted,
      response: avgResp > 0 ? `${avgResp} min` : '—',
      responseClass: avgResp > 15 ? 'text-red-600' : avgResp > 10 ? 'text-amber-600' : 'text-green-600',
      reliabilityPct,
      rating: avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : '—',
      incidents: agg.noShows,
      incidentsClass: agg.noShows > 0 ? 'text-red-500 font-medium' : 'text-slate-400',
      earnings: '—',
    });
    if (rows.length >= 10) break;
  }
  return rows;
}

export async function fetchJobTypes(
  periodStart?: Date,
  periodEnd?: Date,
): Promise<JobTypeStat[]> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);
  const now = new Date();
  const rangeStart = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd   = periodEnd   ?? now;
  const filtered   = raw.filter(r => { const d = new Date(r.date); return d >= rangeStart && d <= rangeEnd; });
  const byType = new Map<string, number>();
  for (const r of filtered) {
    byType.set(r.jobType, (byType.get(r.jobType) ?? 0) + r.jobCount);
  }
  const total = Array.from(byType.values()).reduce((s, v) => s + v, 0);
  if (!total) return [];
  return Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      label: JOB_TYPE_LABELS[type] ?? type,
      value: Math.round((count / total) * 100),
      color: JOB_TYPE_COLORS[type] ?? '#9CA3AF',
    }));
}

export async function fetchDistrictAssignments(
  periodStart?: Date,
  periodEnd?: Date,
): Promise<DistrictAssignmentStat[]> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);
  const now = new Date();
  const rangeStart = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeEnd   = periodEnd   ?? now;
  const filtered   = raw.filter(r => { const d = new Date(r.date); return d >= rangeStart && d <= rangeEnd; });
  const byDistrict = new Map<string, number>();
  for (const r of filtered) {
    if (r.district) byDistrict.set(r.district, (byDistrict.get(r.district) ?? 0) + r.jobCount);
  }
  return Array.from(byDistrict.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function fetchResponseTimeTrend(): Promise<ResponseTimeStat[]> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);
  const byMonth = new Map<string, { weightedSum: number; totalJobs: number }>();
  for (const r of raw) {
    if (r.avgResponseMinutes == null || r.jobCount === 0) continue;
    const month = r.date.substring(0, 7);
    const prev = byMonth.get(month) ?? { weightedSum: 0, totalJobs: 0 };
    prev.weightedSum += Number(r.avgResponseMinutes) * r.jobCount;
    prev.totalJobs   += r.jobCount;
    byMonth.set(month, prev);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { weightedSum, totalJobs }]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      minutes: Math.round(weightedSum / totalJobs),
    }));
}

export function fetchExportReports(): Promise<ExportReportItem[]> {
  return Promise.resolve([
    { id: 'assignments', title: 'Assignments Summary',  format: 'CSV', period: 'Current period', iconBg: 'bg-blue-50',  iconColor: 'text-blue-500'  },
    { id: 'guardians',   title: 'Guardian Performance', format: 'CSV', period: 'Current period', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
    { id: 'districts',   title: 'District Activity',    format: 'CSV', period: 'Current period', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  ]);
}
