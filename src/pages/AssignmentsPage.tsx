import { Download, Eye, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AssignmentStatusBadge,
  PriorityBadge,
} from '@/components/shared/AssignmentBadges';
import { FilterTabs } from '@/components/shared/FilterTabs';
import { ListPagination } from '@/components/shared/ListPagination';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { cn } from '@/lib/utils';
import { fetchAssignments } from '@/services/api';
import type { AssignmentFilter, AssignmentListItem } from '@/types/assignment';

const TABS: { key: AssignmentFilter; label: string }[] = [
  { key: 'ALL', label: 'All (58)' },
  { key: 'ACTIVE', label: 'Active / On Duty (14)' },
  { key: 'PENDING', label: 'Pending Dispatch (6)' },
  { key: 'COMPLETED', label: 'Completed (35)' },
  { key: 'CANCELED', label: 'Canceled (3)' },
];

function matchesFilter(item: AssignmentListItem, filter: AssignmentFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return item.status === 'ON_DUTY';
  if (filter === 'PENDING') return item.status === 'PENDING';
  if (filter === 'COMPLETED') return item.status === 'COMPLETED';
  return item.status === 'CANCELED';
}

export function AssignmentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [filter, setFilter] = useState<AssignmentFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>('91');

  useEffect(() => {
    void fetchAssignments().then(setItems);
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => matchesFilter(i, filter)),
    [items, filter],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Dispatch Assignments">
        <TopbarButton>
          <Download className="w-3 h-3" /> Export
        </TopbarButton>
        <TopbarButton primary>
          <Plus className="w-3 h-3" /> Create Assignment
        </TopbarButton>
      </PageTopbar>

      <div className="p-4">
        <FilterTabs tabs={TABS} active={filter} onChange={setFilter} />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    'Assignment ID',
                    'Client / Location',
                    'Schedule / Time',
                    'Priority',
                    'Staffing',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedId(row.id);
                      navigate(`/assignments/${row.id}`);
                    }}
                    className={cn(
                      'border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50',
                      selectedId === row.id && 'bg-green-50',
                    )}
                  >
                    <td className="px-3 py-2 text-xs font-semibold text-[#14B87A]">
                      {row.code}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs font-medium text-slate-900">
                        {row.client}
                      </p>
                      <p className="text-[10px] text-slate-400">{row.location}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs text-slate-900">{row.scheduleLabel}</p>
                      <p className="text-[10px] text-slate-400">
                        {row.scheduleTime}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-xs',
                        row.staffingAlert
                          ? 'text-red-500 font-medium'
                          : 'text-slate-600',
                      )}
                    >
                      {row.staffing}
                    </td>
                    <td className="px-3 py-2">
                      <AssignmentStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="flex gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/assignments/${row.id}`)}
                          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                        </button>
                        <button
                          type="button"
                          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
                        >
                          <MoreHorizontal className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination showing={filtered.length} total={58} />
        </div>
      </div>
    </div>
  );
}
