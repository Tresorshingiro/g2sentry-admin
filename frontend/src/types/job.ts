export type ActivityType =
  | 'ASSIGNMENT'
  | 'REQUEST'
  | 'BILLING'
  | 'INCIDENT'
  | 'COMPLETED';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
}

export interface DistrictStat {
  district: string;
  count: number;
}

export interface WeeklyJobStat {
  day: string;
  count: number;
  completedCount: number;
  isToday: boolean;
}

export interface DashboardStats {
  jobCount: number;
  activeGuardians: number;
  pendingOrgVerifications: number;
  pendingGuardianVerifications: number;
  totalRevenue: string; // Prisma Decimal serializes as string
}
