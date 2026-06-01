import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  deltaLabel: string;
}

export function StatCard({
  icon,
  iconBg,
  label,
  value,
  delta,
  deltaPositive,
  deltaLabel,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div
        className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center mb-3`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      <div className="flex items-center gap-1 mt-2">
        {deltaPositive ? (
          <TrendingUp className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        )}
        <span
          className={`text-xs font-medium ${
            deltaPositive ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {delta}
        </span>
        <span className="text-xs text-gray-400">{deltaLabel}</span>
      </div>
    </div>
  );
}
