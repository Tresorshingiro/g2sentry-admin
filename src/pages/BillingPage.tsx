import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Eye,
  FilePlus,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { ContentCard } from '@/components/shared/ContentCard';
import { InvoiceStatusBadge } from '@/components/shared/InvoiceStatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { formatRWF } from '@/lib/utils';
import {
  fetchBillingSummary,
  fetchEbmCompliance,
  fetchInvoices,
  fetchMonthlyRevenue,
} from '@/services/api';
import type {
  BillingSummary,
  EbmComplianceInfo,
  InvoiceFilter,
  InvoiceRow,
  MonthlyRevenueStat,
} from '@/types/billing';

const TABS: { key: InvoiceFilter; label: string }[] = [
  { key: 'ALL', label: 'All invoices (58)' },
  { key: 'UNPAID', label: 'Unpaid (14)' },
  { key: 'PAID', label: 'Paid (40)' },
  { key: 'PARTIAL', label: 'Partial (4)' },
];

export function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenueStat[]>([]);
  const [ebm, setEbm] = useState<EbmComplianceInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [activeTab, setActiveTab] = useState<InvoiceFilter>('ALL');

  useEffect(() => {
    void fetchBillingSummary().then(setSummary);
    void fetchMonthlyRevenue().then(setMonthly);
    void fetchEbmCompliance().then(setEbm);
    void fetchInvoices().then(setInvoices);
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return invoices;
    return invoices.filter((i) => i.status === activeTab);
  }, [invoices, activeTab]);

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
      <PageTopbar title="Billing & Revenue">
        <TopbarButton>
          <Calendar className="w-3 h-3" /> May 2026
        </TopbarButton>
        <TopbarButton primary>
          <FilePlus className="w-3 h-3" /> Generate invoice
        </TopbarButton>
      </PageTopbar>

      <div className="p-4 space-y-3">
        {summary && (
          <div className="grid grid-cols-4 gap-2.5">
            <MetricCard
              icon={<DollarSign className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={formatRWF(summary.totalRevenue)}
              label="Total revenue · May"
              change={`+${summary.totalRevenueChangePct}% vs April`}
            />
            <MetricCard
              icon={<AlertCircle className="w-4 h-4 text-red-500" />}
              iconBg="bg-red-100"
              value={formatRWF(summary.outstanding)}
              label="Outstanding (unpaid)"
              change={`${summary.outstandingInvoiceCount} invoices pending`}
              positive={false}
            />
            <MetricCard
              icon={<CreditCard className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              value={formatRWF(summary.paymentsToday)}
              label="Payments received today"
              change={`+${summary.paymentsTodayCount} payments today`}
            />
            <MetricCard
              icon={<CheckCircle2 className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              value={formatRWF(summary.vatCollected)}
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
                <span className="text-green-600 font-medium">
                  Peak: May (8.4M)
                </span>
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
                      Last sync: {ebm.lastSync}
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
                  onClick={() => setActiveTab(key)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    'Invoice #',
                    'Client',
                    'Description',
                    'Amount',
                    'Payment method',
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
                {filtered.map((inv) => (
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
                    <td className="px-3 py-2 text-[11px] text-slate-500">
                      {inv.paymentMethod}
                    </td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td
                      className={`px-3 py-2 text-[11px] ${inv.dueDateClass}`}
                    >
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
                        {inv.status !== 'PAID' && (
                          <button
                            type="button"
                            className="w-6 h-6 rounded-md bg-green-50 border border-green-200 flex items-center justify-center"
                          >
                            <CheckCircle2 className="w-3 h-3 text-[#14B87A]" />
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
              Showing 1–{filtered.length} of 58 invoices
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`w-6 h-6 rounded-md text-[11px] flex items-center justify-center ${
                    n === 1
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
