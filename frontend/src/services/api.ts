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
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { mockAppSettings, type AppSettings } from './mock/settings';

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

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
  const raw = await apiGet<{ date: string; jobCount: number }[]>('/admin/analytics/jobs').catch(() => []);
  if (!raw.length) return [];

  const byDate = new Map<string, number>();
  for (const r of raw) {
    const key = r.date.substring(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + r.jobCount);
  }

  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toISOString().substring(0, 10);
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: byDate.get(key) ?? 0,
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

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiGet<AnalyticsSummary>('/admin/analytics/dashboard');
}

export async function fetchWeeklyAssignments(): Promise<WeeklyAssignmentStat[]> {
  const raw = await apiGet<{ date: string; jobCount: number; completedCount: number }[]>('/admin/analytics/jobs');
  return raw.map((r) => ({
    week: r.date,
    current: r.completedCount,
    previous: r.jobCount - r.completedCount,
  }));
}

export async function fetchGuardianPerformance(): Promise<GuardianPerformanceRow[]> {
  return apiGet<GuardianPerformanceRow[]>('/admin/analytics/guardians');
}

export function fetchJobTypes(): Promise<JobTypeStat[]> { return Promise.resolve([]); }
export function fetchDistrictAssignments(): Promise<DistrictAssignmentStat[]> { return Promise.resolve([]); }
export function fetchResponseTimeTrend(): Promise<ResponseTimeStat[]> { return Promise.resolve([]); }
export function fetchExportReports(): Promise<ExportReportItem[]> { return Promise.resolve([]); }

export async function fetchBillingSummary(): Promise<BillingSummary> {
  return apiGet<BillingSummary>('/admin/analytics/dashboard');
}

export function fetchMonthlyRevenue(): Promise<MonthlyRevenueStat[]> { return Promise.resolve([]); }

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
  return apiPost(`/admin/invoices/${id}/issue`);
}

export async function voidInvoice(id: string): Promise<unknown> {
  return apiPost(`/admin/invoices/${id}/void`);
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

export async function uploadDocument(file: File): Promise<string | undefined> {
  try {
    const token = localStorage.getItem('g2sentry_token');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { data: { documentId: string } };
    return json.data.documentId;
  } catch {
    return undefined;
  }
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

export async function fetchClients(
  page = 1,
  limit = 20,
  verificationStatus?: string,
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
  const items: ClientListItem[] = Array.isArray(raw)
    ? raw.slice((page - 1) * limit, page * limit).map(normalize)
    : ((raw as ClientListResponse).items ?? []).map(normalize);
  const total = Array.isArray(raw) ? raw.length : ((raw as ClientListResponse).meta?.total ?? items.length);
  const allItems: ClientListItem[] = Array.isArray(raw) ? raw : items;
  const statusCounts: Partial<Record<ClientVerificationStatus, number>> = {};
  for (const c of allItems) {
    if (c.verificationStatus) {
      statusCounts[c.verificationStatus] = (statusCounts[c.verificationStatus] ?? 0) + 1;
    }
  }
  return {
    items,
    meta: { page, limit, total, hasMore: (page - 1) * limit + items.length < total },
    statusCounts,
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
