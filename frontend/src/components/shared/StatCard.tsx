import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon?: ReactNode;
  iconBg?: string;
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  deltaLabel: string;
  accentColor?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  delta,
  deltaPositive,
  deltaLabel,
  accentColor,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-slate-200 border-t-[3px] rounded p-4 transition-colors',
        accentColor ?? 'border-t-slate-300',
        onClick && 'cursor-pointer hover:bg-slate-50/80',
      )}
    >
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight mb-2">
        {label}
      </p>
      <p className="font-mono text-2xl font-bold text-slate-900 leading-none tabular-nums">
        {value}
      </p>
      <div className="flex items-center gap-1 mt-2.5">
        {deltaPositive ? (
          <TrendingUp className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5 text-red-500 shrink-0" />
        )}
        {delta && (
          <span className={cn('text-[10px] font-medium', deltaPositive ? 'text-emerald-600' : 'text-red-500')}>
            {delta}
          </span>
        )}
        <span className="text-[10px] text-slate-400 truncate">{deltaLabel}</span>
      </div>
    </div>
  );
}
