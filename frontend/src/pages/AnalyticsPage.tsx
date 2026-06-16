import {
  Banknote, Briefcase, CheckCircle,
  ChevronRight, MapPin, Timer, TrendingDown, TrendingUp, Zap,
} from 'lucide-react';
import type { ElementType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { registerMap } from 'echarts';
import { apiGet } from '@/lib/api-client';
import { fetchJobFactsDaily, fetchGuardianPerfDaily } from '@/services/api/analytics';
import type { RawJobFactsDaily } from '@/services/api/analytics';
import type { DashboardStats } from '@/types/job';
import { cn, formatRWF } from '@/lib/utils';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpisData {
  jobsCreated: number;
  jobsWithAcceptedOffer: number;
  totalOffers: number;
  acceptedOffers: number;
  expiredOffers: number;
  noShowAssignments: number;
  jobsFailed: number;
  dispatchFailuresByReason: { reason: string; count: number }[];
  dispatchConversionRate: number;
  offerAcceptanceRate: number;
  offerExpiryRate: number;
  noShowRate: number;
  dispatchFailureRate: number;
  latencyMinutes: {
    p50TimeToFirstOffer: number; p95TimeToFirstOffer: number;
    p50TimeToAccept: number; p95TimeToAccept: number;
    p50TimeToOnSite: number; p95TimeToOnSite: number;
    p50TimeToComplete: number; p95TimeToComplete: number;
  };
}

interface FullDashStats extends DashboardStats { kpis?: KpisData }

interface RawGuardianPerfDaily {
  date: string;
  guardianId: string;
  jobsAssigned: number;
  jobsCompleted: number;
  noShowCount: number;
  completionRate: string | number;
  avgResponseMinutes: string | number | null;
  avgRating: string | number | null;
}

type ViewPeriod = '7d' | '30d' | '90d';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

function filterFacts(facts: RawJobFactsDaily[], from: string, to: string) {
  return facts.filter(r => r.date >= from && r.date <= to);
}
function sumRev(facts: RawJobFactsDaily[]) {
  return facts.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
}
function sumJobs(facts: RawJobFactsDaily[]) { return facts.reduce((s, r) => s + r.jobCount, 0); }
function sumCompleted(facts: RawJobFactsDaily[]) { return facts.reduce((s, r) => s + r.completedCount, 0); }
function rollingAvg(data: number[], win: number): number[] {
  return data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - win + 1), i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length * 10) / 10;
  });
}

// ─── Period comparison ────────────────────────────────────────────────────────

// Local-time date formatting — toISOString() would shift the day in UTC+ timezones
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type CmpKey =
  | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter' | 'last30' | 'prior30' | 'thisYear' | 'custom';

const CMP_PRESETS: { key: CmpKey; label: string }[] = [
  { key: 'thisWeek',    label: 'This week' },
  { key: 'lastWeek',    label: 'Last week' },
  { key: 'thisMonth',   label: 'This month' },
  { key: 'lastMonth',   label: 'Last month' },
  { key: 'thisQuarter', label: 'This quarter' },
  { key: 'lastQuarter', label: 'Last quarter' },
  { key: 'last30',      label: 'Last 30 days' },
  { key: 'prior30',     label: 'Prior 30 days' },
  { key: 'thisYear',    label: 'Year to date' },
  { key: 'custom',      label: 'Custom range' },
];

