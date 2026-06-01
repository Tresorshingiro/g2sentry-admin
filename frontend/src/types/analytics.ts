export interface AnalyticsSummary {
  totalAssignments: number;
  totalAssignmentsChangePct: number;
  avgResponseMinutes: number;
  avgResponseChangeLabel: string;
  completionRatePct: number;
  completionRateChangePct: number;
  incidents: number;
  incidentsChange: number;
}

export interface WeeklyAssignmentStat {
  week: string;
  current: number;
  previous: number;
}

export interface JobTypeStat {
  label: string;
  value: number;
  color: string;
}

export interface DistrictAssignmentStat {
  district: string;
  count: number;
}

export interface ResponseTimeStat {
  month: string;
  minutes: number;
}

export interface GuardianPerformanceRow {
  id: string;
  name: string;
  initials: string;
  avatarClass: string;
  jobs: number;
  response: string;
  responseClass: string;
  reliabilityPct: number;
  rating: string;
  incidents: number;
  incidentsClass: string;
  earnings: string;
}

export interface ExportReportItem {
  id: string;
  title: string;
  format: 'PDF' | 'CSV';
  period: string;
  iconBg: string;
  iconColor: string;
}
