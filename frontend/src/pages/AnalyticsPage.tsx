import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ContentCard } from '@/components/shared/ContentCard';
import { MetricCard } from '@/components/shared/MetricCard';
import {
  exportAnalyticsPDF,
  exportAssignmentsPDF,
  exportDistrictActivityPDF,
  exportGuardianPerformancePDF,
} from '@/lib/export-analytics-pdf';
import { cn } from '@/lib/utils';
import {
  fetchAnalyticsSummary,
  fetchDistrictAssignments,
  fetchExportReports,
  fetchGuardianPerformance,
  fetchJobTypes,
  fetchResponseTimeTrend,
  fetchWeeklyAssignments,
} from '@/services/api';
import type {
  AnalyticsSummary,
  DistrictAssignmentStat,
  GuardianPerformanceRow,
  JobTypeStat,
  ResponseTimeStat,
  WeeklyAssignmentStat,
} from '@/types/analytics';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Period ────────────────────────────────────────────────────────────────────
type Period = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3' | 'LAST_6';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'THIS_MONTH', label: 'This month' },
  { key: 'LAST_MONTH', label: 'Last month' },
  { key: 'LAST_3',     label: 'Last 3 months' },
  { key: 'LAST_6',     label: 'Last 6 months' },
];

function getPeriodDates(p: Period): { start: Date; end: Date } {
  const now = new Date();
  switch (p) {
    case 'THIS_MONTH': return { start: new Date(now.getFullYear(), now.getMonth(), 1),     end: now };
    case 'LAST_MONTH': return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0) };
    case 'LAST_3':     return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: now };
    case 'LAST_6':     return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end: now };
  }
}

function getPeriodLabel(p: Period): string {
  const { start, end } = getPeriodDates(p);
  if (p === 'THIS_MONTH' || p === 'LAST_MONTH') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return `${start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} – ${end.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}`;
}

function getPreviousPeriodLabel(p: Period): string {
  const now = new Date();
  if (p === 'THIS_MONTH') return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  if (p === 'LAST_MONTH') return new Date(now.getFullYear(), now.getMonth() - 2, 1).toLocaleDateString('en-US', { month: 'long' });
  return 'previous period';
}


