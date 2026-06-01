import { cn } from '@/lib/utils';

interface FilterTab<T extends string> {
  key: T;
  label: string;
}

export function FilterTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: FilterTab<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
            active === key
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
