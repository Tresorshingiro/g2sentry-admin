import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Eye,
  FilePlus,
  Search,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ContentCard } from '@/components/shared/ContentCard';
import { InvoiceStatusBadge } from '@/components/shared/InvoiceStatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatRWF } from '@/lib/utils';
import {
  fetchBillingSummary,
  fetchEbmCompliance,
  fetchInvoices,
  fetchMonthlyRevenue,
  issueInvoice,
  voidInvoice,
} from '@/services/api';
import type {
  BillingSummary,
  EbmComplianceInfo,
  InvoiceFilter,
  InvoiceRow,
  MonthlyRevenueStat,
  RawInvoice,
} from '@/types/billing';

const TABS: { key: InvoiceFilter; label: string }[] = [
  { key: 'ALL', label: 'All invoices' },
  { key: 'ISSUED', label: 'Issued' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'DRAFT', label: 'Draft' },
];

const AVATAR_CLASSES = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
];

function toInitials(name: string | null): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function toDisplay(inv: RawInvoice, i: number): InvoiceRow {
  const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
  const isOverdue =
    dueDate !== null &&
    dueDate < new Date() &&
    inv.status !== 'PAID' &&
    inv.status !== 'VOID';
  return {
    id: inv.id,
    number: inv.invoiceNumber,
    client: inv.organization?.legalName ?? '—',
    clientInitials: toInitials(inv.organization?.legalName ?? null),
    clientAvatarClass: AVATAR_CLASSES[i % AVATAR_CLASSES.length],
    description: inv.items?.[0]?.description ?? 'Security services',
    amount: Number(inv.totalAmount ?? 0),
    paymentMethod: '—',
    status: inv.status,
    dueDate: dueDate ? dueDate.toLocaleDateString() : '—',
    dueDateClass: isOverdue ? 'text-red-500 font-medium' : 'text-slate-500',
  };
}

