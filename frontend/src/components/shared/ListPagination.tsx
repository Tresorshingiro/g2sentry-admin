import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ListPagination({
  showing,
  total,
  page = 1,
}: {
  showing: number;
  total: number;
  page?: number;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200">
      <span className="text-[11px] text-slate-500">
        Showing 1–{showing} of {total}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
        >
          <ChevronLeft className="w-3 h-3 text-slate-600" />
        </button>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={cn(
              'w-6 h-6 rounded-md text-[11px] flex items-center justify-center',
              n === page
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 border border-slate-200 text-slate-600',
            )}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
        >
          <ChevronRight className="w-3 h-3 text-slate-600" />
        </button>
      </div>
    </div>
  );
}
