import type { ReactNode } from 'react';

interface PageTopbarProps {
  title?: string;
  breadcrumb?: { parent: string; parentPath?: string; current: string };
  children?: ReactNode;
}

export function PageTopbar({ title, breadcrumb, children }: PageTopbarProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
      {breadcrumb ? (
        <div className="flex items-center gap-1 text-sm">
          <span className="text-slate-500">{breadcrumb.parent}</span>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{breadcrumb.current}</span>
        </div>
      ) : (
        <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
      )}
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function TopbarButton({
  children,
  primary,
  danger,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) {
  const cls = danger
    ? 'flex items-center gap-1.5 bg-red-500 border border-red-500 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50'
    : primary
      ? 'flex items-center gap-1.5 bg-[#14B87A] border border-[#14B87A] text-white rounded-lg px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50'
      : 'flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-600 disabled:opacity-50';

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
