import type {
  AnalyticsSummary,
  DistrictAssignmentStat,
  ExportReportItem,
  GuardianPerformanceRow,
  JobTypeStat,
  ResponseTimeStat,
  WeeklyAssignmentStat,
} from '@/types/analytics';
import type { JobListResponse } from '@/types/assignment';
import type { AuthUser } from '@/types/auth';
import type { GuardianListResponse } from '@/types/guardian-roster';
import type {
  BillingSummary,
  EbmComplianceInfo,
  InvoiceListResponse,
  MonthlyRevenueStat,
} from '@/types/billing';
import type { ClientListItem, ClientListResponse, ClientVerificationStatus } from '@/types/client';
import type { ClientLocation, Guardian } from '@/types/guardian';
import type {
  ActivityItem,
  DashboardStats,
  DistrictStat,
  WeeklyJobStat,
} from '@/types/job';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { mockAppSettings, type AppSettings } from './mock/settings';

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

// ── Raw shapes returned by the backend analytics endpoints ─────────────────
interface RawJobFactsDaily {
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

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  await delay(800);
  if (!email || !password) throw new Error('Email and password are required');
  return {
    token: `mock-token-${Date.now()}`,
    user: { id: '1', name: 'Admin', role: 'SUPER_ADMIN', permissions: [] },
  };
}

interface GuardianMapItem {
  guardianId: string;
  guardianCode: string;
  fullName: string | null;
  districtBase?: string | null;
  status: string;
  shiftStatus: string;
  availableForJobs: boolean;
  latitude: number | string | null;
  longitude: number | string | null;
  connected: boolean;
  reachable: boolean;
}

interface SiteMapItem {
  id: string;
  name?: string;
  district?: string | null;
  latitude: number | string;
  longitude: number | string;
  organizationId?: string;
  organization?: { legalName?: string; tradingName?: string | null } | null;
}

function shiftStatusToMapStatus(shiftStatus: string): Guardian['status'] {
  if (shiftStatus === 'BUSY') return 'ON_DUTY';
  if (shiftStatus === 'AVAILABLE') return 'AVAILABLE';
  return 'OFFLINE';
}

function toInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export async function fetchGuardians(): Promise<{
  guardians: Guardian[];
  clientLocations: ClientLocation[];
}> {
  const [rawGuardians, rawSites] = await Promise.all([
    apiGet<unknown>('/admin/map/guardians'),
    apiGet<unknown>('/admin/map/sites').catch(() => []),
  ]);

  const guardianItems: GuardianMapItem[] = Array.isArray(rawGuardians)
    ? rawGuardians
    : ((rawGuardians as { items?: GuardianMapItem[] })?.items ?? []);
  const siteItems: SiteMapItem[] = Array.isArray(rawSites)
    ? rawSites
    : ((rawSites as { items?: SiteMapItem[] })?.items ?? []);

  const guardians: Guardian[] = guardianItems.map((g) => {
    const name = g.fullName ?? g.guardianCode ?? 'Guardian';
    return {
      id: g.guardianId,
      name,
      initials: toInitials(name),
      district: g.districtBase
        ? `${g.districtBase} · ${g.guardianCode}`
        : g.guardianCode ?? '',
      assignmentType: '',
      status: shiftStatusToMapStatus(g.shiftStatus),
      lat: g.latitude != null ? Number(g.latitude) : NaN,
      lng: g.longitude != null ? Number(g.longitude) : NaN,
    };
  });

  const clientLocations: ClientLocation[] = siteItems.map((s) => ({
    id: s.id,
    lat: Number(s.latitude),
    lng: Number(s.longitude),
    name: s.name,
    district: s.district,
    organizationName: s.organization?.tradingName ?? s.organization?.legalName,
  }));

  return { guardians, clientLocations };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/admin/analytics/dashboard');
}

export async function fetchWeeklyStats(): Promise<WeeklyJobStat[]> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);
  if (!raw.length) return [];

  const byDate = new Map<string, { count: number; completedCount: number }>();
  for (const r of raw) {
    const key = r.date.substring(0, 10);
    const prev = byDate.get(key) ?? { count: 0, completedCount: 0 };
    prev.count += r.jobCount;
    prev.completedCount += r.completedCount;
    byDate.set(key, prev);
  }

  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toISOString().substring(0, 10);
    const data = byDate.get(key) ?? { count: 0, completedCount: 0 };
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: data.count,
      completedCount: data.completedCount,
      isToday: i === 6,
    };
  });
}