function cmpRange(key: CmpKey, customFrom: string, customTo: string): { from: string; to: string; label: string } {
  const now   = new Date();
  const today = fmtDate(now);
  const shift = (base: Date, days: number) => { const d = new Date(base); d.setDate(d.getDate() + days); return d; };
  switch (key) {
    case 'thisWeek': {
      const start = shift(now, -now.getDay());
      return { from: fmtDate(start), to: today, label: 'This week' };
    }
    case 'lastWeek': {
      const end   = shift(now, -now.getDay() - 1);
      const start = shift(end, -6);
      return { from: fmtDate(start), to: fmtDate(end), label: 'Last week' };
    }
    case 'thisMonth':
      return { from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, label: 'This month' };
    case 'lastMonth':
      return {
        from: fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to:   fmtDate(new Date(now.getFullYear(), now.getMonth(), 0)),
        label: 'Last month',
      };
    case 'thisQuarter': {
      const q = Math.floor(now.getMonth() / 3);
      return { from: fmtDate(new Date(now.getFullYear(), q * 3, 1)), to: today, label: 'This quarter' };
    }
    case 'lastQuarter': {
      const q = Math.floor(now.getMonth() / 3);
      return {
        from: fmtDate(new Date(now.getFullYear(), q * 3 - 3, 1)),
        to:   fmtDate(new Date(now.getFullYear(), q * 3, 0)),
        label: 'Last quarter',
      };
    }
    case 'last30':
      return { from: fmtDate(shift(now, -29)), to: today, label: 'Last 30 days' };
    case 'prior30':
      return { from: fmtDate(shift(now, -59)), to: fmtDate(shift(now, -30)), label: 'Prior 30 days' };
    case 'thisYear':
      return { from: `${now.getFullYear()}-01-01`, to: today, label: 'Year to date' };
    case 'custom':
      if (customFrom && customTo && customFrom <= customTo) {
        return { from: customFrom, to: customTo, label: `${customFrom} – ${customTo}` };
      }
      return { from: today, to: today, label: 'Custom' };
  }
}

interface PeriodSummary {
  revenue: number; jobs: number; completed: number; cancelled: number;
  completionRate: number; avgJobValue: number; avgResponse: number | null;
  activeGuardians: number; noShows: number;
}

function summarizePeriod(
  jobFacts: RawJobFactsDaily[],
  gPerf: RawGuardianPerfDaily[],
  from: string,
  to: string,
): PeriodSummary {
  const f = filterFacts(jobFacts, from, to);
  const g = gPerf.filter(r => r.date >= from && r.date <= to);
  const revenue   = sumRev(f);
  const jobs      = sumJobs(f);
  const completed = sumCompleted(f);
  const cancelled = f.reduce((s, r) => s + r.cancelledCount, 0);
  let respSum = 0, respJobs = 0;
  for (const r of f) {
    if (r.avgResponseMinutes != null && r.jobCount > 0) {
      respSum  += Number(r.avgResponseMinutes) * r.jobCount;
      respJobs += r.jobCount;
    }
  }
  return {
    revenue, jobs, completed, cancelled,
    completionRate:  jobs > 0 ? (completed / jobs) * 100 : 0,
    avgJobValue:     jobs > 0 ? revenue / jobs : 0,
    avgResponse:     respJobs > 0 ? respSum / respJobs : null,
    activeGuardians: new Set(g.filter(r => r.jobsAssigned > 0).map(r => r.guardianId)).size,
    noShows:         g.reduce((s, r) => s + r.noShowCount, 0),
  };
}

const CMP_ROWS: { key: keyof PeriodSummary; label: string; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
  { key: 'revenue',         label: 'Revenue',            fmt: v => formatRWF(v) },
  { key: 'jobs',            label: 'Jobs created',       fmt: v => String(Math.round(v)) },
  { key: 'completed',       label: 'Jobs completed',     fmt: v => String(Math.round(v)) },
  { key: 'completionRate',  label: 'Completion rate',    fmt: v => `${v.toFixed(1)}%` },
  { key: 'cancelled',       label: 'Jobs cancelled',     fmt: v => String(Math.round(v)), lowerIsBetter: true },
  { key: 'avgJobValue',     label: 'Avg job value',      fmt: v => formatRWF(v) },
  { key: 'avgResponse',     label: 'Avg response time',  fmt: v => `${Math.round(v)} min`, lowerIsBetter: true },
  { key: 'activeGuardians', label: 'Active guardians',   fmt: v => String(Math.round(v)) },
  { key: 'noShows',         label: 'Guardian no-shows',  fmt: v => String(Math.round(v)), lowerIsBetter: true },
];

const TT = {
  backgroundColor: '#0F172A', borderColor: '#1E293B',
  padding: [8, 12] as [number, number],
  textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: IBM },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skel({ className }: { className?: string }) {
  return <div className={cn('bg-slate-100 animate-pulse rounded', className)} />;
}

