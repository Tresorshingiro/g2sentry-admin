import { Download, Eye, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterTabs } from '@/components/shared/FilterTabs';
import {
  GuardianRosterStatusBadge,
  VettingBadge,
} from '@/components/shared/GuardianRosterBadges';
import { ListPagination } from '@/components/shared/ListPagination';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { cn } from '@/lib/utils';
import { fetchGuardianRoster } from '@/services/api';
import type { GuardianFilter, GuardianListItem } from '@/types/guardian-roster';

const TABS: { key: GuardianFilter; label: string }[] = [
  { key: 'ALL', label: 'All (142)' },
  { key: 'ACTIVE', label: 'Active & On Duty (14)' },
  { key: 'AVAILABLE', label: 'Standby / Available (98)' },
  { key: 'VETTING', label: 'Vetting Pending (12)' },
  { key: 'SUSPENDED', label: 'Suspended (3)' },
];

function matchesFilter(item: GuardianListItem, filter: GuardianFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return item.status === 'ON_DUTY';
  if (filter === 'AVAILABLE') return item.status === 'AVAILABLE';
  if (filter === 'VETTING') return item.status === 'VETTING_PENDING';
  return item.status === 'SUSPENDED';
}

export function GuardiansPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GuardianListItem[]>([]);
  const [filter, setFilter] = useState<GuardianFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>('284');

  useEffect(() => {
    void fetchGuardianRoster().then(setItems);
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => matchesFilter(i, filter)),
    [items, filter],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Guardian Roster">
        <TopbarButton>
          <Download className="w-3 h-3" /> Export CSV
        </TopbarButton>
        <TopbarButton primary onClick={() => navigate('/guardians/new')}>
          <Plus className="w-3 h-3" /> Register Guardian
        </TopbarButton>
      </PageTopbar>

      <div className="p-4">
        <FilterTabs tabs={TABS} active={filter} onChange={setFilter} />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    'Name / ID',
                    'Status',
                    'District',
                    'Shifts',
                    'Rating',
                    'Vetting (RNP)',
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
                      navigate(`/guardians/${row.id}`);
                    }}
                    className={cn(
                      'border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50',
                      selectedId === row.id && 'bg-green-50',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold',
                            row.avatarClass,
                          )}
                        >
                          {row.initials}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900">
                            {row.name}
                          </p>
                          <p className="text-[10px] text-slate-400">{row.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <GuardianRosterStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {row.district}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium">
                      {row.shifts}
                    </td>
                    <td className="px-3 py-2">
                      {row.rating > 0 ? (
                        <>
                          <p className="text-[11px] font-semibold text-slate-900 mb-1">
                            {row.rating}/5
                          </p>
                          <div className="h-1 w-14 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#14B87A] rounded-full"
                              style={{ width: `${row.ratingPct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <VettingBadge status={row.vetting} />
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="flex gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/guardians/${row.id}`)}
                          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                        </button>
                        <button
                          type="button"
                          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
                        >
                          <Pencil className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination showing={filtered.length} total={142} />
        </div>
      </div>
    </div>
  );
}