export async function fetchActivity(): Promise<ActivityItem[]> {
  const res = await apiGet<{ items: AuditLogItem[] }>('/admin/audit-logs?page=1&limit=10').catch(() => ({ items: [] }));
  const items = res.items ?? [];

  function actionToType(action: string): ActivityItem['type'] {
    if (action.includes('INCIDENT'))                       return 'INCIDENT';
    if (action.includes('INVOICE') || action.includes('PAYMENT')) return 'BILLING';
    if (action.includes('COMPLETED') || action.includes('COMPLETE')) return 'COMPLETED';
    if (action.includes('JOB') || action.includes('GUARDIAN') || action.includes('ASSIGNMENT')) return 'ASSIGNMENT';
    return 'REQUEST';
  }

  function formatAction(log: AuditLogItem): string {
    const actor = log.actor?.fullName ?? log.actor?.phoneNumber ?? 'System';
    const label = log.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return `${actor} · ${label}`;
  }

  return items.map((log) => ({
    id: log.id,
    type: actionToType(log.action),
    description: formatAction(log),
    timestamp: new Date(log.createdAt).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
  }));
}

export async function fetchDistrictStats(): Promise<DistrictStat[]> {
  const raw = await apiGet<{ district: string; jobCount: number }[]>('/admin/analytics/jobs').catch(() => []);
  if (!raw.length) return [];

  const byDistrict = new Map<string, number>();
  for (const r of raw) {
    if (r.district) byDistrict.set(r.district, (byDistrict.get(r.district) ?? 0) + r.jobCount);
  }

  return Array.from(byDistrict.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

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

  type Agg = { totalCompleted: number; totalAssigned: number; noShows: number; respSum: number; respJobs: number; ratingSum: number; ratingCount: number };
  const byGuardian = new Map<string, Agg>();

  for (const r of rawPerf) {
    const agg = byGuardian.get(r.guardianId) ?? { totalCompleted: 0, totalAssigned: 0, noShows: 0, respSum: 0, respJobs: 0, ratingSum: 0, ratingCount: 0 };
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
    const name     = nameMap.get(guardianId) ?? `Guardian …${guardianId.slice(-4)}`;
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const avgResp  = agg.respJobs > 0 ? Math.round(agg.respSum / agg.respJobs) : 0;
    const avgRating = agg.ratingCount > 0 ? agg.ratingSum / agg.ratingCount : 0;
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
    { id: 'assignments', title: 'Assignments Summary', format: 'CSV', period: 'Current period', iconBg: 'bg-blue-50',   iconColor: 'text-blue-500'   },
    { id: 'guardians',   title: 'Guardian Performance', format: 'CSV', period: 'Current period', iconBg: 'bg-green-50', iconColor: 'text-green-600'  },
    { id: 'districts',   title: 'District Activity',    format: 'CSV', period: 'Current period', iconBg: 'bg-amber-50', iconColor: 'text-amber-600'  },
  ]);
}

export async function fetchGuardianAvailability(): Promise<{
  available: number;
  onDuty: number;
  offline: number;
}> {
  const raw = await apiGet<unknown>('/admin/map/guardians').catch(() => []);
  const items = Array.isArray(raw)
    ? (raw as { shiftStatus: string }[])
    : ((raw as { items?: { shiftStatus: string }[] })?.items ?? []);
  let available = 0, onDuty = 0, offline = 0;
  for (const g of items) {
    if (g.shiftStatus === 'AVAILABLE')          available++;
    else if (g.shiftStatus === 'BUSY')           onDuty++;
    else                                          offline++;
  }
  return { available, onDuty, offline };
}

