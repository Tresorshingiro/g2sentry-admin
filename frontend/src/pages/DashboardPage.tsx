import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Shield,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { StatCard } from '@/components/shared/StatCard';
import {
  fetchActivity,
  fetchDashboardStats,
  fetchDistrictStats,
  fetchWeeklyStats,
} from '@/services/api';
import type {
  ActivityItem,
  DashboardStats,
  DistrictStat,
  WeeklyJobStat,
} from '@/types/job';
import { formatRWF } from '@/lib/utils';

export function DashboardPage() {
  const navigate = useNavigate();

  const [stats,      setStats]      = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [weekly,     setWeekly]     = useState<WeeklyJobStat[]>([]);
  const [activity,   setActivity]   = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [districts,  setDistricts]  = useState<DistrictStat[]>([]);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch((err: unknown) => {
        setStatsError(err instanceof Error ? err.message : 'Failed to load stats');
      })
      .finally(() => setStatsLoading(false));

    void fetchWeeklyStats().then(setWeekly);

    setActivityLoading(true);
    void fetchActivity()
      .then(setActivity)
      .finally(() => setActivityLoading(false));

    void fetchDistrictStats().then(setDistricts);
  }, []);

  const maxDistrict = Math.max(...districts.map((d) => d.count), 1);
  const totalJobs   = weekly.reduce((s, w) => s + w.count, 0);

  const chartOption = {
    grid: { left: 0, right: 0, top: 20, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: weekly.map((s) => s.day),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
    },
    yAxis: { type: 'value' as const, show: false },
    series: [
      {
        type: 'bar' as const,
        data: weekly.map((s) => ({
          value: s.count,
          itemStyle: {
            color: s.isToday ? '#15803d' : '#bbf7d0',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        label: { show: true, position: 'top' as const, color: '#374151', fontSize: 11 },
      },
    ],
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* Date */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Error */}
        {statsError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {statsError}
          </div>
        )}

        {/* Stat cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Briefcase className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              label="Total jobs"
              value={String(stats.jobCount)}
              delta=""
              deltaPositive
              deltaLabel=""
            />
            <StatCard
              icon={<Shield className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              label="Active guardians"
              value={String(stats.activeGuardians)}
              delta=""
              deltaPositive
              deltaLabel=""
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-orange-500" />}
              iconBg="bg-orange-50"
              label="Pending verifications"
              value={String(stats.pendingOrgVerifications + stats.pendingGuardianVerifications)}
              delta=""
              deltaPositive={stats.pendingOrgVerifications + stats.pendingGuardianVerifications === 0}
              deltaLabel={
                stats.pendingOrgVerifications + stats.pendingGuardianVerifications > 0
                  ? `${stats.pendingOrgVerifications} orgs · ${stats.pendingGuardianVerifications} guardians`
                  : 'All clear'
              }
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5 text-blue-500" />}
              iconBg="bg-blue-50"
              label="Total revenue"
              value={Number.isNaN(Number(stats.totalRevenue)) ? '—' : formatRWF(Number(stats.totalRevenue))}
              delta=""
              deltaPositive
              deltaLabel=""
            />
          </div>
        ) : null}

        {/* Weekly chart + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Assignments this week</h3>
              <button
                type="button"
                onClick={() => navigate('/assignments')}
                className="text-green-600 text-sm hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {weekly.length > 0 ? (
              <>
                <ReactECharts option={chartOption} style={{ height: 180 }} />
                <div className="flex items-center justify-between mt-3 text-sm flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-green-700" />
                      <span className="text-gray-500">Today</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-green-100" />
                      <span className="text-gray-500">Other days</span>
                    </div>
                  </div>
                  <span className="text-gray-500">Total this week: {totalJobs} jobs</span>
                </div>
              </>
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center gap-2">
                <Briefcase className="w-8 h-8 text-slate-200" />
                <p className="text-sm text-slate-400">No job data yet for this week</p>
                <p className="text-xs text-slate-300">Analytics populate once the daily aggregation runs</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Recent activity</h3>
            {activityLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-100 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-slate-100 rounded animate-pulse w-4/5" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length > 0 ? (
              <ActivityFeed items={activity} />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <AlertTriangle className="w-6 h-6 text-slate-200" />
                <p className="text-sm text-slate-400">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* District density */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">Job density by district</h3>
              <p className="text-xs text-gray-400 mt-0.5">Cumulative jobs per district · all time</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="flex items-center gap-1.5 text-green-600 text-sm hover:underline cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" /> Live map
            </button>
          </div>

          {districts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {districts.map((d) => (
                <div key={d.district} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-gray-700 shrink-0 truncate">{d.district}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(d.count / maxDistrict) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-sm text-gray-700 text-right tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <MapPin className="w-7 h-7 text-slate-200" />
              <p className="text-sm text-slate-400">No district data yet</p>
              <p className="text-xs text-slate-300">Populates once the analytics aggregation runs</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
