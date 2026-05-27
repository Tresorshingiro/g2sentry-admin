import type {
  AnalyticsSummary,
  DistrictAssignmentStat,
  ExportReportItem,
  GuardianPerformanceRow,
  JobTypeStat,
  ResponseTimeStat,
  WeeklyAssignmentStat,
} from '@/types/analytics';

export const mockAnalyticsSummary: AnalyticsSummary = {
  totalAssignments: 218,
  totalAssignmentsChangePct: 12,
  avgResponseMinutes: 7.4,
  avgResponseChangeLabel: '-1.2 min improved',
  completionRatePct: 94.2,
  completionRateChangePct: 2.1,
  incidents: 7,
  incidentsChange: 2,
};

export const mockWeeklyAssignments: WeeklyAssignmentStat[] = [
  { week: 'W1', current: 42, previous: 38 },
  { week: 'W2', current: 58, previous: 44 },
  { week: 'W3', current: 49, previous: 41 },
  { week: 'W4', current: 69, previous: 52 },
  { week: 'W5', current: 0, previous: 0 },
];

export const mockJobTypes: JobTypeStat[] = [
  { label: 'Gate security', value: 38, color: '#14B87A' },
  { label: 'Event security', value: 26, color: '#3B82F6' },
  { label: 'Night patrol', value: 18, color: '#F5A524' },
  { label: 'VIP protection', value: 12, color: '#8B5CF6' },
  { label: 'Other', value: 6, color: '#E2E8F0' },
];

export const mockDistrictAssignments: DistrictAssignmentStat[] = [
  { district: 'Nyarugenge', count: 74 },
  { district: 'Gasabo', count: 58 },
  { district: 'Kicukiro', count: 36 },
  { district: 'Musanze', count: 18 },
  { district: 'Rubavu', count: 14 },
  { district: 'Other', count: 18 },
];

export const mockResponseTimeTrend: ResponseTimeStat[] = [
  { month: 'Jan', minutes: 12.1 },
  { month: 'Feb', minutes: 10.8 },
  { month: 'Mar', minutes: 9.6 },
  { month: 'Apr', minutes: 8.6 },
  { month: 'May', minutes: 7.4 },
];

export const mockGuardianPerformance: GuardianPerformanceRow[] = [
  {
    id: '1',
    name: 'Jean-Marie U.',
    initials: 'JM',
    avatarClass: 'bg-green-100 text-green-800',
    jobs: 14,
    response: '5 min',
    responseClass: 'text-green-600',
    reliabilityPct: 96,
    rating: '4.8/5',
    incidents: 0,
    incidentsClass: 'text-slate-500',
    earnings: 'RWF 112k',
  },
  {
    id: '2',
    name: 'Amina N.',
    initials: 'AN',
    avatarClass: 'bg-amber-100 text-amber-800',
    jobs: 11,
    response: '7 min',
    responseClass: 'text-green-600',
    reliabilityPct: 92,
    rating: '4.6/5',
    incidents: 1,
    incidentsClass: 'text-slate-500',
    earnings: 'RWF 88k',
  },
  {
    id: '3',
    name: 'Patrick M.',
    initials: 'PM',
    avatarClass: 'bg-blue-100 text-blue-800',
    jobs: 8,
    response: '11 min',
    responseClass: 'text-amber-500',
    reliabilityPct: 86,
    rating: '4.3/5',
    incidents: 0,
    incidentsClass: 'text-slate-500',
    earnings: 'RWF 64k',
  },
  {
    id: '4',
    name: 'K. Niyonzima',
    initials: 'KN',
    avatarClass: 'bg-violet-100 text-violet-800',
    jobs: 6,
    response: '14 min',
    responseClass: 'text-red-500',
    reliabilityPct: 78,
    rating: '3.9/5',
    incidents: 2,
    incidentsClass: 'text-red-500',
    earnings: 'RWF 48k',
  },
];

export const mockExportReports: ExportReportItem[] = [
  {
    id: '1',
    title: 'Assignments summary',
    format: 'PDF',
    period: 'May 2026',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    id: '2',
    title: 'Guardian performance',
    format: 'CSV',
    period: 'May 2026',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: '3',
    title: 'Revenue by client',
    format: 'PDF',
    period: 'May 2026',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    id: '4',
    title: 'Incident log',
    format: 'PDF',
    period: 'May 2026',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
];
