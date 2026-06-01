export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'VOID';
export type InvoiceFilter = 'ALL' | InvoiceStatus;

export interface RawInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  organization: { id: string; legalName: string } | null;
  totalAmount: string;
  dueDate: string | null;
  issuedAt: string | null;
  createdAt: string;
  items?: { description: string }[];
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
