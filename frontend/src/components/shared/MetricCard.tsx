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
    <div className="bg-white rounded border border-slate-200 p-3.5">
      <div className={cn('w-7 h-7 rounded flex items-center justify-center mb-2.5', iconBg)}>
        {icon}
      </div>
      <p className="font-mono text-xl font-bold text-slate-900 leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</p>
      <div className="flex items-center gap-1 mt-1.5">
        {showUp ? (
          <TrendingUp className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5 text-red-500 shrink-0" />
        )}
        <span className={cn('text-[10px]', showUp ? 'text-emerald-600' : 'text-red-500')}>
          {change}
        </span>
      </div>
    </div>
  );
}
