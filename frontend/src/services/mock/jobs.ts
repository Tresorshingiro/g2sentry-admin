import type { DashboardStats, DistrictStat, WeeklyJobStat } from '@/types/job';

export const mockDashboardStats: DashboardStats = {
  jobCount: 34,
  activeGuardians: 28,
  pendingOrgVerifications: 5,
  pendingGuardianVerifications: 7,
  totalRevenue: '620000',
};

export const mockWeeklyStats: WeeklyJobStat[] = [
  { day: 'Mon', count: 28, completedCount: 22, isToday: false },
  { day: 'Tue', count: 36, completedCount: 30, isToday: false },
  { day: 'Wed', count: 24, completedCount: 20, isToday: false },
  { day: 'Thu', count: 42, completedCount: 35, isToday: false },
  { day: 'Fri', count: 34, completedCount: 28, isToday: false },
  { day: 'Sat', count: 51, completedCount: 44, isToday: true  },
  { day: 'Sun', count: 18, completedCount: 14, isToday: false },
];

export const mockDistrictStats: DistrictStat[] = [
  { district: 'Nyarugenge', count: 18 },
  { district: 'Gasabo',     count: 14 },
  { district: 'Kicukiro',   count: 9  },
  { district: 'Musanze',    count: 4  },
  { district: 'Rubavu',     count: 3  },
];
