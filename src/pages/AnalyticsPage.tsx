import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  Sheet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ContentCard } from '@/components/shared/ContentCard';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
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
  ExportReportItem,
  GuardianPerformanceRow,
  JobTypeStat,
  ResponseTimeStat,
  WeeklyAssignmentStat,
} from '@/types/analytics';

export function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyAssignmentStat[]>([]);
  const [jobTypes, setJobTypes] = useState<JobTypeStat[]>([]);
  const [districts, setDistricts] = useState<DistrictAssignmentStat[]>([]);
  const [responseTrend, setResponseTrend] = useState<ResponseTimeStat[]>([]);
  const [guardians, setGuardians] = useState<GuardianPerformanceRow[]>([]);
  const [reports, setReports] = useState<ExportReportItem[]>([]);

  useEffect(() => {
    void fetchAnalyticsSummary().then(setSummary);
    void fetchWeeklyAssignments().then(setWeekly);
    void fetchJobTypes().then(setJobTypes);
    void fetchDistrictAssignments().then(setDistricts);
    void fetchResponseTimeTrend().then(setResponseTrend);
    void fetchGuardianPerformance().then(setGuardians);
    void fetchExportReports().then(setReports);
  }, []);

  const weeklyChartOption = useMemo(
    () => ({
      grid: { left: 0, right: 0, top: 10, bottom: 24, containLabel: true },
      legend: { show: false },
      xAxis: {
        type: 'category' as const,
        data: weekly.map((w) => w.week),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          name: 'Last month',
          type: 'bar' as const,
          data: weekly.map((w) => w.previous),
          itemStyle: { color: '#E2E8F0', borderRadius: [3, 3, 0, 0] },
          barGap: '20%',
        },
        {
          name: 'This month',
          type: 'bar' as const,
          data: weekly.map((w) => w.current),
          itemStyle: { color: '#14B87A', borderRadius: [3, 3, 0, 0] },
        },
      ],
    }),
    [weekly],
  );

  const districtChartOption = useMemo(
    () => ({
      grid: { left: 0, right: 0, top: 20, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: districts.map((d) =>
          d.district.length > 8 ? `${d.district.slice(0, 7)}.` : d.district,
        ),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
      },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'bar' as const,
          data: districts.map((d, i) => ({
            value: d.count,
            itemStyle: {
              color:
                i < 2 ? '#14B87A' : i < 4 ? '#5DCAA5' : '#9FE1CB',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 9,
            color: '#475569',
          },
        },
      ],
    }),
    [districts],
  );

  const lineChartOption = useMemo(
    () => ({
      grid: { left: 32, right: 8, top: 8, bottom: 24 },
      xAxis: {
        type: 'category' as const,
        data: responseTrend.map((r) => r.month),
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
      },
      yAxis: {
        type: 'value' as const,
        min: 6,
        max: 14,
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
      },
      series: [
        {
          type: 'line' as const,
          data: responseTrend.map((r) => r.minutes),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#14B87A', width: 2 },
          itemStyle: { color: '#14B87A' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(20,184,122,0.15)' },
                { offset: 1, color: 'rgba(20,184,122,0)' },
              ],
            },
          },
        },
      ],
    }),
    [responseTrend],
  );

  const donutChartOption = useMemo(
    () => ({
      series: [
        {
          type: 'pie' as const,
          radius: ['55%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          data: jobTypes.map((j) => ({
            name: j.label,
            value: j.value,
            itemStyle: { color: j.color },
          })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '42%',
          style: {
            text: String(summary?.totalAssignments ?? 218),
            fontSize: 11,
            fontWeight: 700,
            fill: '#0F172A',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '52%',
          style: {
            text: 'total',
            fontSize: 8,
            fill: '#64748B',
          },
        },
      ],
    }),
    [jobTypes, summary],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Analytics">
        <TopbarButton>
          <Calendar className="w-3 h-3" /> May 2026
        </TopbarButton>
        <TopbarButton>
          <Filter className="w-3 h-3" /> Filters
        </TopbarButton>
        <TopbarButton primary>
          <Download className="w-3 h-3" /> Export report
        </TopbarButton>
      </PageTopbar>

      <div className="p-4 space-y-3">
        {summary && (
          <div className="grid grid-cols-4 gap-2.5">
            <MetricCard
              icon={<Briefcase className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={String(summary.totalAssignments)}
              label="Total assignments · May"
              change={`+${summary.totalAssignmentsChangePct}% vs April`}
            />
            <MetricCard
              icon={<Clock className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              value={`${summary.avgResponseMinutes} min`}
              label="Avg response time"
              change={summary.avgResponseChangeLabel}
              invertedTrend
            />
            <MetricCard
              icon={<CheckCircle2 className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={`${summary.completionRatePct}%`}
              label="Completion rate"
              change={`+${summary.completionRateChangePct}% vs April`}
            />
            <MetricCard
              icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
              iconBg="bg-red-100"
              value={String(summary.incidents)}
              label="Incidents reported"
              change={`+${summary.incidentsChange} vs April`}
              positive={false}
            />
          </div>
        )}

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3">
            <ContentCard title="Assignments per week — May 2026">
              {weekly.length > 0 && (
                <ReactECharts
                  option={weeklyChartOption}
                  style={{ height: 130 }}
                />
              )}
              <div className="flex justify-between mt-2 text-[10px]">
                <div className="flex gap-3 text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#14B87A]" /> This
                    month
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-slate-200" /> Last
                    month
                  </span>
                </div>
                <span className="text-green-600 font-medium">+12% vs April</span>
              </div>
            </ContentCard>
          </div>
          <div className="col-span-2">
            <ContentCard title="Job type breakdown">
              <div className="flex items-center gap-4">
                <ReactECharts
                  option={donutChartOption}
                  style={{ width: 100, height: 100 }}
                />
                <div className="flex flex-col gap-1.5 flex-1">
                  {jobTypes.map((j) => (
                    <div
                      key={j.label}
                      className="flex items-center gap-2 text-[11px] text-slate-600"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: j.color }}
                      />
                      {j.label} ({j.value}%)
                    </div>
                  ))}
                </div>
              </div>
            </ContentCard>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ContentCard title="Assignments by district — May 2026">
            {districts.length > 0 && (
              <ReactECharts
                option={districtChartOption}
                style={{ height: 120 }}
              />
            )}
          </ContentCard>
          <ContentCard title="Avg response time trend (min)">
            {responseTrend.length > 0 && (
              <ReactECharts option={lineChartOption} style={{ height: 120 }} />
            )}
          </ContentCard>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <ContentCard
              title="Guardian performance — May 2026"
              action={
                <button
                  type="button"
                  className="text-[11px] text-[#14B87A] hover:underline"
                >
                  View all
                </button>
              }
            >
              <div className="overflow-x-auto -mx-3.5">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {[
                        'Guardian',
                        'Jobs',
                        'Response',
                        'Reliability',
                        'Incidents',
                        'Earnings',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guardians.map((g) => (
                      <tr
                        key={g.id}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold ${g.avatarClass}`}
                            >
                              {g.initials}
                            </div>
                            <span className="text-xs font-medium text-slate-900">
                              {g.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold">
                          {g.jobs}
                        </td>
                        <td
                          className={`px-3 py-2 text-xs ${g.responseClass}`}
                        >
                          {g.response}
                        </td>
                        <td className="px-3 py-2">
                          <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden mb-0.5">
                            <div
                              className="h-full bg-[#14B87A] rounded-full"
                              style={{ width: `${g.reliabilityPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {g.rating}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 text-xs ${g.incidentsClass}`}
                        >
                          {g.incidents}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-green-600">
                          {g.earnings}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ContentCard>
          </div>
          <ContentCard title="Export reports">
            <div className="flex flex-col gap-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center ${r.iconBg}`}
                    >
                      <FileText className={`w-3.5 h-3.5 ${r.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-900">
                        {r.title}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {r.format} · {r.period}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-600 bg-white border border-slate-200 rounded-md"
                  >
                    {r.format === 'CSV' ? (
                      <Sheet className="w-3 h-3" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}{' '}
                    {r.format}
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
