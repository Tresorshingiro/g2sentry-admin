import type { GuardianStatus } from '@/types/guardian';

const styles: Record<GuardianStatus, string> = {
  ON_DUTY: 'bg-blue-100 text-blue-700',
  AVAILABLE: 'bg-green-100 text-green-700',
  OFFLINE: 'bg-gray-100 text-gray-600',
};

const labels: Record<GuardianStatus, string> = {
  ON_DUTY: 'On duty',
  AVAILABLE: 'Available',
  OFFLINE: 'Offline',
};

export function StatusBadge({ status }: { status: GuardianStatus }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