export async function fetchLiveJobCounts(): Promise<{
  inProgress: number;
  dispatching: number;
  pending: number;
}> {
  const [inProgress, dispatching, pending] = await Promise.all([
    fetchAssignments(1, 1, 'IN_PROGRESS').catch(() => ({ items: [], meta: { page: 1, limit: 1, total: 0, hasMore: false } })),
    fetchAssignments(1, 1, 'DISPATCHING').catch(() => ({ items: [], meta: { page: 1, limit: 1, total: 0, hasMore: false } })),
    fetchAssignments(1, 1, 'PENDING').catch(() => ({ items: [], meta: { page: 1, limit: 1, total: 0, hasMore: false } })),
  ]);
  return {
    inProgress: inProgress.meta?.total ?? 0,
    dispatching: dispatching.meta?.total ?? 0,
    pending: pending.meta?.total ?? 0,
  };
}

export async function fetchTotalClients(): Promise<number> {
  const res = await fetchClients(1, 1).catch(() => ({ items: [], meta: { page: 1, limit: 1, total: 0, hasMore: false }, statusCounts: {} }));
  return res.meta?.total ?? 0;
}

export async function fetchDashboardJobMetrics(): Promise<{ completionRatePct: number; avgResponseMinutes: number }> {
  const raw = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]);
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const recent = raw.filter(r => new Date(r.date) >= sevenDaysAgo);
  const totalJobs = recent.reduce((s, r) => s + r.jobCount, 0);
  const completedJobs = recent.reduce((s, r) => s + r.completedCount, 0);
  const completionRatePct = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  const respRecords = recent.filter(r => r.avgResponseMinutes != null && r.jobCount > 0);
  const avgResponseMinutes = respRecords.length > 0
    ? Math.round(respRecords.reduce((s, r) => s + Number(r.avgResponseMinutes) * r.jobCount, 0) /
        respRecords.reduce((s, r) => s + r.jobCount, 0))
    : 0;

  return { completionRatePct, avgResponseMinutes };
}

export async function fetchBillingOverview(): Promise<{
  summary: BillingSummary;
  ebm: EbmComplianceInfo;
}> {
  type DashboardRes = { totalRevenue: string | number };
  const [dashboard, issuedRes, overdueRes, paidRes] = await Promise.all([
    apiGet<DashboardRes>('/admin/analytics/dashboard'),
    apiGet<InvoiceListResponse>('/admin/invoices?status=ISSUED&page=1&limit=100'),
    apiGet<InvoiceListResponse>('/admin/invoices?status=OVERDUE&page=1&limit=100'),
    apiGet<InvoiceListResponse>('/admin/invoices?status=PAID&page=1&limit=100'),
  ]);

  const outstanding = [...issuedRes.items, ...overdueRes.items].reduce(
    (sum, inv) => sum + Number(inv.total ?? 0), 0,
  );
  const outstandingInvoiceCount = issuedRes.meta.total + overdueRes.meta.total;
  const vatCollected = paidRes.items.reduce(
    (sum, inv) => sum + Number(inv.taxAmount ?? 0), 0,
  );
  const invoicesIssued = issuedRes.meta.total + paidRes.meta.total;
  const ebmFiscalReceipts = paidRes.meta.total;

  const now = new Date();
  const nextFiling = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const nextFilingDate = nextFiling.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const summary: BillingSummary = {
    totalRevenue: Number(dashboard.totalRevenue ?? 0),
    totalRevenueChangePct: 0,
    outstanding,
    outstandingInvoiceCount,
    paymentsToday: 0,
    paymentsTodayCount: 0,
    vatCollected,
  };

  const ebm: EbmComplianceInfo = {
    status: 'compliant',
    lastSync: new Date().toISOString(),
    invoicesIssued,
    ebmReceiptsSent: ebmFiscalReceipts,
    vatCollected,
    nextFilingDate,
  };

  return { summary, ebm };
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const { summary } = await fetchBillingOverview();
  return summary;
}

export interface MonthlyChartPoint {
  month: string;
  revenue: number;
  outstanding: number;
}

