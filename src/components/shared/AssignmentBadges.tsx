import type { AssignmentPriority, AssignmentStatus } from '@/types/assignment';
import { cn } from '@/lib/utils';

const priorityStyles: Record<AssignmentPriority, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-green-100 text-green-800',
};

const statusStyles: Record<AssignmentStatus, string> = {
  ON_DUTY: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<AssignmentStatus, string> = {
  ON_DUTY: 'On Duty',
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
};

export function PriorityBadge({ priority }: { priority: AssignmentPriority }) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
        priorityStyles[priority],
      )}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

export function AssignmentStatusBadge({
  status,
}: {
  status: AssignmentStatus;
}) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
