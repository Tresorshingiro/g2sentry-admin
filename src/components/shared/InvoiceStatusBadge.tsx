import type { InvoiceStatus } from '@/types/billing';
import { cn } from '@/lib/utils';

const styles: Record<InvoiceStatus, string> = {
  PAID: 'bg-green-100 text-green-800',
  UNPAID: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
};

const labels: Record<InvoiceStatus, string> = {
  PAID: 'Paid',
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold',
        styles[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