export async function fetchMonthlyChartData(): Promise<MonthlyChartPoint[]> {
  const [facts, issuedRes, overdueRes] = await Promise.all([
    apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]),
    apiGet<InvoiceListResponse>('/admin/invoices?status=ISSUED&page=1&limit=100').catch(
      () => ({ items: [], meta: { total: 0, page: 1, limit: 100, hasMore: false } }),
    ),
    apiGet<InvoiceListResponse>('/admin/invoices?status=OVERDUE&page=1&limit=100').catch(
      () => ({ items: [], meta: { total: 0, page: 1, limit: 100, hasMore: false } }),
    ),
  ]);

  const revenueByMonth: Record<string, number> = {};
  facts.forEach((r) => {
    const ym = r.date.slice(0, 7);
    revenueByMonth[ym] = (revenueByMonth[ym] ?? 0) + Number(r.totalRevenue ?? 0);
  });

  const outstandingByMonth: Record<string, number> = {};
  [...issuedRes.items, ...overdueRes.items].forEach((inv) => {
    const ym = (inv.issuedAt ?? inv.createdAt).slice(0, 7);
    outstandingByMonth[ym] = (outstandingByMonth[ym] ?? 0) + Number(inv.total ?? 0);
  });

  const allMonths = new Set([...Object.keys(revenueByMonth), ...Object.keys(outstandingByMonth)]);
  if (allMonths.size === 0) {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  return [...allMonths]
    .sort()
    .slice(-8)
    .map((ym) => ({
      month: new Date(ym + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      revenue: Math.round((revenueByMonth[ym] ?? 0) / 100_000) / 10,
      outstanding: Math.round((outstandingByMonth[ym] ?? 0) / 100_000) / 10,
    }));
}

export async function fetchMonthlyRevenue(): Promise<MonthlyRevenueStat[]> {
  const rows = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => []);
  const byMonth: Record<string, number> = {};
  rows.forEach((r) => {
    const ym = r.date.slice(0, 7);
    byMonth[ym] = (byMonth[ym] ?? 0) + Number(r.totalRevenue ?? 0);
  });
  const currentYM = new Date().toISOString().slice(0, 7);
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([ym, revenue]) => ({
      month: new Date(ym + '-01').toLocaleDateString('en', { month: 'short' }),
      valueM: Math.round(revenue / 100_000) / 10,
      isCurrent: ym === currentYM,
    }));
}

export function fetchEbmCompliance(): Promise<EbmComplianceInfo> {
  return Promise.resolve({
    status: 'compliant',
    lastSync: new Date().toISOString(),
    invoicesIssued: 0,
    ebmReceiptsSent: 0,
    vatCollected: 0,
    nextFilingDate: '—',
  } as EbmComplianceInfo);
}

export async function fetchInvoices(
  page = 1,
  limit = 20,
  status?: string,
): Promise<InvoiceListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'ALL') params.set('status', status);
  return apiGet<InvoiceListResponse>(`/admin/invoices?${params}`);
}

export async function issueInvoice(id: string): Promise<unknown> {
  return apiPost(`/invoices/${id}/issue`);
}

export async function voidInvoice(id: string): Promise<unknown> {
  return apiPost(`/invoices/${id}/void`);
}

export async function fetchInvoiceById(id: string): Promise<import('@/types/billing').InvoiceDetail> {
  return apiGet(`/invoices/${id}`);
}

export async function fetchOrgById(id: string): Promise<{ id: string; legalName: string; tradingName: string | null; orgType: string }> {
  return apiGet(`/organizations/${id}`);
}

export async function fetchAppSettings(): Promise<AppSettings> {
  await delay(200);
  return { ...mockAppSettings };
}

export async function fetchAssignments(
  page = 1,
  limit = 20,
  status?: string,
): Promise<JobListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiGet<JobListResponse>(`/jobs?${params}`);
}

export async function fetchAssignmentById(id: string): Promise<unknown> {
  return apiGet(`/jobs/${id}`);
}

export async function dispatchJob(id: string): Promise<unknown> {
  return apiPost(`/jobs/${id}/dispatch`);
}

export async function cancelJob(id: string, reason?: string): Promise<unknown> {
  return apiPatch(`/jobs/${id}/cancel`, { reason });
}

export async function completeJob(id: string): Promise<unknown> {
  return apiPost(`/jobs/${id}/complete`);
}

export async function fetchGuardianRoster(
  page = 1,
  limit = 50,
  status?: string,
  verificationStatus?: string,
): Promise<GuardianListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (verificationStatus) params.set('verificationStatus', verificationStatus);
  return apiGet<GuardianListResponse>(`/admin/guardians?${params}`);
}

export async function fetchGuardianProfile(id: string): Promise<unknown> {
  return apiGet(`/admin/guardians/${id}`);
}

