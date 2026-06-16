import { apiGet, apiPost } from '@/lib/api-client';

// Guardian earnings & payouts — admin/ops side.
// Contract from the backend "Guardian earnings & payouts" brief; routes 404
// until the backend ships the migration + seed for this feature.

export type EarningStatus  = 'PENDING_PAYOUT' | 'PAID' | 'BLOCKED' | 'CANCELLED';
export type PayoutProvider = 'MOMO_MTN' | 'AIRTEL_MONEY' | 'BANK_TRANSFER' | 'CASH';
export type PayoutStatus   = 'PENDING' | 'COMPLETED' | 'FAILED';

export const PAYOUT_PROVIDER_LABELS: Record<PayoutProvider, string> = {
  MOMO_MTN:      'MTN MoMo',
  AIRTEL_MONEY:  'Airtel Money',
  BANK_TRANSFER: 'Bank Transfer',
  CASH:          'Cash',
};

export interface GuardianEarningRow {
  id: string;
  jobId: string;
  jobReference: string | null;
  assignmentId: string;
  payableHours: string;
  hourlyPayRate: string;
  amount: string;
  currency: string;
  status: EarningStatus;
  accruedAt: string;
  paidAt: string | null;
  payoutId: string | null;
}

export interface EarningsLedgerResponse {
  items: GuardianEarningRow[];
  meta: { page: number; limit: number; total: number; totalPages?: number; hasMore?: boolean };
}

export interface GuardianPayoutRow {
  id: string;
  amount: string;
  currency: string;
  provider: PayoutProvider;
  status: PayoutStatus;
  externalTxnId: string | null;
  paidAt: string | null;
  createdAt: string;
  guardian?: {
    id: string;
    guardianCode?: string;
    user?: { fullName: string | null } | null;
  } | null;
}

export interface PayoutListResponse {
  items: GuardianPayoutRow[];
  meta: { page: number; limit: number; total: number; totalPages?: number; hasMore?: boolean };
}

export async function fetchGuardianEarnings(
  guardianId: string,
  page = 1,
  limit = 20,
  status?: EarningStatus,
): Promise<EarningsLedgerResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), order: 'desc' });
  if (status) params.set('status', status);
  return apiGet<EarningsLedgerResponse>(`/admin/guardians/${guardianId}/earnings?${params}`);
}

interface RawAdminPayoutRow {
  id: string;
  guardianId?: string;
  guardianCode?: string;
  guardianName?: string;
  amount: string;
  currency: string;
  provider: PayoutProvider;
  status: PayoutStatus;
  externalTxnId: string | null;
  paidAt: string | null;
  createdAt: string;
  // nested shape (guardian-facing endpoint)
  guardian?: { id: string; guardianCode?: string; user?: { fullName: string | null } | null } | null;
}

interface RawPayoutListResponse {
  items: RawAdminPayoutRow[];
  meta: PayoutListResponse['meta'];
}

export async function fetchAllPayouts(page = 1, limit = 20): Promise<PayoutListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), order: 'desc' });
  const raw = await apiGet<RawPayoutListResponse>(`/admin/guardian-payouts?${params}`);
  return {
    meta: raw.meta,
    items: raw.items.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      externalTxnId: p.externalTxnId,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      guardian: p.guardian ?? (p.guardianId
        ? { id: p.guardianId, guardianCode: p.guardianCode, user: { fullName: p.guardianName ?? null } }
        : null),
    })),
  };
}

export async function createGuardianPayout(
  guardianId: string,
  earningIds: string[],
  provider: PayoutProvider,
): Promise<GuardianPayoutRow> {
  return apiPost<GuardianPayoutRow>(`/admin/guardians/${guardianId}/payouts`, {
    earningIds,
    provider,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function confirmGuardianPayout(
  payoutId: string,
  externalTxnId?: string,
): Promise<GuardianPayoutRow> {
  return apiPost<GuardianPayoutRow>(
    `/admin/guardian-payouts/${payoutId}/confirm`,
    externalTxnId ? { externalTxnId } : undefined,
  );
}
