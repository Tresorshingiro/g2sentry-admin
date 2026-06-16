import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn() }));

import { apiGet } from '@/lib/api-client';
import {
  fetchBillingOverview,
  fetchInvoiceById,
  fetchPayments,
} from '@/services/api/billing';

const mockApiGet = vi.mocked(apiGet);

beforeEach(() => vi.clearAllMocks());

// ─── fetchInvoiceById ─────────────────────────────────────────────────────────

function makeRawInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    organizationId: 'org-1',
    jobId: 'job-1',
    status: 'ISSUED',
    currency: 'RWF',
    amounts: { subtotal: '80000', tax: '14400', total: '94400' },
    job: { referenceNumber: 'JOB-001', status: 'COMPLETED' },
    payments: [] as { id: string; status: string; provider: string; amount: string }[],
    issuedAt: '2024-03-01T00:00:00Z',
    dueAt: '2024-03-31T00:00:00Z',
    createdAt: '2024-02-28T00:00:00Z',
    ...overrides,
  };
}

describe('fetchInvoiceById — amounts normalization', () => {
  it('maps amounts.subtotal → subtotal', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice());
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.subtotal).toBe('80000');
  });

  it('maps amounts.tax → taxAmount', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice());
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.taxAmount).toBe('14400');
  });

  it('maps amounts.total → total', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice());
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.total).toBe('94400');
  });
});

describe('fetchInvoiceById — dispute fields', () => {
  it('maps dispute reason and timestamp when dispute is present', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice({
      dispute: {
        reason: 'Overcharged for services',
        disputedAt: '2024-03-05T00:00:00Z',
        statusBeforeDispute: 'ISSUED',
      },
    }));
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.disputeReason).toBe('Overcharged for services');
    expect(inv.disputedAt).toBe('2024-03-05T00:00:00Z');
    expect(inv.statusBeforeDispute).toBe('ISSUED');
  });

  it('returns null for all dispute fields when no dispute', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice());
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.disputeReason).toBeNull();
    expect(inv.disputedAt).toBeNull();
    expect(inv.statusBeforeDispute).toBeNull();
  });

  it('handles dispute with null statusBeforeDispute', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice({
      dispute: { reason: 'Wrong amount', disputedAt: '2024-03-05T00:00:00Z', statusBeforeDispute: null },
    }));
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.statusBeforeDispute).toBeNull();
  });
});

describe('fetchInvoiceById — payments', () => {
  it('injects parent currency into each payment', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice({
      currency: 'RWF',
      payments: [{ id: 'pay-1', status: 'COMPLETED', provider: 'MOMO_MTN', amount: '94400' }],
    }));
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.payments[0].currency).toBe('RWF');
  });

  it('sets paidAt and externalTxnId to null', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice({
      payments: [{ id: 'pay-1', status: 'COMPLETED', provider: 'BANK_TRANSFER', amount: '50000' }],
    }));
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.payments[0].paidAt).toBeNull();
    expect(inv.payments[0].externalTxnId).toBeNull();
  });

  it('returns empty payments array when none present', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice({ payments: [] }));
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.payments).toHaveLength(0);
  });

  it('handles missing payments field', async () => {
    const { payments: _drop, ...noPayments } = makeRawInvoice();
    mockApiGet.mockResolvedValue(noPayments);
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.payments).toHaveLength(0);
  });
});

describe('fetchInvoiceById — other fields', () => {
  it('sets ebmReceipt to null', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice());
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.ebmReceipt).toBeNull();
  });

  it('preserves job reference number and status', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice({
      job: { referenceNumber: 'JOB-999', status: 'COMPLETED' },
    }));
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.job.referenceNumber).toBe('JOB-999');
    expect(inv.job.status).toBe('COMPLETED');
    expect(inv.job.id).toBe('job-1');
  });

  it('passes through scalar fields unchanged', async () => {
    mockApiGet.mockResolvedValue(makeRawInvoice());
    const inv = await fetchInvoiceById('inv-1');
    expect(inv.id).toBe('inv-1');
    expect(inv.organizationId).toBe('org-1');
    expect(inv.jobId).toBe('job-1');
    expect(inv.status).toBe('ISSUED');
    expect(inv.currency).toBe('RWF');
    expect(inv.issuedAt).toBe('2024-03-01T00:00:00Z');
    expect(inv.dueAt).toBe('2024-03-31T00:00:00Z');
    expect(inv.createdAt).toBe('2024-02-28T00:00:00Z');
  });
});

