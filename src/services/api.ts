import type {
  AnalyticsSummary,
  DistrictAssignmentStat,
  ExportReportItem,
  GuardianPerformanceRow,
  JobTypeStat,
  ResponseTimeStat,
  WeeklyAssignmentStat,
} from '@/types/analytics';
import type { AssignmentDetail, AssignmentListItem } from '@/types/assignment';
import type { AuthUser } from '@/types/auth';
import type { GuardianListItem, GuardianProfile } from '@/types/guardian-roster';
import type {
  BillingSummary,
  EbmComplianceInfo,
  InvoiceRow,
  MonthlyRevenueStat,
} from '@/types/billing';
import type { ClientLocation, Guardian } from '@/types/guardian';
import type {
  ActivityItem,
  DashboardStats,
  DistrictStat,
  WeeklyJobStat,
} from '@/types/job';
import {
  mockAnalyticsSummary,
  mockDistrictAssignments,
  mockExportReports,
  mockGuardianPerformance,
  mockJobTypes,
  mockResponseTimeTrend,
  mockWeeklyAssignments,
} from './mock/analytics';
import { mockActivity } from './mock/activity';
import {
  mockBillingSummary,
  mockEbmCompliance,
  mockInvoices,
  mockMonthlyRevenue,
} from './mock/billing';
import { mockClientLocations, mockGuardians } from './mock/guardians';
import {
  mockDashboardStats,
  mockDistrictStats,
  mockWeeklyStats,
} from './mock/jobs';
import {
  mockAssignmentDetails,
  mockAssignments,
} from './mock/assignments';
import {
  mockGuardianProfiles,
  mockGuardianRoster,
} from './mock/guardian-roster';
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
    user: { id: '1', name: 'Admin', role: 'SUPER_ADMIN' },
  };
}

export async function fetchGuardians(): Promise<{
  guardians: Guardian[];
  clientLocations: ClientLocation[];
}> {
  await delay(300);
  return { guardians: mockGuardians, clientLocations: mockClientLocations };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  await delay(200);
  return mockDashboardStats;
}

export async function fetchWeeklyStats(): Promise<WeeklyJobStat[]> {
  await delay(200);
  return mockWeeklyStats;
}

export async function fetchActivity(): Promise<ActivityItem[]> {
  await delay(200);
  return mockActivity;
}

export async function fetchDistrictStats(): Promise<DistrictStat[]> {
  await delay(200);
  return mockDistrictStats;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  await delay(200);
  return mockAnalyticsSummary;
}

export async function fetchWeeklyAssignments(): Promise<WeeklyAssignmentStat[]> {
  await delay(200);
  return mockWeeklyAssignments;
}

export async function fetchJobTypes(): Promise<JobTypeStat[]> {
  await delay(200);
  return mockJobTypes;
}

export async function fetchDistrictAssignments(): Promise<DistrictAssignmentStat[]> {
  await delay(200);
  return mockDistrictAssignments;
}

export async function fetchResponseTimeTrend(): Promise<ResponseTimeStat[]> {
  await delay(200);
  return mockResponseTimeTrend;
}

export async function fetchGuardianPerformance(): Promise<GuardianPerformanceRow[]> {
  await delay(200);
  return mockGuardianPerformance;
}

export async function fetchExportReports(): Promise<ExportReportItem[]> {
  await delay(200);
  return mockExportReports;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  await delay(200);
  return mockBillingSummary;
}

export async function fetchMonthlyRevenue(): Promise<MonthlyRevenueStat[]> {
  await delay(200);
  return mockMonthlyRevenue;
}

export async function fetchEbmCompliance(): Promise<EbmComplianceInfo> {
  await delay(200);
  return mockEbmCompliance;
}

export async function fetchInvoices(): Promise<InvoiceRow[]> {
  await delay(200);
  return mockInvoices;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  await delay(200);
  return { ...mockAppSettings };
}

export async function fetchAssignments(): Promise<AssignmentListItem[]> {
  await delay(200);
  return mockAssignments;
}

export async function fetchAssignmentById(
  id: string,
): Promise<AssignmentDetail | null> {
  await delay(200);
  return mockAssignmentDetails[id] ?? null;
}

export async function fetchGuardianRoster(): Promise<GuardianListItem[]> {
  await delay(200);
  return mockGuardianRoster;
}

export async function fetchGuardianProfile(
  id: string,
): Promise<GuardianProfile | null> {
  await delay(200);
  return mockGuardianProfiles[id] ?? null;
}
