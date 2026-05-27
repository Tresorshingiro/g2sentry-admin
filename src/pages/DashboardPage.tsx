import {
  Bell,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { formatDelta, formatRWF } from '@/lib/utils';

const HOURLY_INTENSITY = [
  0.15, 0.2, 0.1, 0.1, 0.25, 0.45, 0.7, 0.9, 0.85, 0.9, 0.95, 0.85, 0.75,
  0.65, 0.55, 0.45, 0.35, 0.2,
];

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weekly, setWeekly] = useState<WeeklyJobStat[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [districts, setDistricts] = useState<DistrictStat[]>([]);

  useEffect(() => {
    void fetchDashboardStats().then(setStats);
    void fetchWeeklyStats().then(setWeekly);
    void fetchActivity().then(setActivity);
    void fetchDistrictStats().then(setDistricts);
  }, []);

  const maxDistrict = Math.max(...districts.map((d) => d.count), 1);

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
        label: {
          show: true,
          position: 'top' as const,
          color: '#374151',
          fontSize: 11,
        },
      },
    ],
  };

  const totalJobs = weekly.reduce((s, w) => s + w.count, 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 border rounded-md px-3 py-1.5">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <button type="button" className="relative p-1.5 rounded-md hover:bg-gray-100">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <button type="button" className="p-1.5 rounded-md hover:bg-gray-100">
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={<Briefcase className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              label="Active assignments"
              value={String(stats.activeAssignments)}
              delta={formatDelta(stats.activeAssignmentsDelta)}
              deltaPositive={stats.activeAssignmentsDelta >= 0}
              deltaLabel="from yesterday"
            />
            <StatCard
              icon={<Shield className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              label="Guardians on duty"
              value={String(stats.guardiansOnDuty)}
              delta={formatDelta(stats.guardiansOnDutyDelta)}
              deltaPositive={stats.guardiansOnDutyDelta >= 0}
              deltaLabel="from yesterday"
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-orange-500" />}
              iconBg="bg-orange-50"
              label="Pending requests"
              value={String(stats.pendingRequests)}
              delta={formatDelta(stats.pendingRequestsDelta)}
              deltaPositive={stats.pendingRequestsDelta >= 0}
              deltaLabel="from yesterday"
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5 text-blue-500" />}
              iconBg="bg-blue-50"
              label="Revenue today"
              value={formatRWF(stats.revenueToday)}
              delta={formatDelta(stats.revenueTodayDeltaPct, true)}
              deltaPositive={stats.revenueTodayDeltaPct >= 0}
              deltaLabel="vs avg"
            />
          </div>
        )}

        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                Assignments this week
              </h3>
              <button
                type="button"
                className="text-green-600 text-sm hover:underline"
              >
                View all
              </button>
            </div>
            {weekly.length > 0 && (
              <ReactECharts option={chartOption} style={{ height: 180 }} />
            )}
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
              <span className="text-gray-500">Total: {totalJobs} jobs</span>
              <span className="text-green-600 font-medium">+12% vs last week</span>
            </div>
          </div>

          <div className="col-span-2 bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Recent activity</h3>
            <ActivityFeed items={activity} />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">
                Task density by district
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Active jobs per district · today
              </p>
            </div>
            <button
              type="button"
              className="text-green-600 text-sm hover:underline"
            >
              Full map view
            </button>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              {districts.map((d) => (
                <div key={d.district} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-gray-700 shrink-0">
                    {d.district}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(d.count / maxDistrict) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-sm text-gray-700 text-right">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">
                Hourly density — Nyarugenge
              </p>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
              </div>
              <div className="flex gap-0.5">
                {HOURLY_INTENSITY.map((intensity, i) => (
                  <div
                    key={i}
                    className="flex-1 h-6 rounded-sm"
                    style={{
                      backgroundColor: `rgba(34, 197, 94, ${intensity})`,
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>Low</span>
                <div className="flex gap-0.5">
                  {[0.2, 0.4, 0.6, 0.8, 1].map((v, i) => (
                    <div
                      key={i}
                      className="w-4 h-3 rounded-sm"
                      style={{
                        backgroundColor: `rgba(34, 197, 94, ${v})`,
                      }}
                    />
                  ))}
                </div>
                <span>High</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
