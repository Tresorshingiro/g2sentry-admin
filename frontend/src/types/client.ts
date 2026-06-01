export type ClientVerificationStatus = 'VERIFIED' | 'PENDING' | 'REJECTED';
export type ClientFilter = 'ALL' | 'VERIFIED' | 'PENDING' | 'REJECTED';

export interface ClientListItem {
  id: string;
  legalName: string;
  tradingName: string | null;
  tinNumber: string | null;
  orgType: string | null;
  verificationStatus: ClientVerificationStatus;
  createdAt: string;
  primaryDistrict: string | null;
  activeJobCount: number;
  outstandingBalance: number;
}

export interface ClientListResponse {
  items: ClientListItem[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
  statusCounts: Partial<Record<ClientVerificationStatus, number>>;
}
