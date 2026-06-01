import type { ReactNode } from 'react';

interface ContentCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ContentCard({
  title,
  action,
  children,
  className,
}: ContentCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className ?? ''}`}
    >
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}
