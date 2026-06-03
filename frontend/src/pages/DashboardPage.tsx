import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { StatCard } from '@/components/shared/StatCard';
import {
  fetchActivity,
  fetchDashboardStats,
  fetchDashboardJobMetrics,
  fetchDistrictStats,
  fetchGuardianAvailability,
  fetchLiveJobCounts,
  fetchTotalClients,
  fetchWeeklyStats,
} from '@/services/api';
import type {
  ActivityItem,
  DashboardStats,
  DistrictStat,
  WeeklyJobStat,
} from '@/types/job';
import { cn, formatRWF } from '@/lib/utils';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

export function DashboardPage() {
  const navigate = useNavigate();

  const [stats,           setStats]           = useState<DashboardStats | null>(null);
  const [statsLoading,    setStatsLoading]    = useState(true);
  const [statsError,      setStatsError]      = useState<string | null>(null);
  const [weekly,          setWeekly]          = useState<WeeklyJobStat[]>([]);
  const [activity,        setActivity]        = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [districts,       setDistricts]       = useState<DistrictStat[]>([]);
  const [jobMetrics,      setJobMetrics]      = useState<{ completionRatePct: number; avgResponseMinutes: number } | null>(null);
  const [guardianAvail,   setGuardianAvail]   = useState<{ available: number; onDuty: number; offline: number } | null>(null);
  const [liveJobs,        setLiveJobs]        = useState<{ inProgress: number; dispatching: number; pending: number } | null>(null);
  const [totalClients,    setTotalClients]    = useState<number | null>(null);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err: unknown) => setStatsError(err instanceof Error ? err.message : 'Failed to load stats'))
      .finally(() => setStatsLoading(false));

    void fetchWeeklyStats().then(setWeekly);
    void fetchDashboardJobMetrics().then(setJobMetrics).catch(() => {});
    void fetchGuardianAvailability().then(setGuardianAvail).catch(() => {});
    void fetchLiveJobCounts().then(setLiveJobs).catch(() => {});
    void fetchTotalClients().then(setTotalClients).catch(() => {});

    setActivityLoading(true);
    void fetchActivity().then(setActivity).finally(() => setActivityLoading(false));
    void fetchDistrictStats().then(setDistricts);
  }, []);

  const maxDistrict  = Math.max(...districts.map((d) => d.count), 1);
  const totalJobs    = weekly.reduce((s, w) => s + w.count, 0);
  const pendingTotal = stats ? stats.pendingOrgVerifications + stats.pendingGuardianVerifications : 0;

  const chartOption = {
    grid: { left: 0, right: 0, top: 24, bottom: 0, containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#0F172A',
      borderColor: '#1E293B',
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      formatter: (params: { seriesName: string; value: number }[]) =>
        params.map(p => `${p.seriesName}: ${p.value}`).join('<br/>'),
    },
    xAxis: {
      type: 'category' as const,
      data: weekly.map((s) => s.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94A3B8', fontSize: 10, fontFamily: IBM },
    },
    yAxis: { type: 'value' as const, show: false },
    series: [
      {
        name: 'Completed',
        type: 'bar' as const,
        stack: 'total',
        data: weekly.map((s) => ({
          value: s.completedCount,
          itemStyle: { color: s.isToday ? '#0f9e63' : '#14B87A' },
        })),
      },
      {
        name: 'Other',
        type: 'bar' as const,
        stack: 'total',
        data: weekly.map((s) => ({
          value: s.count - s.completedCount,
          itemStyle: {
            color: s.isToday ? '#5DCAA5' : '#BBF7D0',
            borderRadius: [2, 2, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top' as const,
          color: '#475569',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          formatter: (_: unknown, dataIndex: number) => String(weekly[dataIndex]?.count ?? ''),
        },
      },
    ],
  };

  return (
    <div
      className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]"
      style={{ fontFamily: IBM }}
    >
      <div className="p-4 sm:p-5 space-y-3">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Operations Center · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded px-3 py-1.5">
              <Calendar className="w-3 h-3" />
              <span className="font-mono">
                {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <MapPin className="w-3 h-3" /> Live Map
            </button>
            <button
              type="button"
              onClick={() => navigate('/guardians/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Register Guardian
            </button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────────────── */}
        {statsError && (
          <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
            {statsError}
          </div>
        )}

        {/* ── Pending verifications banner ────────────────────────────────────── */}
        {!statsLoading && pendingTotal > 0 && (
          <button
            type="button"
            onClick={() => navigate('/verifications')}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 border-l-[3px] border-l-amber-400 rounded text-left hover:bg-amber-100 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900">
                  {pendingTotal} pending verification{pendingTotal > 1 ? 's' : ''} require your attention
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  {stats!.pendingOrgVerifications > 0 && `${stats!.pendingOrgVerifications} org${stats!.pendingOrgVerifications > 1 ? 's' : ''}`}
                  {stats!.pendingOrgVerifications > 0 && stats!.pendingGuardianVerifications > 0 && ' · '}
                  {stats!.pendingGuardianVerifications > 0 && `${stats!.pendingGuardianVerifications} guardian${stats!.pendingGuardianVerifications > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] font-bold text-amber-700 group-hover:text-amber-900 shrink-0 uppercase tracking-widest">
              Review →
            </span>
          </button>
        )}

        {/* ── Stat cards ─────────────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <StatCard
              label="Total jobs"
              value={String(stats.jobCount)}
              accentColor="border-t-[#14B87A]"
              delta="" deltaPositive deltaLabel=""
            />
            <StatCard
              label="Active guardians"
              value={String(stats.activeGuardians)}
              accentColor="border-t-[#14B87A]"
              delta="" deltaPositive deltaLabel=""
            />
            <StatCard
              label="Total clients"
              value={totalClients !== null ? String(totalClients) : '—'}
              accentColor="border-t-blue-500"
              delta="" deltaPositive deltaLabel=""
            />
            <StatCard
              label="Total revenue"
              value={Number.isNaN(Number(stats.totalRevenue)) ? '—' : formatRWF(Number(stats.totalRevenue))}
              accentColor="border-t-violet-500"
              delta="" deltaPositive deltaLabel=""
            />
            <StatCard
              label="Completion rate"
              value={jobMetrics ? `${jobMetrics.completionRatePct}%` : '—'}
              accentColor="border-t-emerald-500"
              delta="" deltaPositive deltaLabel="Last 7 days"
            />
            <StatCard
              label="Pending verifications"
              value={String(pendingTotal)}
              accentColor={pendingTotal > 0 ? 'border-t-amber-400' : 'border-t-slate-300'}
              delta="" deltaPositive={pendingTotal === 0}
              deltaLabel={pendingTotal > 0 ? 'Needs review' : 'All clear'}
              onClick={() => navigate('/verifications')}
            />
          </div>
        ) : null}

        {/* ── Live operations ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 border-t-[3px] border-t-[#14B87A] rounded px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14B87A] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#14B87A]" />
              </span>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Operations</p>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Guardians */}
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Guardians</p>
              <div className="flex items-center gap-5 flex-wrap">
                {[
                  { label: 'Available', value: guardianAvail?.available, dot: 'bg-[#14B87A]' },
                  { label: 'On Duty',   value: guardianAvail?.onDuty,    dot: 'bg-blue-500' },
                  { label: 'Offline',   value: guardianAvail?.offline,   dot: 'bg-slate-300' },
                ].map(({ label, value, dot }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">{value ?? '—'}</span>
                    <span className="text-[10px] text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Jobs */}
            <div className="sm:border-l sm:border-slate-100 sm:pl-5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Jobs</p>
              <div className="flex items-center gap-5 flex-wrap">
                {[
                  { label: 'In Progress',  value: liveJobs?.inProgress,  dot: 'bg-blue-500' },
                  { label: 'Dispatching',  value: liveJobs?.dispatching, dot: 'bg-amber-400' },
                  { label: 'Pending',      value: liveJobs?.pending,     dot: 'bg-slate-300' },
                ].map(({ label, value, dot }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                    <span className="font-mono text-base font-bold text-slate-900 tabular-nums">{value ?? '—'}</span>
                    <span className="text-[10px] text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Weekly chart + Activity ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

          {/* Chart */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weekly performance</p>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">Assignments this week</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/assignments')}
                className="text-[10px] font-bold text-[#14B87A] hover:text-[#12a56d] transition-colors cursor-pointer uppercase tracking-widest"
              >
                View all →
              </button>
            </div>

            {weekly.length > 0 ? (
              <>
                <ReactECharts option={chartOption} style={{ height: 160 }} />
                <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#14B87A] inline-block shrink-0" />
                      Completed
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-sm bg-green-100 inline-block shrink-0" />
                      Other
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">
                    Total: <span className="font-bold text-slate-700">{totalJobs}</span> jobs
                  </span>
                </div>
              </>
            ) : (
              <div className="h-[160px] flex flex-col items-center justify-center gap-2">
                <Briefcase className="w-7 h-7 text-slate-200" />
                <p className="text-[11px] text-slate-400">No job data yet for this week</p>
                <p className="text-[10px] text-slate-300">Populates once the daily aggregation runs</p>
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-5">
            <div className="mb-4">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Audit stream</p>
              <p className="text-xs font-semibold text-slate-900 mt-0.5">Recent activity</p>
            </div>
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-100 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-4/5" />
                      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length > 0 ? (
              <ActivityFeed items={activity} />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-200" />
                <p className="text-[11px] text-slate-400">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* ── District density ───────────────────────────────────────────────── */}
        {districts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Geographic distribution</p>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">Job density by district · all time</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/map')}
                className="flex items-center gap-1.5 text-[10px] font-bold text-[#14B87A] hover:text-[#12a56d] transition-colors cursor-pointer uppercase tracking-widest"
              >
                <MapPin className="w-3 h-3" /> Live map
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {districts.map((d) => (
                <div key={d.district} className="flex items-center gap-3">
                  <span className="w-28 text-[11px] font-medium text-slate-700 shrink-0 truncate">{d.district}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#14B87A] rounded-sm transition-all"
                      style={{ width: `${(d.count / maxDistrict) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono w-8 text-[11px] font-bold text-slate-700 text-right tabular-nums">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