// ─── fetchPayments ────────────────────────────────────────────────────────────

describe('fetchPayments', () => {
  it('wraps a plain array response in a paginated envelope', async () => {
    const arr = [
      { id: 'p1', status: 'COMPLETED', provider: 'CASH',     amount: '5000'  },
      { id: 'p2', status: 'PENDING',   provider: 'MOMO_MTN', amount: '10000' },
    ];
    mockApiGet.mockResolvedValue(arr);
    const result = await fetchPayments();
    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.page).toBe(1);
  });

  it('passes through a paginated response object unchanged', async () => {
    const paginated = {
      items: [{ id: 'p1' }],
      meta: { page: 2, limit: 20, total: 21, hasMore: false },
    };
    mockApiGet.mockResolvedValue(paginated);
    const result = await fetchPayments(2, 20);
    expect(result).toEqual(paginated);
  });
});

// ─── fetchBillingOverview ─────────────────────────────────────────────────────

function makeInvoiceList(
  items: { total?: string; taxAmount?: string }[],
  total = items.length,
) {
  return {
    items: items.map((it, i) => ({ id: String(i), ...it })),
    meta: { page: 1, limit: 100, total, hasMore: false },
  };
}

describe('fetchBillingOverview', () => {
  it('sums outstanding from ISSUED + OVERDUE invoices', async () => {
    mockApiGet
      .mockResolvedValueOnce({ totalRevenue: '0' })
      .mockResolvedValueOnce(makeInvoiceList([{ total: '30000' }, { total: '20000' }])) // issued
      .mockResolvedValueOnce(makeInvoiceList([{ total: '10000' }]))                     // overdue
      .mockResolvedValueOnce(makeInvoiceList([]));                                       // paid

    const { summary } = await fetchBillingOverview();
    expect(summary.outstanding).toBe(60_000);
  });

  it('counts outstanding invoices from meta totals', async () => {
    mockApiGet
      .mockResolvedValueOnce({ totalRevenue: '0' })
      .mockResolvedValueOnce(makeInvoiceList([{ total: '1' }, { total: '2' }], 5)) // issued meta.total = 5
      .mockResolvedValueOnce(makeInvoiceList([{ total: '3' }], 3))                 // overdue meta.total = 3
      .mockResolvedValueOnce(makeInvoiceList([]));

    const { summary } = await fetchBillingOverview();
    expect(summary.outstandingInvoiceCount).toBe(8);
  });

  it('sums vatCollected from PAID invoice taxAmounts', async () => {
    mockApiGet
      .mockResolvedValueOnce({ totalRevenue: '0' })
      .mockResolvedValueOnce(makeInvoiceList([]))
      .mockResolvedValueOnce(makeInvoiceList([]))
      .mockResolvedValueOnce(makeInvoiceList([
        { total: '94400', taxAmount: '14400' },
        { total: '47200', taxAmount: '7200'  },
      ]));

    const { summary } = await fetchBillingOverview();
    expect(summary.vatCollected).toBe(21_600);
  });

  it('parses totalRevenue from the dashboard as a number', async () => {
    mockApiGet
      .mockResolvedValueOnce({ totalRevenue: '1500000' })
      .mockResolvedValueOnce(makeInvoiceList([]))
      .mockResolvedValueOnce(makeInvoiceList([]))
      .mockResolvedValueOnce(makeInvoiceList([]));

    const { summary } = await fetchBillingOverview();
    expect(summary.totalRevenue).toBe(1_500_000);
  });

  it('handles zero / missing values gracefully', async () => {
    mockApiGet
      .mockResolvedValueOnce({ totalRevenue: null })
      .mockResolvedValueOnce(makeInvoiceList([]))
      .mockResolvedValueOnce(makeInvoiceList([]))
      .mockResolvedValueOnce(makeInvoiceList([]));

    const { summary } = await fetchBillingOverview();
    expect(summary.totalRevenue).toBe(0);
    expect(summary.outstanding).toBe(0);
    expect(summary.vatCollected).toBe(0);
  });
});
