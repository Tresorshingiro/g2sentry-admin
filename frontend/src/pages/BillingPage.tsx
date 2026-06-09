import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Eye,
  FilePlus,
  Receipt,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { formatRWF } from '@/lib/utils';
import {
  fetchBillingOverview,
  fetchInvoices,
  fetchMonthlyChartData,
  fetchPayments,
  issueInvoice,
  voidInvoice,
  type MonthlyChartPoint,
} from '@/services/api';
import type {
  BillingSummary,
  EbmComplianceInfo,
  InvoiceFilter,
  InvoiceRow,
  Payment,
  RawInvoice,
} from '@/types/billing';

// ─── Design tokens ────────────────────────────────────────────────────────────
// Sharp card: `bg-white border border-slate-200 border-t-[3px] ${accent} rounded`
// Numbers: font-mono (JetBrains Mono via tailwind config)
// Labels: font-ibm (IBM Plex Sans via tailwind config) — fallback to system sans

// ─── Constants ────────────────────────────────────────────────────────────────

type BillingTab = InvoiceFilter | 'PAYMENTS';

const TABS: { key: BillingTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ISSUED', label: 'Issued' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PAYMENTS', label: 'Payments' },
];

const AVATAR_CLASSES = [
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-slate-200 text-slate-700',
  'bg-amber-100 text-amber-700',
];

