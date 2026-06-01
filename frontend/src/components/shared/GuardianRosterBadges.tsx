import type { GuardianRosterStatus, GuardianVerificationStatus } from '@/types/guardian-roster';
import { cn } from '@/lib/utils';

const rosterStatusStyles: Record<GuardianRosterStatus, string> = {
  ON_DUTY: 'bg-blue-100 text-blue-800',
  AVAILABLE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-slate-100 text-slate-600',
  VETTING_PENDING: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};

const rosterStatusLabels: Record<GuardianRosterStatus, string> = {
  ON_DUTY: 'On Duty',
  AVAILABLE: 'Available',
  INACTIVE: 'Inactive',
  VETTING_PENDING: 'Vetting Pending',
  SUSPENDED: 'Suspended',
};

const vettingStyles: Record<GuardianVerificationStatus, string> = {
  VERIFIED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const vettingLabels: Record<GuardianVerificationStatus, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
};

export function GuardianRosterStatusBadge({
  status,
}: {
  status: GuardianRosterStatus;
}) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
        rosterStatusStyles[status],
      )}
    >
      {rosterStatusLabels[status]}
    </span>
  );
}

export function VettingBadge({ status }: { status: GuardianVerificationStatus }) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
        vettingStyles[status],
      )}
    >
      {vettingLabels[status]}
    </span>
  );
}
