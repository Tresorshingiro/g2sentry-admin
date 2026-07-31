import {
  AlertTriangle, Banknote, Briefcase, Building2,
  CheckCircle, ChevronRight, FileText, MapPin, Plus,
  RefreshCcw, Shield, Timer, TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';
import type { ElementType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { fetchActivity, fetchLiveJobCounts } from '@/services/api';
import { fetchReplacementRequests } from '@/services/api/assignments';
import { fetchFullGuardianRoster } from '@/services/api/guardians';
import { fetchInvoices } from '@/services/api/billing';
import { apiGet } from '@/lib/api-client';
import { fetchJobFactsDaily, fetchGuardianPerfDaily } from '@/services/api/analytics';
import { fetchBookingSettings, type BookingSettings } from '@/services/api/settings';
import type { RawJobFactsDaily } from '@/services/api/analytics';
import type { KpisData } from '@/types/analytics';
import type { ActivityItem, DashboardStats } from '@/types/job';
import type { GuardianListItem } from '@/types/guardian-roster';
import type { RawInvoice } from '@/types/billing';
import { cn, formatMinutes, formatRatePct, formatRWF } from '@/lib/utils';
import {
  STATUS, HEAT_RAMP, AGING_COLORS,
  BAR_RADIUS_V, BAR_RADIUS_H, chartTooltip, valueAxisGrid,
} from '@/lib/chart-theme';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FullDashStats extends DashboardStats { kpis?: KpisData }
interface RawGuardianPerfDaily {
  date: string; guardianId: string;
  jobsAssigned: number; jobsCompleted: number; noShowCount: number;
  completionRate: string | number;
  avgResponseMinutes: string | number | null;
  avgRating: string | number | null;
}

type ViewPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
interface PeriodRange { from: string; to: string; prevFrom: string; prevTo: string; label: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function monthYM(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function filterFacts(facts: RawJobFactsDaily[], from: string, to: string) {
  return facts.filter(r => r.date >= from && r.date <= to);
}
function sumRev(f: RawJobFactsDaily[]) { return f.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0); }
function sumJobs(f: RawJobFactsDaily[]) { return f.reduce((s, r) => s + r.jobCount, 0); }
function sumCompleted(f: RawJobFactsDaily[]) { return f.reduce((s, r) => s + r.completedCount, 0); }
// A null rate has no direction — show no arrow rather than a misleading "down".
function trendAbove(rate: number | null | undefined, target: number): 'up' | 'down' | undefined {
  if (rate == null || !Number.isFinite(rate)) return undefined;
  return rate >= target ? 'up' : 'down';
}
function trendBelow(rate: number | null | undefined, target: number): 'up' | 'down' | undefined {
  if (rate == null || !Number.isFinite(rate)) return undefined;
  return rate < target ? 'up' : 'down';
}

function rollingAvg(data: number[], win: number): number[] {
  return data.map((_, i) => {
    const s = data.slice(Math.max(0, i - win + 1), i + 1);
    return Math.round(s.reduce((a, b) => a + b, 0) / s.length * 10) / 10;
  });
}

function computePeriodRange(period: ViewPeriod, cFrom: string, cTo: string): PeriodRange {
  const today = todayStr();
  const now   = new Date();
  switch (period) {
    case 'today':
      return { from: today, to: today, prevFrom: daysAgo(1), prevTo: daysAgo(1), label: 'Today' };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      const wStart = d.toISOString().slice(0, 10);
      const pEnd   = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
      const pStart = new Date(d.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      return { from: wStart, to: today, prevFrom: pStart, prevTo: pEnd, label: 'This week' };
    }
    case 'month': {
      const mStart = `${monthYM(now)}-01`;
      const pD     = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pStart = `${monthYM(pD)}-01`;
      const pEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { from: mStart, to: today, prevFrom: pStart, prevTo: pEnd, label: 'This month' };
    }
    case 'quarter': {
      const q      = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
      const pqStart = new Date(now.getFullYear(), q * 3 - 3, 1).toISOString().slice(0, 10);
      const pqEnd   = new Date(now.getFullYear(), q * 3, 0).toISOString().slice(0, 10);
      return { from: qStart, to: today, prevFrom: pqStart, prevTo: pqEnd, label: 'This quarter' };
    }
    case 'year': {
      const yStart = `${now.getFullYear()}-01-01`;
      return { from: yStart, to: today, prevFrom: `${now.getFullYear()-1}-01-01`, prevTo: `${now.getFullYear()-1}-12-31`, label: String(now.getFullYear()) };
    }
    case 'custom':
      if (cFrom && cTo && cFrom <= cTo) {
        const days  = Math.round((new Date(cTo).getTime() - new Date(cFrom).getTime()) / 86400000) + 1;
        const pTo   = new Date(new Date(cFrom).getTime() - 86400000).toISOString().slice(0, 10);
        const pFrom = new Date(new Date(cFrom).getTime() - days * 86400000).toISOString().slice(0, 10);
        return { from: cFrom, to: cTo, prevFrom: pFrom, prevTo: pTo, label: `${cFrom} – ${cTo}` };
      }
      return { from: today, to: today, prevFrom: daysAgo(1), prevTo: daysAgo(1), label: 'Custom' };
  }
}

const JOB_LABELS: Record<string, string> = {
  STANDARD_GUARDIAN: 'Standard Guardian',
  CORPORATE_GUARDIAN: 'Corporate Guardian',
  EVENT_GUARDIAN: 'Event Guardian',
  CHILD_ESCORT_GUARDIAN: 'Child Escort Guardian',
  MEDICAL_ESCORT_GUARDIAN: 'Medical Escort Guardian',
  EXECUTIVE_VIP_GUARDIAN: 'Executive / VIP Guardian',
  ARMED_GUARDIAN: 'Armed Guardian',
};

const TT = chartTooltip;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skel({ className }: { className?: string }) {
  return <div className={cn('bg-slate-100 animate-pulse rounded', className)} />;
}

interface SectionProps {
  icon: ElementType; iconBg: string; iconColor: string;
  title: string; subtitle: string; action?: string; onAction?: () => void;
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
            className="flex items-center gap-1 text-xs font-semibold text-[#14B87A] hover:text-[#12a56d] cursor-pointer">
            {action} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string; value: string | number; sub?: string;
  icon: ElementType; iconBg: string; iconColor: string;
  trend?: 'up' | 'down' | 'neutral'; loading?: boolean; onClick?: () => void;
}
function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, trend, loading, onClick }: StatCardProps) {
  return (
    <div onClick={onClick} className={cn('bg-white border border-slate-200 rounded-xl p-4', onClick && 'cursor-pointer hover:shadow-sm transition-all')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          {loading ? <Skel className="h-7 w-20 mt-2" /> : <p className="font-mono text-[22px] font-bold text-slate-900 mt-1.5 tabular-nums leading-none">{value}</p>}
          {sub && !loading && (
            <p className={cn('text-xs mt-2 font-medium flex items-center gap-1', trend === 'up' ? 'text-[#14B87A]' : trend === 'down' ? 'text-red-500' : 'text-slate-400')}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
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

function KpiPill({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</p>
      {loading ? <Skel className="h-5 w-16 mt-1" /> : <p className="font-mono text-base font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-bold text-slate-700 mb-0.5">{title}</p>
      <p className="text-[11px] text-slate-400 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  const [stats, setStats]               = useState<FullDashStats | null>(null);
  const [jobFacts, setJobFacts]         = useState<RawJobFactsDaily[]>([]);
  const [gPerf, setGPerf]               = useState<RawGuardianPerfDaily[]>([]);
  const [roster, setRoster]             = useState<GuardianListItem[]>([]);
  const [invoicesIssued, setInvIssued]   = useState<RawInvoice[]>([]);
  const [invoicesOverdue, setInvOverdue] = useState<RawInvoice[]>([]);
  const [invoicesDisputed, setInvDisp]   = useState<RawInvoice[]>([]);
  const [invoicesPaid, setInvPaid]       = useState<RawInvoice[]>([]);
  const [invoicesDraft, setInvDraft]     = useState<RawInvoice[]>([]);
  const [activity, setActivity]         = useState<ActivityItem[]>([]);
  const [liveJobs, setLiveJobs]         = useState<{ inProgress: number; dispatching: number; pending: number } | null>(null);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);
  const [pendingReplace, setPendingReplace] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [fetchedAt, setFetchedAt]       = useState(0);

  const doFetch = useCallback(() => {
    const empty = { items: [] as RawInvoice[], meta: { page: 1, limit: 100, total: 0, hasMore: false } };
    return Promise.all([
      apiGet<FullDashStats>('/admin/analytics/dashboard').catch(() => null),
      fetchJobFactsDaily().catch(() => [] as RawJobFactsDaily[]),
      fetchGuardianPerfDaily().catch(() => [] as RawGuardianPerfDaily[]),
      fetchFullGuardianRoster().catch(() => [] as GuardianListItem[]),
      fetchInvoices(1, 100, 'ISSUED').catch(() => empty),
      fetchInvoices(1, 100, 'OVERDUE').catch(() => empty),
      fetchInvoices(1, 100, 'DISPUTED').catch(() => empty),
      fetchInvoices(1, 100, 'PAID').catch(() => empty),
      fetchInvoices(1, 100, 'DRAFT').catch(() => empty),
      fetchActivity().catch(() => [] as ActivityItem[]),
      fetchLiveJobCounts().catch(() => ({ inProgress: 0, dispatching: 0, pending: 0 })),
      fetchReplacementRequests().catch(() => []),
      fetchBookingSettings().catch(() => null),
    ]).then(([s, jf, gp, ros, iss, ovd, dis, paid, draft, act, lj, repl, booking]) => {
      if (s) setStats(s);
      setJobFacts(Array.isArray(jf) ? jf : []);
      setGPerf(Array.isArray(gp) ? gp : []);
      setRoster(ros);
      setInvIssued(iss.items);
      setInvOverdue(ovd.items);
      setInvDisp(dis.items);
      setInvPaid(paid.items);
      setInvDraft(draft.items);
      setActivity(act);
      setLiveJobs(lj);
      setPendingReplace(repl.length);
      setBookingSettings(booking);
      setFetchedAt(Date.now());
    }).finally(() => setLoading(false));
  }, []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    void doFetch();
  }, [doFetch]);

  useEffect(() => { void doFetch(); }, [doFetch]);

  // ── Period derivation ─────────────────────────────────────────────────────
  const period = useMemo(() => computePeriodRange(viewPeriod, customFrom, customTo), [viewPeriod, customFrom, customTo]);
  const today  = todayStr();

  const facts     = useMemo(() => filterFacts(jobFacts, period.from, period.to),       [jobFacts, period]);
  const prevFacts = useMemo(() => filterFacts(jobFacts, period.prevFrom, period.prevTo),[jobFacts, period]);
  const facts30   = useMemo(() => filterFacts(jobFacts, daysAgo(30), today),            [jobFacts, today]);

  // ── Aggregates ────────────────────────────────────────────────────────────
  // `totalRevenue` from JobFactsDaily is the *gross* client invoice total
  // (Σ invoice.total, VAT-inclusive). The revenue split is computed on the
  // pre-VAT subtotal, so to surface real platform earnings we strip VAT first
  // and apply the current split percentages from booking settings.
  const grossBilling     = sumRev(facts);
  const prevGrossBilling = sumRev(prevFacts);
  const grossToday       = sumRev(filterFacts(jobFacts, today, today));

  const vatRate      = bookingSettings?.vatRate ?? 0.18;
  const platformPct  = bookingSettings?.platformSharePct ?? 0.15;
  const guardianPct  = bookingSettings?.guardianSharePct ?? 0.80;
  const netFactor    = 1 / (1 + vatRate);          // gross (incl. VAT) → subtotal
  const platformRevenue     = grossBilling * netFactor * platformPct;
  const prevPlatformRevenue = prevGrossBilling * netFactor * platformPct;
  const guardianPayout      = grossBilling * netFactor * guardianPct;
  const jobs        = sumJobs(facts);
  const prevJobs    = sumJobs(prevFacts);
  const completed   = sumCompleted(facts);
  const cancelled   = facts.reduce((s, r) => s + r.cancelledCount, 0);
  const completionRate = jobs > 0 ? Math.round((completed / jobs) * 100) : 0;
  const kpis           = stats?.kpis;
  const liveJobTotal   = liveJobs ? liveJobs.inProgress + liveJobs.dispatching : 0;

  // Invoice aggregates
  const outstanding  = [...invoicesIssued, ...invoicesOverdue].reduce((s, i) => s + Number(i.total), 0);
  const disputedVal  = invoicesDisputed.reduce((s, i) => s + Number(i.total), 0);
  const paidValue    = invoicesPaid.reduce((s, i) => s + Number(i.total), 0);
  const draftValue   = invoicesDraft.reduce((s, i) => s + Number(i.total), 0);

  // Invoice aging buckets
  const aging = useMemo(() => {
    const buckets = { '0–7d': 0, '8–14d': 0, '15–30d': 0, '30d+': 0 };
    const vals    = { '0–7d': 0, '8–14d': 0, '15–30d': 0, '30d+': 0 };
    for (const inv of [...invoicesIssued, ...invoicesOverdue]) {
      const days = (fetchedAt - new Date(inv.issuedAt ?? inv.createdAt).getTime()) / 86400000;
      const k = days <= 7 ? '0–7d' : days <= 14 ? '8–14d' : days <= 30 ? '15–30d' : '30d+';
      buckets[k]++; vals[k] += Number(inv.total);
    }
    return { counts: buckets, values: vals };
  }, [invoicesIssued, invoicesOverdue, fetchedAt]);

  const guardianAvail = useMemo(() => {
    let available = 0, onDuty = 0, offline = 0;
    for (const g of roster) {
      const s = g.shiftState?.shiftStatus;
      if (s === 'AVAILABLE') available++; else if (s === 'BUSY') onDuty++; else offline++;
    }
    return { available, onDuty, offline, total: roster.length };
  }, [roster]);

  // Top guardians
  const topGuardians = useMemo(() => {
    const nameMap = new Map<string, string>();
    for (const g of roster) nameMap.set(g.id, g.user.fullName ?? g.guardianCode);
    type Agg = { completed: number; assigned: number; noShows: number };
    const byG = new Map<string, Agg>();
    for (const r of gPerf) {
      const a = byG.get(r.guardianId) ?? { completed: 0, assigned: 0, noShows: 0 };
      a.completed += r.jobsCompleted; a.assigned += r.jobsAssigned; a.noShows += r.noShowCount;
      byG.set(r.guardianId, a);
    }
    return Array.from(byG.entries()).sort((a, b) => b[1].completed - a[1].completed).slice(0, 5)
      .map(([id, a]) => {
        const name = nameMap.get(id) ?? `…${id.slice(-4)}`;
        return { id, name, initials: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), ...a, reliability: a.assigned > 0 ? Math.round((a.completed / a.assigned) * 100) : 0 };
      });
  }, [gPerf, roster]);

  // Top organizations by billed revenue (from recent invoices)
  const topOrgs = useMemo(() => {
    const m = new Map<string, { name: string; revenue: number; jobs: number; outstanding: number }>();
    const add = (inv: RawInvoice, outstanding: boolean) => {
      if (!inv.organization) return;
      const a = m.get(inv.organization.id) ?? { name: inv.organization.legalName, revenue: 0, jobs: 0, outstanding: 0 };
      a.revenue += Number(inv.total);
      a.jobs    += 1;
      if (outstanding) a.outstanding += Number(inv.total);
      m.set(inv.organization.id, a);
    };
    for (const i of invoicesPaid)     add(i, false);
    for (const i of invoicesIssued)   add(i, true);
    for (const i of invoicesOverdue)  add(i, true);
    for (const i of invoicesDisputed) add(i, false);
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [invoicesPaid, invoicesIssued, invoicesOverdue, invoicesDisputed]);

  // ── Chart options ─────────────────────────────────────────────────────────

  // Daily revenue last 30 days
  const dailyRevOption = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
    const m = new Map<string, number>();
    for (const r of facts30) m.set(r.date, (m.get(r.date) ?? 0) + Number(r.totalRevenue ?? 0));
    const vals = days.map(d => Math.round((m.get(d) ?? 0) / 1000));
    const ma7  = rollingAvg(vals, 7);
    const labels = days.map(d => { const [, mo, dy] = d.split('-'); return `${dy}/${mo}`; });
    return {
      grid: { left: 0, right: 0, top: 30, bottom: 0, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { value: number; seriesName: string }[]) => p.map(x => `${x.seriesName}: RWF ${x.value}k`).join('<br/>') },
      legend: { top: 0, data: ['Revenue', '7-day avg'], textStyle: { color: '#94A3B8', fontSize: 10, fontFamily: IBM }, itemHeight: 8, itemWidth: 12 },
      xAxis: { type: 'category' as const, data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94A3B8', fontSize: 9, fontFamily: IBM, interval: 4 } },
      yAxis: valueAxisGrid(),
      series: [
        { name: 'Revenue',  type: 'bar' as const,  barMaxWidth: 16, itemStyle: { color: STATUS.healthy, borderRadius: BAR_RADIUS_V }, data: vals },
        { name: '7-day avg', type: 'line' as const, smooth: true, lineStyle: { color: '#475569', width: 2 }, itemStyle: { color: '#475569' }, symbol: 'none', data: ma7 },
      ],
    };
  }, [facts30]);

  // Monthly revenue last 12 months
  const monthlyRevOption = useMemo(() => {
    const [ty, tm] = today.split('-').map(Number);
    const months = Array.from({ length: 12 }, (_, i) => monthYM(new Date(ty, tm - 1 - (11 - i), 1)));
    const m = new Map<string, number>();
    for (const r of jobFacts) { const ym = r.date.slice(0, 7); m.set(ym, (m.get(ym) ?? 0) + Number(r.totalRevenue ?? 0)); }
    const vals   = months.map(ym => Math.round((m.get(ym) ?? 0) / 100000) / 10);
    const labels = months.map(ym => { const [yr, mo] = ym.split('-'); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mo)-1]} '${yr.slice(2)}`; });
    return {
      grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { value: number }[]) => `RWF ${p[0].value}M` },
      xAxis: { type: 'category' as const, data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94A3B8', fontSize: 9, fontFamily: IBM } },
      yAxis: valueAxisGrid(),
      series: [{ type: 'bar' as const, barMaxWidth: 30, itemStyle: { color: STATUS.healthy, borderRadius: BAR_RADIUS_V }, data: vals }],
    };
  }, [jobFacts, today]);

  // Revenue by hour of day
  const revByHourOption = useMemo(() => {
    const hourData = Array(24).fill(0);
    for (const r of facts30) hourData[r.hourOfDay ?? 0] += Number(r.totalRevenue ?? 0);
    const vals = hourData.map(v => Math.round(v / 1000));
    return {
      grid: { left: 0, right: 0, top: 10, bottom: 0, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { value: number }[]) => `RWF ${p[0].value}k` },
      xAxis: { type: 'category' as const, data: Array.from({ length: 24 }, (_, i) => `${i}h`), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94A3B8', fontSize: 8, fontFamily: IBM } },
      yAxis: valueAxisGrid(),
      series: [{ type: 'bar' as const, barMaxWidth: 18,
        itemStyle: { color: (p: { dataIndex: number }) => (p.dataIndex >= 22 || p.dataIndex < 6) ? STATUS.neutral : STATUS.healthy, borderRadius: BAR_RADIUS_V },
        data: vals }],
    };
  }, [facts30]);

  // Job volume last 30 days
  const jobVolOption = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
    const m = new Map<string, { jobs: number; completed: number }>();
    for (const r of facts30) { const p = m.get(r.date) ?? { jobs: 0, completed: 0 }; p.jobs += r.jobCount; p.completed += r.completedCount; m.set(r.date, p); }
    const labels = days.map(d => { const [, mo, dy] = d.split('-'); return `${dy}/${mo}`; });
    return {
      grid: { left: 0, right: 0, top: 30, bottom: 0, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const },
      legend: { top: 0, data: ['Jobs', 'Completed'], textStyle: { color: '#94A3B8', fontSize: 10, fontFamily: IBM }, itemHeight: 8, itemWidth: 12 },
      xAxis: { type: 'category' as const, data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94A3B8', fontSize: 9, fontFamily: IBM, interval: 4 } },
      yAxis: valueAxisGrid(),
      series: [
        { name: 'Jobs',      type: 'bar' as const, barMaxWidth: 14, itemStyle: { color: STATUS.info, borderRadius: BAR_RADIUS_V }, data: days.map(d => m.get(d)?.jobs ?? 0) },
        { name: 'Completed', type: 'bar' as const, barMaxWidth: 14, itemStyle: { color: STATUS.healthy, borderRadius: BAR_RADIUS_V }, data: days.map(d => m.get(d)?.completed ?? 0) },
      ],
    };
  }, [facts30]);

  // Jobs heatmap day × hour
  const heatmapOption = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of facts30) grid[new Date(r.date).getDay()][r.hourOfDay ?? 0] += r.jobCount;
    const data: [number, number, number][] = [];
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) data.push([h, d, grid[d][h]]);
    const maxVal = Math.max(...data.map(d => d[2]), 1);
    return {
      grid: { left: 50, right: 10, top: 10, bottom: 30 },
      tooltip: { ...TT, formatter: (p: { data: [number, number, number] }) => `${DOW[p.data[1]]} ${p.data[0]}:00 — ${p.data[2]} jobs` },
      xAxis: { type: 'category' as const, data: Array.from({ length: 24 }, (_, i) => `${i}h`), axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: true }, axisLabel: { fontSize: 8, color: '#94A3B8' } },
      yAxis: { type: 'category' as const, data: DOW, axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: true }, axisLabel: { fontSize: 10, color: '#64748B' } },
      visualMap: { show: false, min: 0, max: maxVal, inRange: { color: [...HEAT_RAMP] } },
      series: [{ type: 'heatmap' as const, data, itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 2 } }],
    };
  }, [facts30]);

  // Revenue by district
  const revByDistrictOption = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of facts30) { if (r.district) m.set(r.district, (m.get(r.district) ?? 0) + Number(r.totalRevenue ?? 0)); }
    const sorted = Array.from(m.entries()).sort((a, b) => a[1] - b[1]).slice(-8);
    if (!sorted.length) return null;
    return {
      grid: { left: 10, right: 60, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { name: string; value: number }[]) => `${p[0].name}: ${formatRWF(p[0].value * 1000)}` },
      xAxis: valueAxisGrid(),
      yAxis: { type: 'category' as const, data: sorted.map(([d]) => d), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748B', fontSize: 11, fontFamily: IBM } },
      series: [{ type: 'bar' as const, barMaxWidth: 20, itemStyle: { color: STATUS.healthy, borderRadius: BAR_RADIUS_H }, label: { show: true, position: 'right' as const, color: '#475569', fontSize: 10, formatter: (p: { value: number }) => `${p.value}k` }, data: sorted.map(([, v]) => Math.round(v / 1000)) }],
    };
  }, [facts30]);

  // Job type ranked bar — one dominant category + a long tail, so a ranked list
  // reads far better than a donut (matches the Dispatch Failure Reasons pattern).
  const jobTypeOption = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of facts30) m.set(r.jobType, (m.get(r.jobType) ?? 0) + r.jobCount);
    const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
    if (!total) return null;
    const sorted = Array.from(m.entries())
      .map(([t, v]) => ({ label: JOB_LABELS[t] ?? t, count: v, pct: Math.round((v / total) * 100) }))
      .sort((a, b) => a.count - b.count)
      .slice(-7);
    return {
      grid: { left: 10, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const, formatter: (p: { name: string; value: number }[]) => `${p[0].name}: ${p[0].value} jobs` },
      xAxis: valueAxisGrid(),
      yAxis: { type: 'category' as const, data: sorted.map(s => s.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748B', fontSize: 11, fontFamily: IBM } },
      series: [{
        type: 'bar' as const, barMaxWidth: 20,
        itemStyle: { color: STATUS.healthy, borderRadius: BAR_RADIUS_H },
        label: { show: true, position: 'right' as const, color: '#475569', fontSize: 10, formatter: (p: { data: number }) => String(p.data) },
        data: sorted.map(s => s.count),
      }],
    };
  }, [facts30]);

  // Dispatch failure reasons
  const failureOption = useMemo(() => {
    if (!kpis?.dispatchFailuresByReason?.length) return null;
    const sorted = [...kpis.dispatchFailuresByReason].sort((a, b) => a.count - b.count);
    return {
      grid: { left: 10, right: 40, top: 8, bottom: 8, containLabel: true },
      tooltip: { ...TT, trigger: 'axis' as const },
      xAxis: valueAxisGrid(),
      yAxis: { type: 'category' as const, data: sorted.map(r => r.reason.replace(/_/g, ' ')), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#64748B', fontSize: 10, fontFamily: IBM } },
      series: [{ type: 'bar' as const, barMaxWidth: 20, itemStyle: { color: STATUS.danger, borderRadius: BAR_RADIUS_H }, label: { show: true, position: 'right' as const, color: '#475569', fontSize: 10 }, data: sorted.map(r => r.count) }],
    };
  }, [kpis]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function deltaLabel(curr: number, prev: number, fmt: 'rwf' | 'count' = 'count') {
    if (prev === 0) return { text: 'No prior data', trend: 'neutral' as const };
    const diff = curr - prev;
    const pct  = ((diff / prev) * 100).toFixed(1);
    const fv   = fmt === 'rwf' ? formatRWF(Math.abs(diff)) : String(Math.abs(diff));
    return { text: `${diff >= 0 ? '+' : '-'}${fv} (${diff >= 0 ? '+' : ''}${pct}%) vs prev`, trend: (diff >= 0 ? 'up' : 'down') as 'up' | 'down' };
  }


  const QUICK_ACTIONS = [
    { label: 'Replacement Requests', icon: RefreshCcw, path: '/replacement-requests', badge: pendingReplace > 0 ? pendingReplace : undefined },
    { label: 'Register New Guardian', icon: Plus, path: '/guardians/new' },
    { label: 'Dispatch Jobs', icon: Briefcase, path: '/assignments' },
    { label: 'Billing & Invoices', icon: Banknote, path: '/billing' },
    { label: 'Live Map', icon: MapPin, path: '/map' },
    { label: 'Clients', icon: Building2, path: '/clients' },
  ];

  const PERIOD_BTNS: { key: ViewPeriod; label: string }[] = [
    { key: 'today',   label: 'Today' },
    { key: 'week',    label: 'Week' },
    { key: 'month',   label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
    { key: 'year',    label: 'Year' },
    { key: 'custom',  label: 'Custom' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]" style={{ fontFamily: IBM }}>
      <div className="p-5 space-y-6 max-w-[1600px] mx-auto w-full">

        {/* ── Top KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiPill label="Active Jobs"          value={loading ? '—' : String(liveJobTotal)}                                              loading={loading} />
          <KpiPill label="On Shift"             value={loading ? '—' : `${guardianAvail.onDuty + guardianAvail.available} / ${guardianAvail.total}`} loading={loading} />
          <KpiPill label="No-show Rate"         value={loading || !kpis ? '—' : formatRatePct(kpis.noShowRate)}                        loading={loading} />
          <KpiPill label="Replacements Pending" value={loading ? '—' : String(pendingReplace)}                                           loading={loading} />
          <KpiPill label="Billed Today"         value={loading ? '—' : formatRWF(grossToday)}                                            loading={loading} />
          <KpiPill label="Overdue Invoices"     value={loading ? '—' : String(invoicesOverdue.length)}                                   loading={loading} />
        </div>

        {/* ── Period filter ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
            {PERIOD_BTNS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setViewPeriod(key)}
                className={cn('px-3 py-1.5 text-xs font-bold rounded transition-all cursor-pointer',
                  viewPeriod === key ? 'bg-[#14B87A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50')}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            <RefreshCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Custom date range picker */}
        {viewPeriod === 'custom' && (
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
            <span className="text-xs font-semibold text-slate-500">Date range:</span>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer" />
            <span className="text-slate-300">→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer" />
            {customFrom && customTo && customFrom <= customTo && (
              <span className="text-xs text-[#14B87A] font-semibold">Showing {period.label}</span>
            )}
          </div>
        )}

        {/* ── Operations Overview ── */}
        <Section icon={Briefcase} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
          title="Operations Overview" subtitle={`Job performance · ${period.label}`}
          action="View Jobs" onAction={() => navigate('/assignments')}>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Jobs Created" value={jobs} loading={loading}
              icon={Briefcase} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
              sub={prevJobs > 0 ? deltaLabel(jobs, prevJobs).text : undefined}
              trend={prevJobs > 0 ? deltaLabel(jobs, prevJobs).trend : undefined} />
            <StatCard label="Completed" value={completed} loading={loading}
              icon={CheckCircle} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
              sub={`${completionRate}% completion rate`} trend={completionRate >= 80 ? 'up' : 'down'} />
            <StatCard label="Cancelled" value={cancelled} loading={loading}
              icon={AlertTriangle} iconBg="bg-amber-50 border-amber-100" iconColor="text-amber-500" />
            <StatCard label="Failed" value={kpis?.jobsFailed ?? 0} loading={loading}
              icon={AlertTriangle} iconBg="bg-red-50 border-red-100" iconColor="text-red-500"
              sub={(kpis?.jobsFailed ?? 0) > 0 ? 'Requires attention' : 'All clear'}
              trend={(kpis?.jobsFailed ?? 0) > 0 ? 'down' : 'up'} />
          </div>
        </Section>

        {/* ── Guardian Status ── */}
        <Section icon={Shield} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
          title="Guardian Status" subtitle="Current shift availability"
          action="View Guardians" onAction={() => navigate('/guardians')}>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="On Duty / Busy" value={guardianAvail.onDuty} loading={loading}
              icon={Shield} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500" sub="Assigned to a job" />
            <StatCard label="Available" value={guardianAvail.available} loading={loading}
              icon={Users} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]" sub="Ready to dispatch" trend="up" />
            <StatCard label="Offline" value={guardianAvail.offline} loading={loading}
              icon={Users} iconBg="bg-slate-50 border-slate-200" iconColor="text-slate-400" sub="Off shift" />
            <StatCard label="Total Registered" value={guardianAvail.total} loading={loading}
              icon={Shield} iconBg="bg-purple-50 border-purple-100" iconColor="text-purple-500" />
          </div>
        </Section>

        {/* ── Financial ── */}
        <Section icon={Banknote} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
          title="Financial Overview" subtitle={`Revenue & billing · ${period.label}`}
          action="View Billing" onAction={() => navigate('/billing')}>

          {/* Revenue band — platform revenue is what the company actually earns,
              derived by stripping VAT from gross billing and applying the split. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <StatCard label={`Platform Revenue · ${period.label}`} value={formatRWF(platformRevenue)} loading={loading}
              icon={TrendingUp} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
              sub={prevPlatformRevenue > 0
                ? deltaLabel(platformRevenue, prevPlatformRevenue, 'rwf').text
                : `${Math.round(platformPct * 100)}% of net billings`}
              trend={prevPlatformRevenue > 0 ? deltaLabel(platformRevenue, prevPlatformRevenue, 'rwf').trend : 'up'} />
            <StatCard label={`Gross Billing · ${period.label}`} value={formatRWF(grossBilling)} loading={loading}
              icon={Banknote} iconBg="bg-slate-50 border-slate-200" iconColor="text-slate-500"
              sub={prevGrossBilling > 0
                ? deltaLabel(grossBilling, prevGrossBilling, 'rwf').text
                : 'Client invoices · incl. VAT'}
              trend={prevGrossBilling > 0 ? deltaLabel(grossBilling, prevGrossBilling, 'rwf').trend : 'neutral'} />
            <StatCard label="Guardian Payouts" value={formatRWF(guardianPayout)} loading={loading}
              icon={Shield} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
              sub={`${Math.round(guardianPct * 100)}% of net billings · liability`} />
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            <StatCard label="Outstanding" value={formatRWF(outstanding)} loading={loading}
              icon={AlertTriangle} iconBg="bg-amber-50 border-amber-100" iconColor="text-amber-500"
              sub={`${invoicesIssued.length + invoicesOverdue.length} invoices pending`}
              trend={invoicesOverdue.length > 0 ? 'down' : 'neutral'} />
            <StatCard label="Disputed" value={formatRWF(disputedVal)} loading={loading}
              icon={AlertTriangle} iconBg="bg-red-50 border-red-100" iconColor="text-red-500"
              sub={`${invoicesDisputed.length} disputed invoices`}
              trend={invoicesDisputed.length > 0 ? 'down' : 'up'} />
            <StatCard label="Paid" value={formatRWF(paidValue)} loading={loading}
              icon={CheckCircle} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
              sub={`${invoicesPaid.length} invoices settled`} trend="up" />
          </div>
        </Section>

        {/* ── Dispatch Performance ── */}
        {kpis && (
          <Section icon={Zap} iconBg="bg-purple-50 border-purple-100" iconColor="text-purple-500"
            title="Dispatch Performance" subtitle="Conversion and latency KPIs">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard label="Dispatch Conversion" value={formatRatePct(kpis.dispatchConversionRate)}
                icon={Zap} iconBg="bg-purple-50 border-purple-100" iconColor="text-purple-500"
                sub="Jobs → guardian accepted" trend={trendAbove(kpis.dispatchConversionRate, 0.7)} />
              <StatCard label="Offer Acceptance" value={formatRatePct(kpis.offerAcceptanceRate)}
                icon={CheckCircle} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
                sub="Offers accepted by guardians" trend={trendAbove(kpis.offerAcceptanceRate, 0.6)} />
              <StatCard label="Time to First Offer P50" value={formatMinutes(kpis.latencyMinutes?.p50TimeToFirstOffer)}
                icon={Timer} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
                sub={`P95: ${formatMinutes(kpis.latencyMinutes?.p95TimeToFirstOffer)}`} />
              <StatCard label="No-show Rate" value={formatRatePct(kpis.noShowRate)}
                icon={AlertTriangle} iconBg="bg-red-50 border-red-100" iconColor="text-red-500"
                sub={`${kpis.noShowAssignments} no-shows`} trend={trendBelow(kpis.noShowRate, 0.05)} />
            </div>
          </Section>
        )}

        {/* ── Revenue Intelligence charts ── */}
        <Section icon={TrendingUp} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
          title="Revenue Intelligence" subtitle="Gross billing trends and patterns — last 30 days">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Daily Gross Billing" subtitle="RWF thousands with 7-day rolling average">
              {facts30.length > 0 ? <ReactECharts option={dailyRevOption} style={{ height: 180 }} /> : <div className="h-[180px] flex items-center justify-center text-xs text-slate-400">No data</div>}
            </ChartCard>
            <ChartCard title="Monthly Gross Billing" subtitle="Last 12 months in RWF millions">
              <ReactECharts option={monthlyRevOption} style={{ height: 180 }} />
            </ChartCard>
            <div className="lg:col-span-2">
              <ChartCard title="Gross Billing by Hour of Day" subtitle="When billing is generated — green = working hours, grey = overnight (22:00–06:00)">
                <ReactECharts option={revByHourOption} style={{ height: 160 }} />
              </ChartCard>
            </div>
          </div>
        </Section>

        {/* ── Job charts ── */}
        <Section icon={Briefcase} iconBg="bg-blue-50 border-blue-100" iconColor="text-blue-500"
          title="Job Insights" subtitle="Volume, patterns, and type breakdown — last 30 days">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Daily Job Volume" subtitle="Jobs created vs completed per day">
              {facts30.length > 0 ? <ReactECharts option={jobVolOption} style={{ height: 180 }} /> : <div className="h-[180px] flex items-center justify-center text-xs text-slate-400">No data</div>}
            </ChartCard>
            <ChartCard title="Job Type Breakdown" subtitle="Jobs by service type — ranked">
              {jobTypeOption
                ? <ReactECharts option={jobTypeOption} style={{ height: 200 }} />
                : <div className="h-[200px] flex items-center justify-center text-xs text-slate-400">No data</div>
              }
            </ChartCard>
            <ChartCard title="Jobs by District (Revenue)" subtitle="Top districts by total revenue">
              {revByDistrictOption ? <ReactECharts option={revByDistrictOption} style={{ height: 200 }} /> : <div className="h-[200px] flex items-center justify-center text-xs text-slate-400">No data</div>}
            </ChartCard>
            <ChartCard title="Activity Heatmap" subtitle="Job concentration by day of week × hour of day">
              {facts30.length > 0 ? <ReactECharts option={heatmapOption} style={{ height: 200 }} /> : <div className="h-[200px] flex items-center justify-center text-xs text-slate-400">No data</div>}
            </ChartCard>
          </div>
        </Section>

        {/* ── Billing pipeline ── */}
        <Section icon={FileText} iconBg="bg-slate-50 border-slate-200" iconColor="text-slate-500"
          title="Invoice Pipeline" subtitle="Invoice status breakdown and aging"
          action="View Billing" onAction={() => navigate('/billing')}>
          <div className="bg-white border border-slate-200 rounded-xl mb-4 grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100">
            {[
              { label: 'Draft', count: invoicesDraft.length, value: draftValue, color: 'text-slate-600' },
              { label: 'Issued', count: invoicesIssued.length, value: invoicesIssued.reduce((s, i) => s + Number(i.total), 0), color: 'text-blue-600' },
              { label: 'Overdue', count: invoicesOverdue.length, value: invoicesOverdue.reduce((s, i) => s + Number(i.total), 0), color: 'text-red-600' },
              { label: 'Disputed', count: invoicesDisputed.length, value: disputedVal, color: 'text-amber-600' },
              { label: 'Paid', count: invoicesPaid.length, value: paidValue, color: 'text-[#14B87A]' },
            ].map(({ label, count, value, color }) => (
              <div key={label} className="px-4 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className={cn('font-mono text-xl font-bold mt-1 tabular-nums', color)}>{count}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono tabular-nums">{formatRWF(value)}</p>
              </div>
            ))}
          </div>
          {/* Aging — single stacked bar, segments sized by outstanding amount */}
          {(() => {
            const buckets = ['0–7d', '8–14d', '15–30d', '30d+'] as const;
            const totalVal   = buckets.reduce((s, b) => s + aging.values[b], 0);
            const totalCount = buckets.reduce((s, b) => s + aging.counts[b], 0);
            return (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Outstanding aging</p>
                  <p className="text-[11px] text-slate-400 font-mono tabular-nums">{totalCount} invoices · {formatRWF(totalVal)}</p>
                </div>
                {totalVal > 0 ? (
                  <>
                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
                      {buckets.map((b, i) => {
                        const pct = (aging.values[b] / totalVal) * 100;
                        if (pct <= 0) return null;
                        return <div key={b} style={{ width: `${pct}%`, backgroundColor: AGING_COLORS[i] }} title={`${b}: ${formatRWF(aging.values[b])}`} />;
                      })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      {buckets.map((b, i) => (
                        <div key={b} className="flex items-start gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: AGING_COLORS[i] }} />
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{b}</p>
                            <p className="font-mono text-sm font-bold text-slate-800 tabular-nums mt-0.5">{aging.counts[b]}</p>
                            <p className="text-[10px] text-slate-400 font-mono tabular-nums">{formatRWF(aging.values[b])}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">No outstanding invoices</div>
                )}
              </div>
            );
          })()}
        </Section>

        {/* ── Dispatch failures ── */}
        {failureOption && (
          <Section icon={Zap} iconBg="bg-red-50 border-red-100" iconColor="text-red-500"
            title="Dispatch Failure Reasons" subtitle="Ranked by frequency — each reason points to a different operational fix">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <ReactECharts option={failureOption} style={{ height: 180 }} />
            </div>
          </Section>
        )}

        {/* ── Leaderboards ── */}
        {(topGuardians.length > 0 || topOrgs.length > 0) && (
          <Section icon={Shield} iconBg="bg-emerald-50 border-emerald-100" iconColor="text-[#14B87A]"
            title="Leaderboards" subtitle="Top guardians by completed jobs · top organizations by billed revenue">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Top guardians */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900">Top 5 Guardians</p>
                  <button type="button" onClick={() => navigate('/guardians')}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#14B87A] hover:text-[#12a56d] cursor-pointer">
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {topGuardians.length > 0 ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['#', 'Guardian', 'Completed', 'Reliability', 'No-shows'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topGuardians.map((g, i) => (
                        <tr key={g.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-[9px] font-bold text-emerald-700 shrink-0">{g.initials}</div>
                              <span className="text-xs font-medium text-slate-900 truncate max-w-[140px]">{g.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{g.completed}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#14B87A] rounded-full" style={{ width: `${g.reliability}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-slate-600 font-semibold">{g.reliability}%</span>
                            </div>
                          </td>
                          <td className={cn('px-4 py-3 font-mono text-xs font-semibold', g.noShows > 0 ? 'text-red-500' : 'text-slate-300')}>{g.noShows}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-xs text-slate-400">No guardian performance data yet</p>
                  </div>
                )}
              </div>

              {/* Top organizations */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900">Top 5 Organizations</p>
                  <button type="button" onClick={() => navigate('/clients')}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#14B87A] hover:text-[#12a56d] cursor-pointer">
                    View Clients <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {topOrgs.length > 0 ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['#', 'Organization', 'Jobs', 'Revenue', 'Outstanding'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topOrgs.map((o, i) => (
                        <tr key={o.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center shrink-0">
                                <Building2 className="w-3 h-3 text-blue-600" />
                              </div>
                              <span className="text-xs font-medium text-slate-900 truncate max-w-[150px]">{o.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.jobs}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 tabular-nums">{formatRWF(o.revenue)}</td>
                          <td className={cn('px-4 py-3 font-mono text-xs font-semibold tabular-nums', o.outstanding > 0 ? 'text-amber-600' : 'text-slate-300')}>
                            {o.outstanding > 0 ? formatRWF(o.outstanding) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-xs text-slate-400">No invoiced organizations yet</p>
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* ── Activity + Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900">Recent Activity</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Live timeline of system events</p>
            </div>
            <div className="p-4">
              {activity.length > 0
                ? <ActivityFeed items={activity.slice(0, 10)} />
                : <div className="flex items-center justify-center py-10"><p className="text-xs text-slate-400">No recent activity</p></div>
              }
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900">Quick Actions</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Common operations</p>
            </div>
            <div className="divide-y divide-slate-100">
              {QUICK_ACTIONS.map(a => (
                <button key={a.path} type="button" onClick={() => navigate(a.path)}
                  className="flex items-center gap-3 w-full px-5 py-3.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer text-left">
                  <a.icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1">{a.label}</span>
                  {a.badge !== undefined && <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{a.badge}</span>}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