interface SectionProps {
  icon: ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

function Section({ icon: Icon, iconBg, iconColor, title, subtitle, action, onAction, children }: SectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border', iconBg)}>
            <Icon className={cn('w-4 h-4', iconColor)} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {action && onAction && (
          <button type="button" onClick={onAction}
            className="flex items-center gap-1 text-xs font-semibold text-[#14B87A] hover:text-[#12a56d] transition-colors cursor-pointer">
            {action} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ElementType;
  iconBg: string;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, trend, loading }: KpiCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          {loading
            ? <Skel className="h-7 w-20 mt-2" />
            : <p className="font-mono text-[22px] font-bold text-slate-900 mt-1.5 tabular-nums leading-none">{value}</p>
          }
          {sub && !loading && (
            <p className={cn(
              'text-xs mt-2 font-medium flex items-center gap-1',
              trend === 'up' ? 'text-[#14B87A]' : trend === 'down' ? 'text-red-500' : 'text-slate-400',
            )}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {sub}
            </p>
          )}
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
      </div>
    </div>
  );
}

// ─── Funnel bar ───────────────────────────────────────────────────────────────

function FunnelRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-slate-500 w-40 shrink-0 truncate">{label}</p>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs font-semibold text-slate-700 w-14 text-right tabular-nums">{value}</span>
      <span className="font-mono text-[11px] text-slate-400 w-10 text-right tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [period, setPeriod] = useState<ViewPeriod>('30d');

  const [jobFacts, setJobFacts] = useState<RawJobFactsDaily[]>([]);
  const [gPerf, setGPerf]       = useState<RawGuardianPerfDaily[]>([]);
  const [kpis, setKpis]         = useState<KpisData | null>(null);
  const [loading, setLoading]   = useState(true);

  // District map
  const [geoNames, setGeoNames]   = useState<string[]>([]);
  const [mapMetric, setMapMetric] = useState<'revenue' | 'jobs'>('revenue');

  // Period comparison
  const [cmpA, setCmpA]         = useState<CmpKey>('thisMonth');
  const [cmpB, setCmpB]         = useState<CmpKey>('lastMonth');
  const [cmpAFrom, setCmpAFrom] = useState('');
  const [cmpATo, setCmpATo]     = useState('');
  const [cmpBFrom, setCmpBFrom] = useState('');
  const [cmpBTo, setCmpBTo]     = useState('');

  useEffect(() => {
    Promise.all([
      fetchJobFactsDaily().catch(() => [] as RawJobFactsDaily[]),
      fetchGuardianPerfDaily().catch(() => [] as RawGuardianPerfDaily[]),
      apiGet<FullDashStats>('/admin/analytics/dashboard').catch(() => null),
    ]).then(([jf, gp, dash]) => {
      setJobFacts(Array.isArray(jf) ? jf : []);
      setGPerf(Array.isArray(gp) ? gp : []);
      if (dash?.kpis) setKpis(dash.kpis);
    }).finally(() => setLoading(false));
  }, []);

  // Load Rwanda district boundaries (geoBoundaries ADM2, CC BY 4.0) and register the ECharts map
  useEffect(() => {
    let cancelled = false;
    fetch('/rwanda-districts.geojson')
      .then(r => r.json())
      .then((gj: { features: { properties: { shapeName: string } }[] }) => {
        if (cancelled) return;
        registerMap('rwanda-districts', gj as unknown as Parameters<typeof registerMap>[1]);
        setGeoNames(gj.features.map(f => f.properties.shapeName));
      })
      .catch(() => { /* map card shows a fallback message */ });
    return () => { cancelled = true; };
  }, []);

  // ── Period filtering ─────────────────────────────────────────────────────
  const today   = todayStr();
  const fromDate = period === '7d' ? daysAgo(7) : period === '30d' ? daysAgo(30) : daysAgo(90);
  const prevFrom = period === '7d' ? daysAgo(14) : period === '30d' ? daysAgo(60) : daysAgo(180);
  const prevTo   = period === '7d' ? daysAgo(7)  : period === '30d' ? daysAgo(30) : daysAgo(90);

  const facts     = useMemo(() => filterFacts(jobFacts, fromDate, today), [jobFacts, fromDate, today]);
  const prevFacts = useMemo(() => filterFacts(jobFacts, prevFrom, prevTo), [jobFacts, prevFrom, prevTo]);

  const revenue     = sumRev(facts);
  const prevRevenue = sumRev(prevFacts);
  const jobs        = sumJobs(facts);
  const prevJobs    = sumJobs(prevFacts);
  const completed   = sumCompleted(facts);
  const completionRate = jobs > 0 ? Math.round((completed / jobs) * 100) : 0;