export interface UpdateGuardianPayload {
  fullName?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  districtBase?: string;
  sectorBase?: string;
  coverageDistricts?: string[];
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'RESERVE';
  yearsExperience?: number;
  specializations?: string[];
  preferredShift?: 'DAY' | 'NIGHT' | 'BOTH';
}

export async function updateGuardian(id: string, dto: UpdateGuardianPayload): Promise<unknown> {
  return apiPatch(`/admin/guardians/${id}`, dto);
}

export async function activateGuardian(id: string): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/activate`);
}

export async function suspendGuardian(id: string): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/suspend`);
}

export async function createGuardianVetting(
  id: string,
  dto: { rnpReferenceNumber?: string; reserveForceVerified?: boolean; notes?: string },
): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/vetting`, dto);
}

export interface CreateGuardianPayload {
  phone: string;
  fullName: string;
  nationalId: string;
  districtBase: string;
  sectorBase?: string;
  coverageDistricts?: string[];
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  email?: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'RESERVE';
  yearsExperience?: number;
  specializations?: string[];
  preferredShift?: 'DAY' | 'NIGHT' | 'BOTH';
  reserveForceNumber?: string;
  rnpReferenceNumber?: string;
  vettingNotes?: string;
}

export async function createGuardian(dto: CreateGuardianPayload): Promise<unknown> {
  return apiPost('/admin/guardians', dto);
}

export async function fetchPendingOrgs(): Promise<unknown[]> {
  return apiGet('/admin/verification/organizations');
}

export async function reviewOrganization(
  id: string,
  status: 'VERIFIED' | 'REJECTED',
  reason?: string,
): Promise<unknown> {
  return apiPatch(`/admin/verification/organizations/${id}`, { status, reason });
}

export async function fetchPendingGuardians(): Promise<unknown[]> {
  return apiGet('/admin/verification/guardians');
}

export async function reviewGuardian(
  id: string,
  status: 'VERIFIED' | 'REJECTED',
  reason?: string,
): Promise<unknown> {
  return apiPatch(`/admin/verification/guardians/${id}`, { status, ...(reason && { reason }) });
}

export async function reviewCertification(
  id: string,
  status: 'VERIFIED' | 'REJECTED' | 'EXPIRED',
): Promise<unknown> {
  return apiPatch(`/admin/verification/certifications/${id}`, { status });
}

export async function uploadDocument(file: File): Promise<string> {
  const token = localStorage.getItem('g2sentry_token');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `File upload failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data: { documentId: string } };
  return json.data.documentId;
}

export interface AddCertificationPayload {
  certificationType: 'FIRST_AID' | 'CROWD_CONTROL' | 'FIREARM' | 'RESERVE_FORCE' | 'RNP_SECURITY_LICENSE';
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  documentId?: string;
}

export async function addCertification(
  guardianId: string,
  dto: AddCertificationPayload,
): Promise<unknown> {
  return apiPost(`/admin/guardians/${guardianId}/certifications`, dto);
}

export async function fetchClientById(id: string): Promise<unknown> {
  return apiGet(`/organizations/${id}`);
}

export async function fetchAdminOrgById(id: string): Promise<unknown> {
  const BATCH = 100;
  const first = await apiGet<{ items: unknown[]; meta: { total: number } }>(
    `/admin/organizations?page=1&limit=${BATCH}`,
  );
  const items = first.items ?? [];
  const found = items.find((o) => (o as { id: string }).id === id);
  if (found) return found;

  const total = first.meta?.total ?? items.length;
  const totalPages = Math.ceil(total / BATCH);
  if (totalPages <= 1) return null;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      apiGet<{ items: unknown[] }>(`/admin/organizations?page=${i + 2}&limit=${BATCH}`),
    ),
  );
  for (const page of rest) {
    const match = (page.items ?? []).find((o) => (o as { id: string }).id === id);
    if (match) return match;
  }
  return null;
}

