import { Building2, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatRWF } from '@/lib/utils';
import { fetchClients } from '@/services/api';
import type { ClientFilter, ClientListItem, ClientVerificationStatus } from '@/types/client';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
  'bg-cyan-100 text-cyan-700',
];

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function sinceLabel(iso: string): string {
  const d = new Date(iso);
  return `Since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function orgTypeLabel(t: string | null): string {
  if (!t) return '—';
  return t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');
}

function StatusBadge({ status }: { status: ClientVerificationStatus }) {
  const map: Record<ClientVerificationStatus, { label: string; cls: string }> = {
    VERIFIED: { label: 'Active', cls: 'bg-green-100 text-green-700' },
    PENDING:  { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
    REJECTED: { label: 'Suspended', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

interface TabDef { key: ClientFilter; label: string; statusKey?: ClientVerificationStatus }

const TABS: TabDef[] = [
  { key: 'ALL',      label: 'All' },
  { key: 'VERIFIED', label: 'Active',    statusKey: 'VERIFIED' },
  { key: 'REJECTED', label: 'Suspended', statusKey: 'REJECTED' },
  { key: 'PENDING',  label: 'Pending',   statusKey: 'PENDING' },
];

export function ClientsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<ClientVerificationStatus, number>>>({});
  const [filter, setFilter] = useState<ClientFilter>('ALL');
  const [page, setPage] = useState(1);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchError(null);
    const status = filter === 'ALL' ? undefined : filter;
    fetchClients(page, LIMIT, status)
      .then((res) => {
        setItems(res.items);
        setTotal(res.meta.total);
        setStatusCounts(res.statusCounts);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load clients');
      });
  }, [filter, page]);

  function handleFilterChange(f: ClientFilter) {
    setFilter(f);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const showingFrom = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const showingTo = Math.min(page * LIMIT, total);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="p-5">
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {TABS.map(({ key, label, statusKey }) => {
            const count = key === 'ALL'
              ? Object.values(statusCounts).reduce((s, n) => s + (n ?? 0), 0)
              : (statusKey ? (statusCounts[statusKey] ?? 0) : 0);
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleFilterChange(key)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 border border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                {label} ({count})
              </button>
            );
          })}
          <div className="ml-2 flex items-center gap-2">
            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-full bg-white hover:bg-slate-50">
              <Building2 className="w-3.5 h-3.5" /> District
            </button>
            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-full bg-white hover:bg-slate-50">
              Category
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Business', 'TIN', 'Category', 'District', 'Active jobs', 'Balance', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    {/* Business */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0',
                          AVATAR_COLORS[i % AVATAR_COLORS.length],
                        )}>
                          {initials(row.legalName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{row.legalName}</p>
                          <p className="text-xs text-slate-400">{sinceLabel(row.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    {/* TIN */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {row.tinNumber ?? '—'}
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {orgTypeLabel(row.orgType)}
                    </td>
                    {/* District */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {row.primaryDistrict ?? '—'}
                    </td>
                    {/* Active jobs */}
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      {row.activeJobCount}
                    </td>
                    {/* Balance */}
                    <td className="px-4 py-3 text-sm font-semibold text-red-500">
                      {formatRWF(row.outstandingBalance)}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={row.verificationStatus} />
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${row.id}`)}
                        className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !fetchError && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                      No clients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Showing {showingFrom}–{showingTo} of {total} clients
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'w-7 h-7 rounded-md text-xs font-medium border transition-colors',
                    page === n
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
