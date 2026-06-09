import type {
  BillingSummary,
  EbmComplianceInfo,
  InvoiceDetail,
  InvoiceListResponse,
  MonthlyRevenueStat,
  Payment,
  PaymentListResponse,
  ResolveDisputePayload,
} from '@/types/billing';
import { apiGet, apiPost } from '@/lib/api-client';
import type { RawJobFactsDaily } from './analytics';

export interface MonthlyChartPoint {
  month: string;
  revenue: number;
  outstanding: number;
}

export async function fetchBillingOverview(): Promise<{
  summary: BillingSummary;
  ebm: EbmComplianceInfo;
}> {
  type DashboardRes = { totalRevenue: string | number };
  const [dashboard, issuedRes, overdueRes, paidRes] = await Promise.all([
    apiGet<DashboardRes>('/admin/analytics/dashboard'),
    apiGet<InvoiceListResponse>('/admin/invoices?status=ISSUED&page=1&limit=100'),
    apiGet<InvoiceListResponse>('/admin/invoices?status=OVERDUE&page=1&limit=100'),
    apiGet<InvoiceListResponse>('/admin/invoices?status=PAID&page=1&limit=100'),
  ]);

  const outstanding = [...issuedRes.items, ...overdueRes.items].reduce(
    (sum, inv) => sum + Number(inv.total ?? 0), 0,
  );
  const outstandingInvoiceCount = issuedRes.meta.total + overdueRes.meta.total;
  const vatCollected = paidRes.items.reduce((sum, inv) => sum + Number(inv.taxAmount ?? 0), 0);
  const invoicesIssued = issuedRes.meta.total + paidRes.meta.total;
  const ebmFiscalReceipts = paidRes.meta.total;

  const now = new Date();
  const nextFiling = new Date(now.getFullYear(), now.getMonth() + 1, 15);
  const nextFilingDate = nextFiling.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const summary: BillingSummary = {
    totalRevenue: Number(dashboard.totalRevenue ?? 0),
    totalRevenueChangePct: 0,
    outstanding,
    outstandingInvoiceCount,
    paymentsToday: 0,
    paymentsTodayCount: 0,
    vatCollected,
  };

  const ebm: EbmComplianceInfo = {
    status: 'compliant',
    lastSync: new Date().toISOString(),
    invoicesIssued,
    ebmReceiptsSent: ebmFiscalReceipts,
    vatCollected,
    nextFilingDate,
  };

  return { summary, ebm };
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const { summary } = await fetchBillingOverview();
  return summary;
}

export async function fetchMonthlyChartData(): Promise<MonthlyChartPoint[]> {
  const [facts, issuedRes, overdueRes] = await Promise.all([
    apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => [] as RawJobFactsDaily[]),
    apiGet<InvoiceListResponse>('/admin/invoices?status=ISSUED&page=1&limit=100').catch(
      () => ({ items: [], meta: { total: 0, page: 1, limit: 100, hasMore: false } }),
    ),
    apiGet<InvoiceListResponse>('/admin/invoices?status=OVERDUE&page=1&limit=100').catch(
      () => ({ items: [], meta: { total: 0, page: 1, limit: 100, hasMore: false } }),
    ),
  ]);

  const revenueByMonth: Record<string, number> = {};
  facts.forEach((r) => {
    const ym = r.date.slice(0, 7);
    revenueByMonth[ym] = (revenueByMonth[ym] ?? 0) + Number(r.totalRevenue ?? 0);
  });

  const outstandingByMonth: Record<string, number> = {};
  [...issuedRes.items, ...overdueRes.items].forEach((inv) => {
    const ym = (inv.issuedAt ?? inv.createdAt).slice(0, 7);
    outstandingByMonth[ym] = (outstandingByMonth[ym] ?? 0) + Number(inv.total ?? 0);
  });

  const allMonths = new Set([...Object.keys(revenueByMonth), ...Object.keys(outstandingByMonth)]);
  if (allMonths.size === 0) {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      allMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  return [...allMonths]
    .sort()
    .slice(-8)
    .map((ym) => ({
      month: new Date(ym + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      revenue: Math.round((revenueByMonth[ym] ?? 0) / 100_000) / 10,
      outstanding: Math.round((outstandingByMonth[ym] ?? 0) / 100_000) / 10,
    }));
}

export async function fetchMonthlyRevenue(): Promise<MonthlyRevenueStat[]> {
  const rows = await apiGet<RawJobFactsDaily[]>('/admin/analytics/jobs').catch(() => []);
  const byMonth: Record<string, number> = {};
  rows.forEach((r) => {
    const ym = r.date.slice(0, 7);
    byMonth[ym] = (byMonth[ym] ?? 0) + Number(r.totalRevenue ?? 0);
  });
  const currentYM = new Date().toISOString().slice(0, 7);
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([ym, revenue]) => ({
      month: new Date(ym + '-01').toLocaleDateString('en', { month: 'short' }),
      valueM: Math.round(revenue / 100_000) / 10,
      isCurrent: ym === currentYM,
    }));
}

export function fetchEbmCompliance(): Promise<EbmComplianceInfo> {
  return Promise.resolve({
    status: 'compliant',
    lastSync: new Date().toISOString(),
    invoicesIssued: 0,
    ebmReceiptsSent: 0,
    vatCollected: 0,
    nextFilingDate: '—',
  } as EbmComplianceInfo);
}

export async function fetchInvoices(
  page = 1,
  limit = 20,
  status?: string,
): Promise<InvoiceListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'ALL') params.set('status', status);
  return apiGet<InvoiceListResponse>(`/admin/invoices?${params}`);
}

export async function issueInvoice(id: string): Promise<unknown> {
  return apiPost(`/invoices/${id}/issue`);
}

export async function voidInvoice(id: string): Promise<unknown> {
  return apiPost(`/invoices/${id}/void`);
}

export async function fetchInvoiceById(id: string): Promise<InvoiceDetail> {
  const inv = await apiGet<InvoiceDetail>(`/invoices/${id}`);
  return { ...inv, payments: inv.payments ?? [] };
}

export async function fetchPayments(page = 1, limit = 20): Promise<PaymentListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const raw = await apiGet<Payment[] | PaymentListResponse>(`/admin/payments?${params}`);
  if (Array.isArray(raw)) {
    return { items: raw, meta: { page, limit, total: raw.length, hasMore: raw.length === limit } };
  }
  return raw;
}

export async function resolveDispute(id: string, data: ResolveDisputePayload): Promise<unknown> {
  return apiPost(`/admin/invoices/${id}/resolve-dispute`, data);
}