export async function fetchClients(
  page = 1,
  limit = 20,
  verificationStatus?: string,
  district?: string,
  orgType?: string,
): Promise<ClientListResponse> {
  const params = new URLSearchParams();
  if (verificationStatus) params.set('status', verificationStatus);
  const query = params.toString();
  const raw = await apiGet<ClientListResponse | ClientListItem[]>(`/admin/organizations${query ? `?${query}` : ''}`);
  const normalize = (c: ClientListItem): ClientListItem => ({
    ...c,
    activeJobCount: c.activeJobCount ?? 0,
    outstandingBalance: c.outstandingBalance ?? 0,
  });

  let fullList: ClientListItem[] = Array.isArray(raw)
    ? raw.map(normalize)
    : ((raw as ClientListResponse).items ?? []).map(normalize);

  // Collect available filter options before applying district/orgType filters
  const availableDistricts = [...new Set(
    fullList.map((c) => c.primaryDistrict).filter(Boolean) as string[]
  )].sort();
  const availableOrgTypes = [...new Set(
    fullList.map((c) => c.orgType).filter(Boolean) as string[]
  )].sort();

  // Compute statusCounts from full list (before district/orgType filtering)
  const statusCounts: Partial<Record<ClientVerificationStatus, number>> = {};
  for (const c of fullList) {
    if (c.verificationStatus) {
      statusCounts[c.verificationStatus] = (statusCounts[c.verificationStatus] ?? 0) + 1;
    }
  }

  // Apply client-side district / orgType filters
  if (district) fullList = fullList.filter((c) => c.primaryDistrict === district);
  if (orgType)  fullList = fullList.filter((c) => c.orgType === orgType);

  const total = fullList.length;
  const items = Array.isArray(raw)
    ? fullList.slice((page - 1) * limit, page * limit)
    : fullList;

  return {
    items,
    meta: { page, limit, total, hasMore: (page - 1) * limit + items.length < total },
    statusCounts,
    availableDistricts,
    availableOrgTypes,
  };
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; fullName: string | null; phoneNumber: string } | null;
}

export interface FullProfile {
  id: string;
  phone: string;
  email: string | null;
  status: string;
  roles: string[];
  permissions: string[];
  activeRole: string | null;
  organizations: {
    id: string;
    legalName: string;
    tradingName: string | null;
    role: string;
    verificationStatus: string;
  }[];
}

export async function fetchFullProfile(): Promise<FullProfile> {
  return apiGet<FullProfile>('/users/me');
}

export async function updateProfileEmail(email: string): Promise<unknown> {
  return apiPatch('/users/me', { email });
}

export async function changePassword(
  password: string,
  confirmPassword: string,
): Promise<unknown> {
  return apiPost('/auth/password/set', { password, confirmPassword });
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotifications(
  page = 1,
  limit = 20,
): Promise<{ items: NotificationItem[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  return apiGet(`/notifications?page=${page}&limit=${limit}`);
}

export async function markNotificationRead(id: string): Promise<unknown> {
  return apiPatch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<unknown> {
  return apiPost('/notifications/read-all');
}

export interface FieldIncident {
  id: string;
  incidentType: string;
  severity: string;
  description: string;
  mediaIds: string[];
  createdAt: string;
  reporter: { fullName: string | null; phoneNumber: string } | null;
  assignment: {
    id: string;
    guardianId: string;
    status: string;
    guardian?: { guardianCode: string } | null;
    job?: { referenceNumber: string; status: string } | null;
  } | null;
}

export async function fetchJobIncidents(jobId: string): Promise<FieldIncident[]> {
  const raw = await apiGet<unknown>(`/jobs/${jobId}/incidents`);
  if (Array.isArray(raw)) return raw as FieldIncident[];
  return ((raw as { items?: FieldIncident[] })?.items ?? []) as FieldIncident[];
}

export async function fetchAllIncidents(
  page = 1,
  limit = 20,
  severity?: string,
  incidentType?: string,
): Promise<{ items: FieldIncident[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (severity)     params.set('severity', severity);
  if (incidentType) params.set('incidentType', incidentType);
  return apiGet(`/admin/incidents?${params}`);
}

export async function deleteGuardianUser(userId: string): Promise<void> {
  return apiDelete(`/admin/users/${userId}?mode=hard`);
}

export async function fetchAuditLogs(
  page = 1,
  limit = 20,
  actorUserId?: string,
  entityType?: string,
): Promise<{ items: AuditLogItem[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (actorUserId) params.set('actorUserId', actorUserId);
  if (entityType) params.set('entityType', entityType);
  return apiGet(`/admin/audit-logs?${params}`);
}