const JOB_TYPE_LABELS: Record<string, string> = {
  PATROL: 'Patrol',
  ESCORT: 'Escort',
  EVENT_SECURITY: 'Event Security',
  DOOR_SUPERVISION: 'Door Supervision',
  VIP_PROTECTION: 'VIP Protection',
  EMERGENCY_RESPONSE: 'Emergency Response',
  COMPOUND_SECURITY: 'Compound Security',
  STATIC_POST: 'Static Post',
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  DRAFT:         { cls: 'bg-slate-100 text-slate-600 border-slate-300',   label: 'DRAFT' },
  ISSUED:        { cls: 'bg-blue-50 text-blue-700 border-blue-200',       label: 'ISSUED' },
  PAID:          { cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', label: 'PAID' },
  PARTIALLY_PAID:{ cls: 'bg-amber-50 text-amber-700 border-amber-200',    label: 'PARTIAL' },
  OVERDUE:       { cls: 'bg-red-50 text-red-700 border-red-200',          label: 'OVERDUE' },
  VOID:          { cls: 'bg-slate-100 text-slate-400 border-slate-200',   label: 'VOID' },
  DISPUTED:      { cls: 'bg-orange-50 text-orange-700 border-orange-200', label: 'DISPUTED' },
};

const PAYMENT_STATUS_BADGE: Record<string, { cls: string }> = {
  PENDING:   { cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPLETED: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  FAILED:    { cls: 'bg-red-50 text-red-700 border-red-200' },
  REFUNDED:  { cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  MOMO_MTN: 'MTN Mobile Money',
  AIRTEL_MONEY: 'Airtel Money',
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInitials(name: string | null): string {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function toDisplay(inv: RawInvoice, i: number): InvoiceRow {
  const dueDate = inv.dueAt ? new Date(inv.dueAt) : null;
  const isOverdue =
    dueDate !== null && dueDate < new Date() &&
    inv.status !== 'PAID' && inv.status !== 'VOID';
  return {
    id: inv.id,
    number: inv.job?.referenceNumber ?? inv.id.slice(0, 8).toUpperCase(),
    client: inv.organization?.legalName ?? '—',
    clientInitials: toInitials(inv.organization?.legalName ?? null),
    clientAvatarClass: AVATAR_CLASSES[i % AVATAR_CLASSES.length],
    description: JOB_TYPE_LABELS[inv.job?.jobType ?? ''] ?? 'Security services',
    amount: Number(inv.total ?? 0),
    paymentMethod: '—',
    status: inv.status,
    dueDate: dueDate
      ? dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    dueDateClass: isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500',
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SharpBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.DRAFT;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest border ${s.cls}`}>
      {s.label}
    </span>
  );
}

interface StatCardProps {
  topBorder: string;
  label: string;
  value: string;
  change: string;
  positive?: boolean;
  icon: React.ReactNode;
}

function StatCard({ topBorder, label, value, change, positive = true, icon }: StatCardProps) {
  return (
    <div className={`bg-white border border-slate-200 border-t-[3px] ${topBorder} rounded p-4`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        <span className="text-slate-300">{icon}</span>
      </div>
      <p className="font-mono text-[22px] font-bold text-slate-900 leading-none tracking-tight">{value}</p>
      <div className={`flex items-center gap-1 mt-2.5 text-[10px] font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
        {positive ? <TrendingUp className="w-2.5 h-2.5 shrink-0" /> : <TrendingDown className="w-2.5 h-2.5 shrink-0" />}
        <span>{change}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BillingPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [ebm, setEbm] = useState<EbmComplianceInfo | null>(null);
  const [chartData, setChartData] = useState<MonthlyChartPoint[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<BillingTab>('ALL');
  const [page, setPage] = useState(1);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedTxn, setCopiedTxn] = useState<string | null>(null);

  const currentMonthLabel = new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const ebmLastSync = ebm
    ? new Date(ebm.lastSync).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const isPaymentsTab = activeTab === 'PAYMENTS';

  useEffect(() => {
    void fetchBillingOverview()
      .then(({ summary: s, ebm: e }) => { setSummary(s); setEbm(e); })
      .catch(() => null);
    void fetchMonthlyChartData().then(setChartData).catch(() => null);
  }, []);

  useEffect(() => {
    setFetchError(null);
    if (activeTab === 'PAYMENTS') {
      fetchPayments(page, 20)
        .then((res) => {
          setPayments(res.items);
          setTotal(res.meta.total);
        })
        .catch((err: unknown) => {
          setFetchError(err instanceof Error ? err.message : 'Failed to load payments');
        });
    } else {
      fetchInvoices(page, 20, activeTab === 'ALL' ? undefined : activeTab)
        .then((res) => {
          setInvoices(res.items.map(toDisplay));
          setTotal(res.meta.total);
        })
        .catch((err: unknown) => {
          setFetchError(err instanceof Error ? err.message : 'Failed to load invoices');
        });
    }
  }, [activeTab, page]);

  function handleTabChange(tab: BillingTab) { setActiveTab(tab); setPage(1); }

  function handleCopyTxn(txnId: string) {
    void navigator.clipboard.writeText(txnId).then(() => {
      setCopiedTxn(txnId);
      setTimeout(() => setCopiedTxn(null), 1500);
    });
  }

  async function handleIssue(id: string) {
    await issueInvoice(id).catch(() => null);
    const res = await fetchInvoices(page, 20, activeTab === 'ALL' ? undefined : activeTab).catch(() => null);
    if (res) { setInvoices(res.items.map(toDisplay)); setTotal(res.meta.total); }
  }

  async function handleVoid(id: string) {
    await voidInvoice(id).catch(() => null);
    const res = await fetchInvoices(page, 20, activeTab === 'ALL' ? undefined : activeTab).catch(() => null);
    if (res) { setInvoices(res.items.map(toDisplay)); setTotal(res.meta.total); }
  }

  // ── Chart ────────────────────────────────────────────────────────────────────
  const chartOption = useMemo(() => ({
    grid: { left: 52, right: 16, top: 36, bottom: 28 },
    legend: {
      data: ['Revenue', 'Outstanding'],
      top: 0,
      left: 0,
      icon: 'rect',
      itemWidth: 10,
      itemHeight: 4,
      itemGap: 16,
      textStyle: { fontSize: 10, color: '#64748B', fontFamily: "'IBM Plex Sans', sans-serif" },
    },
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: '#0F172A',
      borderColor: '#1E293B',
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
      formatter: (params: { name: string; seriesName: string; value: number }[]) => {
        const rev = params.find(p => p.seriesName === 'Revenue')?.value ?? 0;
        const out = params.find(p => p.seriesName === 'Outstanding')?.value ?? 0;
        const name = params[0]?.name ?? '';
        return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.8">
          <div style="color:#94A3B8;margin-bottom:4px">${name}</div>
          <div><span style="color:#14B87A">■</span> Revenue &nbsp;&nbsp; ${rev}M RWF</div>
          <div><span style="color:#EF4444">■</span> Outstanding ${out}M RWF</div>
        </div>`;
      },
    },
    xAxis: {
      type: 'category' as const,
      data: chartData.map(d => d.month),
      axisLine: { lineStyle: { color: '#E2E8F0' } },
      axisTick: { show: false },
      axisLabel: { color: '#94A3B8', fontSize: 10, fontFamily: "'IBM Plex Sans', sans-serif" },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: '#94A3B8',
        fontSize: 10,
        formatter: (v: number) => `${v}M`,
        fontFamily: "'IBM Plex Sans', sans-serif",
      },
      splitLine: { lineStyle: { color: '#F1F5F9', type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Revenue',
        type: 'bar' as const,
        barWidth: 12,
        barGap: '25%',
        barCategoryGap: '35%',
        data: chartData.map(d => d.revenue),
        itemStyle: { color: '#14B87A', borderRadius: [2, 2, 0, 0] },
      },
      {
        name: 'Outstanding',
        type: 'bar' as const,
        barWidth: 12,
        data: chartData.map(d => d.outstanding),
        itemStyle: { color: '#EF4444', borderRadius: [2, 2, 0, 0] },
      },
    ],
  }), [chartData]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="p-4 space-y-3">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Billing</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Finance · {currentMonthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-200 rounded bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Calendar className="w-3 h-3" /> {currentMonthLabel}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] rounded transition-colors cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" /> Generate invoice
            </button>
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2.5">
          <StatCard
            topBorder="border-t-[#14B87A]"
            label="Total revenue"
            value={formatRWF(summary?.totalRevenue ?? 0)}
            change={`+${summary?.totalRevenueChangePct ?? 0}% vs last month`}
            positive
            icon={<CreditCard className="w-4 h-4" />}
          />
          <StatCard
            topBorder="border-t-red-500"
            label="Outstanding (unpaid)"
            value={formatRWF(summary?.outstanding ?? 0)}
            change={`${summary?.outstandingInvoiceCount ?? 0} invoices pending`}
            positive={false}
            icon={<AlertCircle className="w-4 h-4" />}
          />
          <StatCard
            topBorder="border-t-slate-400"
            label="Payments today"
            value={formatRWF(summary?.paymentsToday ?? 0)}
            change={`${summary?.paymentsTodayCount ?? 0} payments received`}
            positive
            icon={<CreditCard className="w-4 h-4" />}
          />
          <StatCard
            topBorder="border-t-blue-500"
            label="VAT collected · RRA"
            value={formatRWF(summary?.vatCollected ?? 0)}
            change="18% statutory rate"
            positive
            icon={<Receipt className="w-4 h-4" />}
          />
        </div>

        {/* ── Chart + Tax compliance ──────────────────────────────────────────── */}
        {!isPaymentsTab && <div className="grid grid-cols-3 gap-2.5">

          {/* Revenue chart */}
          <div className="col-span-2 bg-white border border-slate-200 rounded overflow-hidden">
            <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2 border-b border-slate-100">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monthly overview</p>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">
                  Revenue vs Outstanding — {new Date().getFullYear()}
                </p>
              </div>
              <p className="text-[9px] text-slate-400 font-mono">RWF millions</p>
            </div>
            <div className="px-2 py-2">
              <ReactECharts option={chartOption} style={{ height: 140 }} />
            </div>
          </div>

          {/* Tax compliance */}
          <div className="bg-white border border-slate-200 border-t-[3px] border-t-blue-500 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tax Compliance</p>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">Rwanda Revenue Authority</p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border border-blue-200 bg-blue-50 text-blue-700 tracking-widest">
                RRA · EBM
              </span>
            </div>
            {ebm ? (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2.5 px-3 py-2 mb-3 bg-emerald-50 border border-emerald-200 rounded">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#14B87A] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-emerald-800 tracking-wide">EBM COMPLIANT</span>
                    <span className="text-[10px] text-slate-500 ml-2">Updated {ebmLastSync}</span>
                  </div>
                  <span className="shrink-0 text-[8px] font-bold text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded bg-emerald-100 uppercase tracking-widest">
                    Active
                  </span>
                </div>

                {(
                  [
                    ['Invoices issued', String(ebm.invoicesIssued)],
                    ['EBM fiscal receipts', String(ebm.ebmReceiptsSent)],
                    ['VAT collected (18%)', formatRWF(ebm.vatCollected)],
                    ['VAT return deadline', ebm.nextFilingDate],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-[10px] text-slate-500">{k}</span>
                    <span className="font-mono text-[10px] font-semibold text-slate-800">{v}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-[10px] text-slate-500">Filing status</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="w-2.5 h-2.5" /> ON TRACK
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-6 flex items-center justify-center">
                <p className="text-[10px] text-slate-400">Loading…</p>
              </div>
            )}
          </div>
        </div>}

        {/* ── Invoice / Payments table ────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">

          {/* Tabs + search */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4">
            <div className="flex">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTabChange(key)}
                  className={`px-3.5 py-3 text-[11px] font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === key
                      ? 'text-slate-900 border-[#14B87A]'
                      : 'text-slate-400 border-transparent hover:text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 my-2 px-2.5 py-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded hover:bg-white transition-colors cursor-pointer"
            >
              <Search className="w-3 h-3" /> Search
            </button>
          </div>

          {fetchError && (
            <div className="mx-4 mt-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">
              {fetchError}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {isPaymentsTab ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Date', 'Organization', 'Invoice', 'Provider', 'Amount', 'Status', 'Txn ID'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && !fetchError && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[11px] text-slate-400">No payments found</td>
                    </tr>
                  )}
                  {payments.map((p) => {
                    const dateStr = p.paidAt ?? p.createdAt;
                    const badge = PAYMENT_STATUS_BADGE[p.status] ?? { cls: 'bg-slate-100 text-slate-500 border-slate-200' };
                    return (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">{p.organizationName ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm">
                            {p.invoiceId ? p.invoiceId.slice(0, 8).toUpperCase() : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600">
                          {PAYMENT_PROVIDER_LABELS[p.provider] ?? p.provider}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {formatRWF(Number(p.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest border ${badge.cls}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.externalTxnId ? (
                            <button
                              type="button"
                              title="Copy transaction ID"
                              aria-label="Copy transaction ID"
                              onClick={() => handleCopyTxn(p.externalTxnId!)}
                              className="flex items-center gap-1 font-mono text-[11px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              {copiedTxn === p.externalTxnId ? 'Copied!' : p.externalTxnId.slice(0, 12)}
                              <Copy className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Invoice #', 'Client', 'Service', 'Amount', 'Status', 'Due', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && !fetchError && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[11px] text-slate-400">
                        No invoices found
                      </td>
                    </tr>
                  )}
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-sm">
                          {inv.number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${inv.clientAvatarClass}`}>
                            {inv.clientInitials}
                          </div>
                          <span className="text-xs font-semibold text-slate-800">{inv.client}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">{inv.description}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {formatRWF(inv.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SharpBadge status={inv.status} />
                      </td>
                      <td className={`px-4 py-3 font-mono text-[11px] ${inv.dueDateClass}`}>
                        {inv.dueDate}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="View invoice"
                            aria-label="View invoice"
                            onClick={() => navigate(`/billing/${inv.id}`)}
                            className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {inv.status === 'DRAFT' && (
                            <button
                              type="button"
                              title="Issue invoice"
                              aria-label="Issue invoice"
                              onClick={() => void handleIssue(inv.id)}
                              className="w-7 h-7 rounded border border-emerald-200 flex items-center justify-center text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {inv.status !== 'PAID' && inv.status !== 'VOID' && inv.status !== 'DISPUTED' && (
                            <button
                              type="button"
                              title="Void invoice"
                              aria-label="Void invoice"
                              onClick={() => void handleVoid(inv.id)}
                              className="w-7 h-7 rounded border border-red-100 flex items-center justify-center text-red-400 bg-red-50 hover:bg-red-100 hover:border-red-300 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wide">
              {total > 0
                ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`
                : 'No records'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] text-slate-500 min-w-[40px] text-center">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
