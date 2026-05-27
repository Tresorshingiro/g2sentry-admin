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
  isToday: boolean;
}

export interface DashboardStats {
  activeAssignments: number;
  activeAssignmentsDelta: number;
  guardiansOnDuty: number;
  guardiansOnDutyDelta: number;
  pendingRequests: number;
  pendingRequestsDelta: number;
  revenueToday: number;
  revenueTodayDeltaPct: number;
}
