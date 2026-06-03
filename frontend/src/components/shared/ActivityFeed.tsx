import type { ActivityItem, ActivityType } from '@/types/job';

const dotColors: Record<ActivityType, string> = {
  ASSIGNMENT: 'bg-[#14B87A]',
  REQUEST:    'bg-amber-400',
  BILLING:    'bg-blue-500',
  INCIDENT:   'bg-red-500',
  COMPLETED:  'bg-[#14B87A]',
};

const typeLabel: Record<ActivityType, string> = {
  ASSIGNMENT: 'Assignment',
  REQUEST:    'Request',
  BILLING:    'Billing',
  INCIDENT:   'Incident',
  COMPLETED:  'Completed',
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 group">
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColors[item.type]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-700 leading-snug">{item.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {typeLabel[item.type]}
              </span>
              <span className="text-[9px] text-slate-300">·</span>
              <span className="font-mono text-[10px] text-slate-400">{item.timestamp}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
