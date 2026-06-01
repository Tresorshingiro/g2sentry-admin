import type { InvoiceStatus } from '@/types/billing';
import { cn } from '@/lib/utils';

const styles: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ISSUED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800',
  VOID: 'bg-slate-100 text-slate-400',
};

const labels: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partial',
  OVERDUE: 'Overdue',
  VOID: 'Void',
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