export function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenueStat[]>([]);
  const [ebm, setEbm] = useState<EbmComplianceInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<InvoiceFilter>('ALL');
  const [page, setPage] = useState(1);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    void fetchBillingSummary().then(setSummary).catch(() => null);
    void fetchMonthlyRevenue().then(setMonthly);
    void fetchEbmCompliance().then(setEbm);
  }, []);

  useEffect(() => {
    setFetchError(null);
    fetchInvoices(page, 20, activeTab === 'ALL' ? undefined : activeTab)
      .then((res) => {
        setInvoices(res.items.map(toDisplay));
        setTotal(res.meta.total);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load invoices');
      });
  }, [activeTab, page]);

  function handleTabChange(tab: InvoiceFilter) {
    setActiveTab(tab);
    setPage(1);
  }

  async function handleIssue(id: string) {
    await issueInvoice(id).catch(() => null);
    const res = await fetchInvoices(page, 20, activeTab === 'ALL' ? undefined : activeTab).catch(() => null);
    if (res) {
      setInvoices(res.items.map(toDisplay));
      setTotal(res.meta.total);
    }
  }

  async function handleVoid(id: string) {
    await voidInvoice(id).catch(() => null);
    const res = await fetchInvoices(page, 20, activeTab === 'ALL' ? undefined : activeTab).catch(() => null);
    if (res) {
      setInvoices(res.items.map(toDisplay));
      setTotal(res.meta.total);
    }
  }

  const revenueChartOption = useMemo(
    () => ({
      grid: { left: 0, right: 0, top: 16, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: monthly.map((m) => m.month),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10 },
      },
      yAxis: { type: 'value' as const, show: false, max: 10 },
      series: [
        {
          type: 'bar' as const,
          data: monthly.map((m) => ({
            value: m.valueM,
            itemStyle: {
              color: m.isCurrent
                ? '#14B87A'
                : m.valueM > 0
                  ? '#BBF7D0'
                  : '#F1F5F9',
              borderRadius: [4, 4, 0, 0],
            },
          })),
          label: {
            show: true,
            position: 'top' as const,
            formatter: (p: { value: number }) =>
              p.value > 0 ? `${p.value}M` : '',
            fontSize: 9,
            color: '#475569',
          },
        },
      ],
    }),
    [monthly],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <Calendar className="w-3.5 h-3.5" /> May 2026
          </button>
          <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors cursor-pointer">
            <FilePlus className="w-3.5 h-3.5" /> Generate invoice
          </button>
        </div>
        {summary && (
          <div className="grid grid-cols-4 gap-2.5">
            <MetricCard
              icon={<DollarSign className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={formatRWF(summary.totalRevenue ?? 0)}
              label="Total revenue · May"
              change={`+${summary.totalRevenueChangePct ?? 0}% vs April`}
            />
            <MetricCard
              icon={<AlertCircle className="w-4 h-4 text-red-500" />}
              iconBg="bg-red-100"
              value={formatRWF(summary.outstanding ?? 0)}
              label="Outstanding (unpaid)"
              change={`${summary.outstandingInvoiceCount ?? 0} invoices pending`}
              positive={false}
            />
            <MetricCard
              icon={<CreditCard className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              value={formatRWF(summary.paymentsToday ?? 0)}
              label="Payments received today"
              change={`+${summary.paymentsTodayCount ?? 0} payments today`}
            />
            <MetricCard
              icon={<CheckCircle2 className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={formatRWF(summary.vatCollected ?? 0)}
              label="VAT collected (RRA)"
              change="EBM compliant"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <ContentCard title="Monthly revenue — 2026">
              {monthly.length > 0 && (
                <ReactECharts
                  option={revenueChartOption}
                  style={{ height: 120 }}
                />
              )}
              <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                <span>RWF millions</span>
              </div>
            </ContentCard>
          </div>
          <ContentCard title="RRA EBM compliance">
            {ebm && (
              <>
                <div className="flex items-center gap-2.5 p-3 mb-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#14B87A]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-800">
                      System compliant
                    </p>
                    <p className="text-[11px] text-[#14B87A]">
                      Last sync: {new Date(ebm.lastSync).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {[
                  ['Invoices issued', String(ebm.invoicesIssued)],
                  ['EBM receipts sent', String(ebm.ebmReceiptsSent)],
                  ['VAT collected', formatRWF(ebm.vatCollected)],
                  ['Next filing date', ebm.nextFilingDate],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between py-2 border-b border-slate-50 last:border-0 text-[11px]"
                  >
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
              </>
            )}
          </ContentCard>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 border-b border-slate-200">
            <div className="flex">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTabChange(key)}
                  className={`px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? 'text-slate-900 border-[#14B87A]'
                      : 'text-slate-400 border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="flex items-center gap-1 my-2 px-2.5 py-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <Search className="w-3 h-3" /> Search invoices
            </button>
          </div>

          {fetchError && (
            <div className="mx-3.5 mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    'Invoice #',
                    'Client',
                    'Description',
                    'Amount',
                    'Status',
                    'Due date',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-3 py-2 text-[11px] text-slate-400">
                      {inv.number}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold ${inv.clientAvatarClass}`}
                        >
                          {inv.clientInitials}
                        </div>
                        <span className="text-xs font-medium text-slate-900">
                          {inv.client}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {inv.description}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold">
                      {formatRWF(inv.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className={`px-3 py-2 text-[11px] ${inv.dueDateClass}`}>
                      {inv.dueDate}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                        </button>
                        {inv.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => void handleIssue(inv.id)}
                            className="w-6 h-6 rounded-md bg-green-50 border border-green-200 flex items-center justify-center"
                            title="Issue invoice"
                          >
                            <CheckCircle2 className="w-3 h-3 text-[#14B87A]" />
                          </button>
                        )}
                        {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                          <button
                            type="button"
                            onClick={() => void handleVoid(inv.id)}
                            className="w-6 h-6 rounded-md bg-red-50 border border-red-200 flex items-center justify-center"
                            title="Void invoice"
                          >
                            <XCircle className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200">
            <span className="text-[11px] text-slate-500">
              Showing {invoices.length} of {total} invoices
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
