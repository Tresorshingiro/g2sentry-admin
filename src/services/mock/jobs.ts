import type { DashboardStats, DistrictStat, WeeklyJobStat } from '@/types/job';

export const mockDashboardStats: DashboardStats = {
  activeAssignments: 34,
  activeAssignmentsDelta: 6,
  guardiansOnDuty: 28,
  guardiansOnDutyDelta: 3,
  pendingRequests: 12,
  pendingRequestsDelta: -2,
  revenueToday: 620000,
  revenueTodayDeltaPct: 18,
};

export const mockWeeklyStats: WeeklyJobStat[] = [
  { day: 'Mon', count: 28, isToday: false },
  { day: 'Tue', count: 36, isToday: false },
  { day: 'Wed', count: 24, isToday: false },
  { day: 'Thu', count: 42, isToday: false },
  { day: 'Fri', count: 34, isToday: false },
  { day: 'Sat', count: 51, isToday: true  },
  { day: 'Sun', count: 18, isToday: false },
];

export const mockDistrictStats: DistrictStat[] = [
  { district: 'Nyarugenge', count: 18 },
  { district: 'Gasabo',     count: 14 },
  { district: 'Kicukiro',   count: 9  },
  { district: 'Musanze',    count: 4  },
  { district: 'Rubavu',     count: 3  },
];
