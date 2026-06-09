export type PricingModel = 'HOURLY' | 'FLAT_FEE';

export interface PricingRule {
  id: string;
  priority: number;
  organizationId: string | null;
  district: string | null;
  jobType: string | null;
  pricingModel: PricingModel;
  hourlyRate: number | null;
  flatFee: number | null;
  currency: string;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
}

export type BillingPolicyModel = 'STANDARD' | 'MINIMUM_HOURS' | 'TIERED';

export interface BillingPolicy {
  id: string;
  priority: number;
  organizationId: string | null;
  organization: { id: string; legalName: string; tradingName: string | null } | null;
  jobType: string | null;
  model: BillingPolicyModel;
  minimumHours: number;
  prorationEnabled: boolean;
  allowEarlyRelease: boolean;
  earlyReleaseRequiresClientApproval: boolean;
  autoApproveAfterMinutes: number | null;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
}

export interface ReconciliationRow {
  assignmentId: string;
  jobId: string;
  jobReference: string;
  organizationId: string;
  organizationName: string;
  guardianId: string;
  guardianCode: string;
  guardianName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  arrivedAt: string | null;
  completedAt: string | null;
  scheduledHours: number;
  actualHours: number | null;
  billableHours: number | null;
  billingBasis: string | null;
  invoiceStatus: string | null;
  invoiceTotal: string | null;
  earlyCompletion: boolean;
  lateArrival: boolean;
  earlyReleaseMinutes: number | null;
  lateArrivalMinutes: number | null;
}
