import type { ActivityItem, ActivityType } from '@/types/job';

const dotColors: Record<ActivityType, string> = {
  ASSIGNMENT: 'bg-green-500',
  REQUEST: 'bg-orange-500',
  BILLING: 'bg-blue-500',
  INCIDENT: 'bg-red-500',
  COMPLETED: 'bg-green-500',
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <div
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[item.type]}`}
          />
          <div>
            <p className="text-sm text-gray-700 leading-snug">{item.description}</p>
            <p className="text-xs text-gray-400 mt-0.5">{item.timestamp}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
