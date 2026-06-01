import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  icon: ReactNode;
  iconBg: string;
  value: string;
  label: string;
  change: string;
  positive?: boolean;
  invertedTrend?: boolean;
}

export function MetricCard({
  icon,
  iconBg,
  value,
  label,
  change,
  positive = true,
  invertedTrend = false,
}: MetricCardProps) {
  const showUp = invertedTrend ? !positive : positive;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center mb-2',
          iconBg,
        )}
      >
        {icon}
      </div>
      <p className="text-xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
      <div className="flex items-center gap-1 mt-1">
        {showUp ? (
          <TrendingUp className="w-2.5 h-2.5 text-green-600" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5 text-red-500" />
        )}
        <span
          className={cn(
            'text-[10px]',
            showUp ? 'text-green-600' : 'text-red-500',
          )}
        >
          {change}
        </span>
      </div>
    </div>
  );
}