// ── Page ──────────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const [period,      setPeriod]      = useState<Period>('THIS_MONTH');
  const [periodOpen,  setPeriodOpen]  = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  const [summary,       setSummary]       = useState<AnalyticsSummary | null>(null);
  const [weekly,        setWeekly]        = useState<WeeklyAssignmentStat[]>([]);
  const [weeklyCompletion, setWeeklyCompletion] = useState<number[]>([]);
  const [jobTypes,      setJobTypes]      = useState<JobTypeStat[]>([]);
  const [districts,     setDistricts]     = useState<DistrictAssignmentStat[]>([]);
  const [responseTrend, setResponseTrend] = useState<ResponseTimeStat[]>([]);
  const [guardians,     setGuardians]     = useState<GuardianPerformanceRow[]>([]);

  // Close period dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    const { start, end } = getPeriodDates(period);
    void fetchAnalyticsSummary(start, end).then(setSummary);
    void fetchWeeklyAssignments(start, end).then((data) => {
      setWeekly(data);
      setWeeklyCompletion(data.map((w) => {
        const total = w.current + w.previous;
        return total > 0 ? Math.round((w.current / total) * 100) : 0;
      }));
    });
    void fetchJobTypes(start, end).then(setJobTypes);
    void fetchDistrictAssignments(start, end).then(setDistricts);
    void fetchResponseTimeTrend().then(setResponseTrend);
    void fetchGuardianPerformance().then(setGuardians);
    void fetchExportReports().then(() => {}); // reports are defined locally below
  }, [period]);

  // ── Export handlers ───────────────────────────────────────────────────────
  function handleExportReport() {
    if (!summary) return;
    exportAnalyticsPDF(periodLabel, summary, weekly, districts, guardians, prevLabel);
  }

  function handleReportDownload(reportId: string) {
    if (reportId === 'assignments') exportAssignmentsPDF(periodLabel, weekly, prevLabel);
    else if (reportId === 'guardians') exportGuardianPerformancePDF(periodLabel, guardians);
    else if (reportId === 'districts') exportDistrictActivityPDF(periodLabel, districts);
  }

  const periodLabel = getPeriodLabel(period);
  const prevLabel   = getPreviousPeriodLabel(period);

  // ── Chart options ─────────────────────────────────────────────────────────
  const weeklyChartOption = useMemo(() => ({
    grid: { left: 0, right: 40, top: 10, bottom: 24, containLabel: true },
    legend: { show: false },
    xAxis: {
      type: 'category' as const,
      data: weekly.map((w) => w.week),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, fontFamily: IBM },
    },
    yAxis: [
      { type: 'value' as const, show: false },
      {
        type: 'value' as const, min: 0, max: 100,
        axisLabel: { color: '#94a3b8', fontSize: 9, formatter: '{value}%', fontFamily: IBM },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
    ],
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#0F172A',
      borderColor: '#1E293B',
      textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      formatter: (params: { seriesName: string; value: number }[]) =>
        params.map((p) => `${p.seriesName}: ${p.seriesName === 'Completion %' ? `${p.value}%` : p.value}`).join('<br/>'),
    },
    series: [
      { name: prevLabel,    type: 'bar' as const, yAxisIndex: 0, data: weekly.map((w) => w.previous), itemStyle: { color: '#E2E8F0', borderRadius: [3, 3, 0, 0] }, barGap: '20%' },
      { name: periodLabel,  type: 'bar' as const, yAxisIndex: 0, data: weekly.map((w) => w.current),  itemStyle: { color: '#14B87A', borderRadius: [3, 3, 0, 0] } },
      { name: 'Completion %', type: 'line' as const, yAxisIndex: 1, data: weeklyCompletion, smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#f59e0b', width: 2 }, itemStyle: { color: '#f59e0b' } },
    ],
  }), [weekly, weeklyCompletion, periodLabel, prevLabel]);

  const districtChartOption = useMemo(() => ({
    grid: { left: 0, right: 0, top: 20, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: districts.map((d) => d.district.length > 8 ? `${d.district.slice(0, 7)}.` : d.district),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, fontFamily: IBM },
    },
    yAxis: { type: 'value' as const, show: false },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#0F172A', borderColor: '#1E293B',
      textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
    },
    series: [{
      type: 'bar' as const,
      data: districts.map((d, i) => ({
        value: d.count,
        itemStyle: { color: i < 2 ? '#14B87A' : i < 4 ? '#5DCAA5' : '#9FE1CB', borderRadius: [4, 4, 0, 0] },
      })),
      label: { show: true, position: 'top' as const, fontSize: 9, color: '#475569', fontFamily: IBM },
    }],
  }), [districts]);

  const lineChartOption = useMemo(() => ({
    grid: { left: 32, right: 8, top: 8, bottom: 24 },
    xAxis: {
      type: 'category' as const, data: responseTrend.map((r) => r.month), boundaryGap: false,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, fontFamily: IBM },
    },
    yAxis: {
      type: 'value' as const, min: 6, max: 14,
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLabel: { color: '#94a3b8', fontSize: 9, fontFamily: IBM },
    },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#0F172A', borderColor: '#1E293B',
      textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
    },
    series: [{
      type: 'line' as const, data: responseTrend.map((r) => r.minutes), smooth: true,
      symbol: 'circle', symbolSize: 6,
      lineStyle: { color: '#14B87A', width: 2 }, itemStyle: { color: '#14B87A' },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(20,184,122,0.15)' }, { offset: 1, color: 'rgba(20,184,122,0)' }] } },
    }],
  }), [responseTrend]);

  const donutChartOption = useMemo(() => ({
    series: [{
      type: 'pie' as const, radius: ['55%', '75%'], center: ['50%', '50%'],
      avoidLabelOverlap: false, label: { show: false },
      data: jobTypes.map((j) => ({ name: j.label, value: j.value, itemStyle: { color: j.color } })),
    }],
    graphic: [
      { type: 'text', left: 'center', top: '42%', style: { text: String(summary?.totalAssignments ?? 0), fontSize: 11, fontWeight: 700, fill: '#0F172A', fontFamily: IBM } },
      { type: 'text', left: 'center', top: '52%', style: { text: 'total', fontSize: 8, fill: '#64748B', fontFamily: IBM } },
    ],
  }), [jobTypes, summary]);

  // ── Static export report definitions ─────────────────────────────────────
  const EXPORT_REPORTS = [
    { id: 'assignments', title: 'Assignments Summary',  iconBg: 'bg-blue-50',  iconColor: 'text-blue-500'  },
    { id: 'guardians',   title: 'Guardian Performance', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
    { id: 'districts',   title: 'District Activity',    iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50" style={{ fontFamily: IBM }}>
      <div className="p-4 space-y-3">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {/* Period picker */}
          <div ref={periodRef} className="relative">
            <button
              type="button"
              onClick={() => setPeriodOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              {periodLabel}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
            {periodOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-slate-200 rounded shadow-lg min-w-[160px]">
                {PERIODS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setPeriod(key); setPeriodOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer',
                      period === key
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export report
          </button>
        </div>

        {/* ── Metric cards ── */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MetricCard
              icon={<Briefcase className="w-3.5 h-3.5 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={String(summary.totalAssignments)}
              label={`Total assignments · ${periodLabel}`}
              change={`${summary.totalAssignmentsChangePct >= 0 ? '+' : ''}${summary.totalAssignmentsChangePct}% vs ${prevLabel}`}
            />
            <MetricCard
              icon={<Clock className="w-3.5 h-3.5 text-blue-500" />}
              iconBg="bg-blue-100"
              value={summary.avgResponseMinutes > 0 ? `${summary.avgResponseMinutes} min` : '—'}
              label="Avg response time"
              change={summary.avgResponseChangeLabel}
              invertedTrend
            />
            <MetricCard
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={`${summary.completionRatePct}%`}
              label="Completion rate"
              change={`${summary.completionRateChangePct >= 0 ? '+' : ''}${summary.completionRateChangePct} pp vs ${prevLabel}`}
            />
            <MetricCard
              icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              iconBg="bg-red-100"
              value={summary.incidents > 0 ? String(summary.incidents) : '—'}
              label="Incidents reported"
              change={summary.incidentsChange !== 0 ? `${summary.incidentsChange > 0 ? '+' : ''}${summary.incidentsChange} vs ${prevLabel}` : 'No data'}
              positive={false}
            />
          </div>
        )}

        {/* ── Weekly + job types ── */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-3">
            <ContentCard title={`Assignments per week — ${periodLabel}`}>
              {weekly.length > 0 ? (
                <ReactECharts option={weeklyChartOption} style={{ height: 130 }} />
              ) : (
                <div className="h-[130px] flex items-center justify-center">
                  <p className="text-xs text-slate-400">No weekly data for this period</p>
                </div>
              )}
              <div className="flex justify-between mt-2 text-[10px]">
                <div className="flex gap-3 text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#14B87A]" /> {periodLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-slate-200" /> {prevLabel}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Completion %
                  </span>
                </div>
                {summary && (
                  <span className={cn('font-mono font-medium', summary.totalAssignmentsChangePct >= 0 ? 'text-green-600' : 'text-red-500')}>
                    {summary.totalAssignmentsChangePct >= 0 ? '+' : ''}{summary.totalAssignmentsChangePct}% vs {prevLabel}
                  </span>
                )}
              </div>
            </ContentCard>
          </div>
          <div className="sm:col-span-2">
            <ContentCard title="Job type breakdown">
              {jobTypes.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ReactECharts option={donutChartOption} style={{ width: 100, height: 100 }} />
                  <div className="flex flex-col gap-1.5 flex-1">
                    {jobTypes.map((j) => (
                      <div key={j.label} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: j.color }} />
                        {j.label}
                        <span className="font-mono text-slate-500 ml-auto">({j.value}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">No data for this period</p>
              )}
            </ContentCard>
          </div>
        </div>

        {/* ── District + response time ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContentCard title={`Assignments by district — ${periodLabel}`}>
            {districts.length > 0 ? (
              <ReactECharts option={districtChartOption} style={{ height: 120 }} />
            ) : (
              <div className="h-[120px] flex items-center justify-center">
                <p className="text-xs text-slate-400">No district data for this period</p>
              </div>
            )}
          </ContentCard>
          <ContentCard title="Avg response time trend (min)">
            {responseTrend.length > 0 ? (
              <ReactECharts option={lineChartOption} style={{ height: 120 }} />
            ) : (
              <div className="h-[120px] flex items-center justify-center">
                <p className="text-xs text-slate-400">No response data yet</p>
              </div>
            )}
          </ContentCard>
        </div>

        {/* ── Guardian performance + export ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <ContentCard
              title={`Guardian performance — ${periodLabel}`}
              action={
                <button
                  type="button"
                  onClick={() => handleReportDownload('guardians')}
                  className="text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-[#14B87A] transition-colors cursor-pointer"
                >
                  Export PDF
                </button>
              }
            >
              {guardians.length > 0 ? (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden -mx-3.5 divide-y divide-slate-50">
                    {guardians.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${g.avatarClass}`}>
                          {g.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-slate-900 truncate">{g.name}</p>
                            <span className="font-mono text-xs font-bold text-slate-800 shrink-0 tabular-nums">{g.jobs} jobs</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 w-16 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#14B87A] rounded-full" style={{ width: `${g.reliabilityPct}%` }} />
                            </div>
                            <span className="font-mono text-[10px] text-slate-500">{g.reliabilityPct}%</span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className={cn('font-mono text-[10px]', g.responseClass)}>{g.response}</span>
                            {g.incidents > 0 && (
                              <>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className={cn('font-mono text-[10px]', g.incidentsClass)}>{g.incidents} no-show</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto -mx-3.5">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {['Guardian', 'Jobs', 'Response', 'Reliability', 'Incidents', 'Earnings'].map((h) => (
                            <th key={h} className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {guardians.map((g) => (
                          <tr key={g.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold ${g.avatarClass}`}>{g.initials}</div>
                                <span className="text-xs font-medium text-slate-900">{g.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-900">{g.jobs}</td>
                            <td className={cn('px-3 py-2 font-mono text-xs', g.responseClass)}>{g.response}</td>
                            <td className="px-3 py-2">
                              <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden mb-0.5">
                                <div className="h-full bg-[#14B87A] rounded-full" style={{ width: `${g.reliabilityPct}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-slate-500">{g.rating}</span>
                            </td>
                            <td className={cn('px-3 py-2 font-mono text-xs', g.incidentsClass)}>{g.incidents}</td>
                            <td className="px-3 py-2 font-mono text-xs font-medium text-green-600">{g.earnings}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No performance data for this period</p>
              )}
            </ContentCard>
          </div>

          {/* Export reports */}
          <ContentCard title="Export reports">
            <div className="flex flex-col gap-2">
              {EXPORT_REPORTS.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-7 h-7 rounded flex items-center justify-center', r.iconBg)}>
                      <FileText className={cn('w-3.5 h-3.5', r.iconColor)} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-900">{r.title}</p>
                      <p className="font-mono text-[10px] text-slate-400">PDF · {periodLabel}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReportDownload(r.id)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3 h-3" /> PDF
                  </button>
                </div>
              ))}
            </div>
          </ContentCard>
        </div>

      </div>
    </div>
  );
}