  const avgResponse = useMemo(() => {
    const withResp = facts.filter(r => r.avgResponseMinutes != null);
    if (!withResp.length) return null;
    return Math.round(withResp.reduce((s, r) => s + Number(r.avgResponseMinutes), 0) / withResp.length);
  }, [facts]);

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  // ── Chart options ─────────────────────────────────────────────────────────

  const revTrendOption = useMemo(() => {
    const days = Array.from({ length: periodDays }, (_, i) => daysAgo(periodDays - 1 - i));
    const byDay = new Map<string, number>();
    for (const r of facts) byDay.set(r.date, (byDay.get(r.date) ?? 0) + Number(r.totalRevenue ?? 0));
    const vals = days.map(d => Math.round((byDay.get(d) ?? 0) / 1000));
    const ma7  = rollingAvg(vals, 7);
    const labels = days.map(d => { const [, m, day] = d.split('-'); return `${day}/${m}`; });
    const interval = periodDays <= 7 ? 0 : periodDays <= 30 ? 4 : 9;
    return {
      grid: { left: 0, right: 0, top: 30, bottom: 0, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { value: number; seriesName: string }[]) => p.map(x => `${x.seriesName}: RWF ${x.value}k`).join('<br/>') },
      legend: { top: 0, data: ['Revenue', '7-day avg'], textStyle: { color: '#94A3B8', fontSize: 10, fontFamily: IBM }, itemHeight: 8, itemWidth: 12 },
      xAxis: { type: 'category' as const, data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94A3B8', fontSize: 9, fontFamily: IBM, interval } },
      yAxis: { type: 'value' as const, show: false },
      series: [
        { name: 'Revenue', type: 'bar' as const, barMaxWidth: 16, itemStyle: { color: '#14B87A', borderRadius: [2, 2, 0, 0] }, data: vals },
        { name: '7-day avg', type: 'line' as const, smooth: true, lineStyle: { color: '#F59E0B', width: 2 }, itemStyle: { color: '#F59E0B' }, symbol: 'none', data: ma7 },
      ],
    };
  }, [facts, periodDays]);

  const districtOption = useMemo(() => {
    const distMap = new Map<string, number>();
    for (const r of facts) {
      if (r.district) distMap.set(r.district, (distMap.get(r.district) ?? 0) + Number(r.totalRevenue ?? 0));
    }
    const sorted = Array.from(distMap.entries()).sort((a, b) => a[1] - b[1]).slice(-8);
    if (!sorted.length) return null;
    return {
      grid: { left: 10, right: 60, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { name: string; value: number }[]) => `${p[0].name}: ${formatRWF(p[0].value * 1000)}` },
      xAxis: { type: 'value' as const, show: false },
      yAxis: { type: 'category' as const, data: sorted.map(([d]) => d), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748B', fontSize: 11, fontFamily: IBM } },
      series: [{ type: 'bar' as const, barMaxWidth: 20, itemStyle: { color: '#14B87A', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right' as const, color: '#475569', fontSize: 10, formatter: (p: { value: number }) => `${p.value}k` }, data: sorted.map(([, v]) => Math.round(v / 1000)) }],
    };
  }, [facts]);

  // ── District map + table ─────────────────────────────────────────────────
  const districtStats = useMemo(() => {
    const m = new Map<string, { revenue: number; jobs: number; completed: number }>();
    for (const r of facts) {
      if (!r.district) continue;
      const p = m.get(r.district) ?? { revenue: 0, jobs: 0, completed: 0 };
      p.revenue   += Number(r.totalRevenue ?? 0);
      p.jobs      += r.jobCount;
      p.completed += r.completedCount;
      m.set(r.district, p);
    }
    return m;
  }, [facts]);

  const districtTable = useMemo(() =>
    Array.from(districtStats.entries())
      .map(([district, s]) => ({ district, ...s, avgValue: s.jobs > 0 ? s.revenue / s.jobs : 0 }))
      .sort((a, b) => (mapMetric === 'revenue' ? b.revenue - a.revenue : b.jobs - a.jobs)),
  [districtStats, mapMetric]);

  const mapOption = useMemo(() => {
    if (!geoNames.length) return null;
    const geoByLower = new Map(geoNames.map(n => [n.toLowerCase(), n]));
    const byGeoName  = new Map<string, { revenue: number; jobs: number }>();
    for (const [district, s] of districtStats) {
      const geoName = geoByLower.get(district.trim().toLowerCase());
      if (geoName) byGeoName.set(geoName, { revenue: s.revenue, jobs: s.jobs });
    }
    const data   = Array.from(byGeoName.entries()).map(([name, s]) => ({ name, value: mapMetric === 'revenue' ? Math.round(s.revenue) : s.jobs }));
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return {
      tooltip: {
        ...TT,
        formatter: (p: { name: string }) => {
          const s = byGeoName.get(p.name);
          if (!s) return `${p.name}: no activity`;
          return `<b>${p.name}</b><br/>Revenue: ${formatRWF(s.revenue)}<br/>Jobs: ${s.jobs}`;
        },
      },
      visualMap: {
        min: 0, max: maxVal, left: 0, bottom: 0,
        itemWidth: 10, itemHeight: 80, text: ['High', 'Low'],
        textStyle: { color: '#94A3B8', fontSize: 9, fontFamily: IBM },
        inRange: { color: ['#ECFDF5', '#6EE7B7', '#14B87A', '#047857'] },
      },
      series: [{
        type: 'map' as const,
        map: 'rwanda-districts',
        nameProperty: 'shapeName',
        roam: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 10, color: '#0F172A', fontFamily: IBM, fontWeight: 'bold' as const },
          itemStyle: { areaColor: '#FBBF24' },
        },
        select: { disabled: true },
        itemStyle: { borderColor: '#FFFFFF', borderWidth: 1, areaColor: '#F1F5F9' },
        data,
      }],
    };
  }, [geoNames, districtStats, mapMetric]);

  // ── Period comparison ────────────────────────────────────────────────────
  const cmp = useMemo(() => {
    const ra = cmpRange(cmpA, cmpAFrom, cmpATo);
    const rb = cmpRange(cmpB, cmpBFrom, cmpBTo);
    return {
      ra, rb,
      a: summarizePeriod(jobFacts, gPerf, ra.from, ra.to),
      b: summarizePeriod(jobFacts, gPerf, rb.from, rb.to),
    };
  }, [jobFacts, gPerf, cmpA, cmpB, cmpAFrom, cmpATo, cmpBFrom, cmpBTo]);

  const periodLabel = period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : 'Last 90 days';

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]" style={{ fontFamily: IBM }}>
      <div className="p-5 space-y-6 max-w-[1600px] mx-auto w-full">

