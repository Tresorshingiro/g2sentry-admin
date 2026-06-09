export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'DISPUTED';
export type InvoiceFilter = 'ALL' | InvoiceStatus;

/** Shape returned by GET /api/v1/admin/invoices items */
export interface RawInvoice {
  id: string;
  status: InvoiceStatus;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  dueAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  organization: { id: string; legalName: string } | null;
  job: { id: string; referenceNumber: string; jobType: string } | null;
}

export interface InvoiceListResponse {
  items: RawInvoice[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface BillingSummary {
  totalRevenue: number;
  totalRevenueChangePct: number;
  outstanding: number;
  outstandingInvoiceCount: number;
  paymentsToday: number;
  paymentsTodayCount: number;
  vatCollected: number;
}

export interface MonthlyRevenueStat {
  month: string;
  valueM: number;
  isCurrent?: boolean;
}

export interface EbmComplianceInfo {
  status: 'compliant' | 'warning';
  lastSync: string;
  invoicesIssued: number;
  ebmReceiptsSent: number;
  vatCollected: number;
  nextFilingDate: string;
}

// ─── Invoice detail (GET /invoices/:id) ──────────────────────────────────────

export interface InvoicePayment {
  id: string;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  externalTxnId: string | null;
  createdAt: string;
}

export interface InvoiceEbmReceipt {
  id: string;
  receiptNumber: string;
  issuedAt: string;
}

export interface InvoiceJobDetail {
  id: string;
  referenceNumber: string;
  jobType: string;
  priority: string;
  status: string;
  requestedGuardianCount: number;
  scheduledStart: string;
  scheduledEnd: string;
  notes: string | null;
  specialInstructions: string | null;
}

export interface InvoiceDetail {
  id: string;
  organizationId: string;
  jobId: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  payments: InvoicePayment[];
  ebmReceipt: InvoiceEbmReceipt | null;
  job: InvoiceJobDetail | null;
  disputeReason: string | null;
  disputedAt: string | null;
  statusBeforeDispute: InvoiceStatus | null;
}

export type InvoiceStatusExtended = InvoiceStatus | 'DISPUTED';

export interface Payment {
  id: string;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  externalTxnId: string | null;
  createdAt: string;
  invoiceId?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface PaymentListResponse {
  items: Payment[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface ResolveDisputePayload {
  action: 'CLEAR' | 'VOID';
  note?: string;
  voidReason?: string;
  replacementInvoiceId?: string;
}

export interface InvoiceRow {
  id: string;
  number: string;
  client: string;
  clientInitials: string;
  clientAvatarClass: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: InvoiceStatus;
  dueDate: string;
  dueDateClass: string;
}
