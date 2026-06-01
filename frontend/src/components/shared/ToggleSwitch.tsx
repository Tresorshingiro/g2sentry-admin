import { cn } from '@/lib/utils';

export function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-9 h-5 rounded-full relative shrink-0 transition-colors',
        checked ? 'bg-[#14B87A]' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
          checked ? 'right-0.5' : 'left-0.5',
        )}
      />
    </button>
  );
}