        {/* ── Period filter ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Analytics</h1>
            <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-widest">System · Performance Intelligence</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
            {(['7d', '30d', '90d'] as ViewPeriod[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer',
                  period === p
                    ? 'bg-[#14B87A] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                )}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard
            label="Total Revenue" value={loading ? '—' : formatRWF(revenue)} loading={loading}
            icon={Banknote} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
            sub={prevRevenue > 0 ? `${revenue >= prevRevenue ? '+' : ''}${(((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1)}% vs prev period` : undefined}
            trend={revenue >= prevRevenue ? 'up' : 'down'}
          />
          <KpiCard
            label="Total Jobs" value={loading ? '—' : String(jobs)} loading={loading}
            icon={Briefcase} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
            sub={prevJobs > 0 ? `${jobs >= prevJobs ? '+' : ''}${(((jobs - prevJobs) / prevJobs) * 100).toFixed(1)}% vs prev period` : undefined}
            trend={jobs >= prevJobs ? 'up' : 'down'}
          />
          <KpiCard
            label="Completion Rate" value={loading ? '—' : `${completionRate}%`} loading={loading}
            icon={CheckCircle} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
            sub={`${completed} of ${jobs} jobs completed`} trend={completionRate >= 80 ? 'up' : 'down'}
          />
          <KpiCard
            label="Avg Response Time" value={loading ? '—' : avgResponse != null ? `${avgResponse} min` : '—'} loading={loading}
            icon={Timer} iconBg="bg-purple-50 border-purple-100" iconColor="text-purple-500"
            sub="Avg across all jobs in period"
          />
        </div>

        {/* ── Period comparison ── */}
        <Section
          icon={TrendingUp} iconBg="bg-amber-50 border-amber-100" iconColor="text-amber-500"
          title="Period Comparison" subtitle="Any two periods side by side — every key metric with delta"
        >
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Compare</span>
              <select value={cmpA} onChange={e => setCmpA(e.target.value as CmpKey)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer">
                {CMP_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {cmpA === 'custom' && (
                <span className="flex items-center gap-2">
                  <input type="date" value={cmpAFrom} onChange={e => setCmpAFrom(e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer" />
                  <span className="text-slate-300">→</span>
                  <input type="date" value={cmpATo} onChange={e => setCmpATo(e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer" />
                </span>
              )}
              <span className="text-xs font-semibold text-slate-500">with</span>
              <select value={cmpB} onChange={e => setCmpB(e.target.value as CmpKey)}
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer">
                {CMP_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {cmpB === 'custom' && (
                <span className="flex items-center gap-2">
                  <input type="date" value={cmpBFrom} onChange={e => setCmpBFrom(e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer" />
                  <span className="text-slate-300">→</span>
                  <input type="date" value={cmpBTo} onChange={e => setCmpBTo(e.target.value)}
                    className="border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer" />
                </span>
              )}
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metric</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest whitespace-nowrap">{cmp.ra.label}</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{cmp.rb.label}</th>
                  <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Change</th>
                </tr>
              </thead>
              <tbody>
                {CMP_ROWS.map(row => {
                  const va = cmp.a[row.key];
                  const vb = cmp.b[row.key];
                  const diff = va != null && vb != null ? va - vb : null;
                  const pct  = diff != null && vb !== 0 && vb != null ? (diff / vb) * 100 : null;
                  const good = diff == null || diff === 0 ? null : row.lowerIsBetter ? diff < 0 : diff > 0;
                  return (
                    <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 text-xs font-medium text-slate-600">{row.label}</td>
                      <td className="px-5 py-3 font-mono text-xs font-bold text-slate-900 tabular-nums">{va == null ? '—' : row.fmt(va)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 tabular-nums">{vb == null ? '—' : row.fmt(vb)}</td>
                      <td className="px-5 py-3">
                        {diff == null ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : diff === 0 ? (
                          <span className="font-mono text-xs text-slate-400">No change</span>
                        ) : (
                          <span className={cn('inline-flex items-center gap-1 font-mono text-xs font-semibold tabular-nums', good ? 'text-[#14B87A]' : 'text-red-500')}>
                            {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {diff > 0 ? '+' : '-'}{row.fmt(Math.abs(diff))}
                            {pct != null && (
                              <span className="text-slate-400 font-normal">({diff > 0 ? '+' : '-'}{Math.abs(pct).toFixed(1)}%)</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── Revenue & Jobs trend charts ── */}
        <Section
          icon={TrendingUp} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
          title="Revenue Intelligence" subtitle={`Daily revenue trends · ${periodLabel}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-700 mb-0.5">Revenue Trend</p>
              <p className="text-[11px] text-slate-400 mb-3">Daily revenue in RWF (thousands)</p>
              {facts.length > 0
                ? <ReactECharts option={revTrendOption} style={{ height: 180 }} />
                : <div className="h-[180px] flex items-center justify-center text-xs text-slate-400">No revenue data for this period</div>
              }
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-700 mb-0.5">District Revenue Breakdown</p>
              <p className="text-[11px] text-slate-400 mb-3">Top districts by total revenue</p>
              {districtOption
                ? <ReactECharts option={districtOption} style={{ height: 200 }} />
                : <div className="h-[180px] flex items-center justify-center text-xs text-slate-400">No district data for this period</div>
              }
            </div>
          </div>
        </Section>

        {/* ── Geographic distribution ── */}
        <Section
          icon={MapPin} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
          title="Geographic Distribution" subtitle={`Activity across Rwanda's 30 districts · ${periodLabel}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-0.5">Rwanda District Map</p>
                <p className="text-[11px] text-slate-400">Districts shaded by {mapMetric === 'revenue' ? 'total revenue' : 'job volume'} — hover a district for details</p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
                {(['revenue', 'jobs'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setMapMetric(m)}
                    className={cn('px-3 py-1 text-[11px] font-bold rounded transition-all cursor-pointer',
                      mapMetric === m ? 'bg-[#14B87A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                    {m === 'revenue' ? 'Revenue' : 'Jobs'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {mapOption
                ? <ReactECharts option={mapOption} style={{ height: 340 }} notMerge />
                : <div className="h-[340px] flex items-center justify-center text-xs text-slate-400">Loading map…</div>
              }
              <div className="max-h-[340px] overflow-y-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      {['#', 'District', 'Revenue', 'Jobs', 'Avg / Job'].map(h => (
                        <th key={h} className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap bg-slate-50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {districtTable.length > 0 ? districtTable.map((d, i) => (
                      <tr key={d.district} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-800">{d.district}</td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">{formatRWF(d.revenue)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500 tabular-nums">{d.jobs}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500 tabular-nums">{formatRWF(d.avgValue)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-xs text-slate-400">No district activity for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Dispatch Performance ── */}
        {kpis && (
          <Section
            icon={Zap} iconBg="bg-purple-50 border-purple-100" iconColor="text-purple-500"
            title="Dispatch Performance" subtitle="End-to-end dispatch funnel metrics"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Funnel */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-bold text-slate-700 mb-0.5">Dispatch Funnel</p>
                <p className="text-[11px] text-slate-400 mb-4">From job creation to completion</p>
                <div className="space-y-3">
                  <FunnelRow label="Jobs Created"        value={kpis.jobsCreated}            max={kpis.jobsCreated} color="#3B82F6" />
                  <FunnelRow label="Offers Sent"         value={kpis.totalOffers}             max={kpis.jobsCreated} color="#8B5CF6" />
                  <FunnelRow label="Offers Accepted"     value={kpis.acceptedOffers}          max={kpis.jobsCreated} color="#14B87A" />
                  <FunnelRow label="Jobs with Guardian"  value={kpis.jobsWithAcceptedOffer}   max={kpis.jobsCreated} color="#14B87A" />
                  <FunnelRow label="Offers Expired"      value={kpis.expiredOffers}           max={kpis.jobsCreated} color="#F59E0B" />
                  <FunnelRow label="Jobs Failed"         value={kpis.jobsFailed}              max={kpis.jobsCreated} color="#EF4444" />
                </div>
              </div>

              {/* Latency breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-bold text-slate-700 mb-0.5">Latency Breakdown</p>
                <p className="text-[11px] text-slate-400 mb-4">P50 and P95 response times per stage</p>
                <div className="space-y-4">
                  {[
                    { label: 'Time to First Offer', p50: kpis.latencyMinutes.p50TimeToFirstOffer, p95: kpis.latencyMinutes.p95TimeToFirstOffer },
                    { label: 'Time to Accept',       p50: kpis.latencyMinutes.p50TimeToAccept,     p95: kpis.latencyMinutes.p95TimeToAccept },
                    { label: 'Time to On-site',      p50: kpis.latencyMinutes.p50TimeToOnSite,     p95: kpis.latencyMinutes.p95TimeToOnSite },
                    { label: 'Time to Complete',     p50: kpis.latencyMinutes.p50TimeToComplete,   p95: kpis.latencyMinutes.p95TimeToComplete },
                  ].map(({ label, p50, p95 }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-slate-500">{label}</p>
                        <div className="flex gap-3">
                          <span className="text-[11px] font-mono"><span className="text-slate-400">P50 </span><span className="font-semibold text-slate-700">{p50.toFixed(1)}m</span></span>
                          <span className="text-[11px] font-mono"><span className="text-slate-400">P95 </span><span className="font-semibold text-slate-700">{p95.toFixed(1)}m</span></span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                        <div className="h-full bg-[#14B87A]/30 rounded-full" style={{ width: '100%' }} />
                        <div className="h-full bg-[#14B87A] rounded-full absolute top-0 left-0" style={{ width: `${Math.min((p50 / p95) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rate pills */}
                <div className="grid grid-cols-2 gap-2 mt-5">
                  {[
                    { label: 'Conversion Rate',  value: `${(kpis.dispatchConversionRate * 100).toFixed(1)}%`, good: kpis.dispatchConversionRate >= 0.7 },
                    { label: 'Acceptance Rate',  value: `${(kpis.offerAcceptanceRate * 100).toFixed(1)}%`,   good: kpis.offerAcceptanceRate >= 0.6 },
                    { label: 'Expiry Rate',      value: `${(kpis.offerExpiryRate * 100).toFixed(1)}%`,       good: kpis.offerExpiryRate < 0.2 },
                    { label: 'No-show Rate',     value: `${(kpis.noShowRate * 100).toFixed(1)}%`,            good: kpis.noShowRate < 0.05 },
                  ].map(({ label, value, good }) => (
                    <div key={label} className={cn('rounded-lg px-3 py-2.5 border', good ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                      <p className={cn('font-mono text-base font-bold mt-0.5', good ? 'text-emerald-700' : 'text-red-600')}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}

      </div>
    </div>
  );
}
