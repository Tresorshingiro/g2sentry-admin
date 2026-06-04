import type { ActivityItem, DashboardStats, DistrictStat, WeeklyJobStat } from '@/types/job';
import { apiGet } from '@/lib/api-client';
import type { AuditLogItem } from './audit';
import type { RawJobFactsDaily } from './analytics';
import { fetchClients } from './clients';

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
    if (action.includes('INCIDENT'))                                        return 'INCIDENT';
    if (action.includes('INVOICE') || action.includes('PAYMENT'))          return 'BILLING';
    if (action.includes('COMPLETED') || action.includes('COMPLETE'))       return 'COMPLETED';
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
    ? Math.round(
        respRecords.reduce((s, r) => s + Number(r.avgResponseMinutes) * r.jobCount, 0) /
        respRecords.reduce((s, r) => s + r.jobCount, 0),
      )
    : 0;

  return { completionRatePct, avgResponseMinutes };
}

export async function fetchTotalClients(): Promise<number> {
  const res = await fetchClients(1, 1).catch(() => ({
    items: [],
    meta: { page: 1, limit: 1, total: 0, hasMore: false },
    statusCounts: {},
  }));
  return res.meta?.total ?? 0;
}
