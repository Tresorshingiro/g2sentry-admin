import { Building2, ChevronDown, Eye, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatRWF } from '@/lib/utils';
import { fetchClients } from '@/services/api';
import type { ClientFilter, ClientListItem, ClientVerificationStatus } from '@/types/client';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

const AVATAR_COLORS = [
  'bg-blue-700 text-white',
  'bg-purple-700 text-white',
  'bg-green-700 text-white',
  'bg-orange-600 text-white',
  'bg-red-700 text-white',
  'bg-cyan-700 text-white',
];

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function sinceLabel(iso: string): string {
  return `Since ${new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function orgTypeLabel(t: string | null): string {
  if (!t) return '—';
  return t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, ' ');
}

// ── Stat card (status filter) ─────────────────────────────────────────────────
function StatCard({
  label, value, accentColor, onClick, active,
}: {
  label: string;
  value: number | null;
  accentColor: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col px-4 py-3.5 bg-white border border-slate-200 border-t-[3px] rounded text-left transition-colors cursor-pointer w-full',
        accentColor,
        active ? 'ring-2 ring-[#14B87A]/25' : 'hover:bg-slate-50/80',
      )}
    >
      <p className="font-mono text-2xl font-bold text-slate-900 leading-none tabular-nums">
        {value === null ? <span className="text-slate-300">—</span> : value}
      </p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">{label}</p>
    </button>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ClientVerificationStatus }) {
  const map: Record<ClientVerificationStatus, { label: string; cls: string }> = {
    VERIFIED: { label: 'Active',    cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' },
    PENDING:  { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    REJECTED: { label: 'Suspended', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold', cls)}>
      {label}
    </span>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
interface TabDef { key: ClientFilter; label: string; statusKey?: ClientVerificationStatus }
const TABS: TabDef[] = [
  { key: 'ALL',      label: 'All' },
  { key: 'VERIFIED', label: 'Active',    statusKey: 'VERIFIED' },
  { key: 'REJECTED', label: 'Suspended', statusKey: 'REJECTED' },
  { key: 'PENDING',  label: 'Pending',   statusKey: 'PENDING' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export function ClientsPage() {
  const navigate = useNavigate();

  const [items,        setItems]        = useState<ClientListItem[]>([]);
  const [total,        setTotal]        = useState(0);
  const [statusCounts, setStatusCounts] = useState<Partial<Record<ClientVerificationStatus, number>>>({});
  const [filter,       setFilter]       = useState<ClientFilter>('ALL');
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // District + category filter state
  const [district,            setDistrict]            = useState<string | undefined>();
  const [orgType,             setOrgType]             = useState<string | undefined>();
  const [availableDistricts,  setAvailableDistricts]  = useState<string[]>([]);
  const [availableOrgTypes,   setAvailableOrgTypes]   = useState<string[]>([]);
  const [districtOpen,        setDistrictOpen]        = useState(false);
  const [orgTypeOpen,         setOrgTypeOpen]         = useState(false);

  const districtRef = useRef<HTMLDivElement>(null);
  const orgTypeRef  = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (districtRef.current && !districtRef.current.contains(e.target as Node)) setDistrictOpen(false);
      if (orgTypeRef.current  && !orgTypeRef.current.contains(e.target as Node))  setOrgTypeOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const LIMIT = 20;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const status = filter === 'ALL' ? undefined : filter;
    fetchClients(page, LIMIT, status, district, orgType)
      .then((res) => {
        setItems(res.items);
        setTotal(res.meta.total);
        setStatusCounts(res.statusCounts);
        if (res.availableDistricts) setAvailableDistricts(res.availableDistricts);
        if (res.availableOrgTypes)  setAvailableOrgTypes(res.availableOrgTypes);
        setFetchError(null);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load clients');
      })
      .finally(() => setLoading(false));
  }, [filter, page, district, orgType]);

  function handleFilterChange(f: ClientFilter) {
    setFilter(f);
    setPage(1);
  }

  function handlePageChange(n: number) {
    setPage(n);
  }

  const totalCount     = Object.values(statusCounts).reduce((s, n) => s + (n ?? 0), 0);
  const totalPages     = Math.max(1, Math.ceil(total / LIMIT));
  const showingFrom    = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const showingTo      = Math.min(page * LIMIT, total);
  const activeFilters  = (district ? 1 : 0) + (orgType ? 1 : 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50" style={{ fontFamily: IBM }}>
      <div className="p-4 sm:p-5 space-y-4">

        {/* ── Stat cards (status filters) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total clients"
            value={totalCount || null}
            accentColor="border-t-slate-400"
            onClick={() => handleFilterChange('ALL')}
            active={filter === 'ALL'}
          />
          <StatCard
            label="Active"
            value={statusCounts.VERIFIED ?? null}
            accentColor="border-t-[#14B87A]"
            onClick={() => handleFilterChange('VERIFIED')}
            active={filter === 'VERIFIED'}
          />
          <StatCard
            label="Pending"
            value={statusCounts.PENDING ?? null}
            accentColor="border-t-amber-400"
            onClick={() => handleFilterChange('PENDING')}
            active={filter === 'PENDING'}
          />
          <StatCard
            label="Suspended"
            value={statusCounts.REJECTED ?? null}
            accentColor="border-t-red-500"
            onClick={() => handleFilterChange('REJECTED')}
            active={filter === 'REJECTED'}
          />
        </div>

        {fetchError && (
          <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {/* ── Table card ── */}
        <div className="bg-white rounded border border-slate-200">

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            {/* Status tabs */}
            <div className="flex items-center overflow-x-auto">
              {TABS.map(({ key, label, statusKey }) => {
                const count = key === 'ALL'
                  ? total
                  : (statusKey ? (statusCounts[statusKey] ?? 0) : 0);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleFilterChange(key)}
                    className={cn(
                      'px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap',
                      filter === key
                        ? 'border-green-500 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200',
                    )}
                  >
                    {label}
                    <span className={cn(
                      'ml-1.5 font-mono text-[10px]',
                      filter === key ? 'text-slate-600' : 'text-slate-400',
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* District + Category dropdowns */}
            <div className="flex items-center gap-2 shrink-0">
              {/* District dropdown */}
              <div ref={districtRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setDistrictOpen((v) => !v); setOrgTypeOpen(false); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors cursor-pointer',
                    district
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="max-w-[80px] truncate">{district ?? 'District'}</span>
                  {district ? (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setDistrict(undefined); setPage(1); }}
                      className="ml-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  ) : (
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  )}
                </button>
                {districtOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded shadow-lg min-w-[160px] max-h-52 overflow-y-auto">
                    {availableDistricts.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400">No districts in data</p>
                    ) : availableDistricts.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setDistrict(d === district ? undefined : d); setDistrictOpen(false); setPage(1); }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer',
                          district === d
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category (orgType) dropdown */}
              <div ref={orgTypeRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setOrgTypeOpen((v) => !v); setDistrictOpen(false); }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors cursor-pointer',
                    orgType
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="max-w-[80px] truncate">{orgType ? orgTypeLabel(orgType) : 'Category'}</span>
                  {orgType ? (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setOrgType(undefined); setPage(1); }}
                      className="ml-0.5 opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  ) : (
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  )}
                </button>
                {orgTypeOpen && (
                  <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-slate-200 rounded shadow-lg min-w-[160px] max-h-52 overflow-y-auto">
                    {availableOrgTypes.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400">No categories in data</p>
                    ) : availableOrgTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setOrgType(t === orgType ? undefined : t); setOrgTypeOpen(false); setPage(1); }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer',
                          orgType === t
                            ? 'bg-slate-900 text-white font-semibold'
                            : 'text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        {orgTypeLabel(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear all active filters */}
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => { setDistrict(undefined); setOrgType(undefined); setPage(1); }}
                  className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Mobile card list ── */}
          <div className="md:hidden divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3.5 bg-slate-100 rounded animate-pulse w-2/5" />
                      <div className="h-5 bg-slate-100 rounded animate-pulse w-14" />
                    </div>
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-3/5" />
                    <div className="flex justify-between mt-1">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
                      <div className="h-6 bg-slate-100 rounded animate-pulse w-10" />
                    </div>
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No clients found.</p>
              </div>
            ) : (
              items.map((row, i) => (
                <div
                  key={row.id}
                  onClick={() => navigate(`/clients/${row.id}`)}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/80 cursor-pointer active:bg-slate-100 transition-colors"
                >
                  <div className={cn(
                    'w-9 h-9 rounded flex items-center justify-center text-[11px] font-bold shrink-0',
                    AVATAR_COLORS[i % AVATAR_COLORS.length],
                  )}>
                    {initials(row.legalName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                        {row.tradingName ?? row.legalName}
                      </p>
                      <StatusBadge status={row.verificationStatus} />
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {orgTypeLabel(row.orgType)}
                      {row.primaryDistrict ? ` · ${row.primaryDistrict}` : ''}
                      {' · '}{sinceLabel(row.createdAt)}
                    </p>

                    <div className="flex items-center justify-between mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          <span className="font-mono font-semibold text-slate-800">{row.activeJobCount}</span> active jobs
                        </span>
                        {row.outstandingBalance > 0 && (
                          <span className="font-mono font-semibold text-red-500">{formatRWF(row.outstandingBalance)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${row.id}`)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Business', 'TIN', 'Category', 'District', 'Active jobs', 'Balance', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {[160, 100, 90, 90, 60, 80, 70, 40].map((w, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 && !fetchError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  items.map((row, i) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/clients/${row.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-8 h-8 rounded flex items-center justify-center text-[11px] font-bold shrink-0', AVATAR_COLORS[i % AVATAR_COLORS.length])}>
                            {initials(row.legalName)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">{row.legalName}</p>
                            <p className="text-[10px] text-slate-400">{sinceLabel(row.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600 whitespace-nowrap">{row.tinNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{orgTypeLabel(row.orgType)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{row.primaryDistrict ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-900 font-semibold tabular-nums">{row.activeJobCount}</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold tabular-nums whitespace-nowrap">
                        {row.outstandingBalance > 0
                          ? <span className="text-red-500">{formatRWF(row.outstandingBalance)}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={row.verificationStatus} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/clients/${row.id}`)}
                          className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer transition-colors"
                          aria-label="View client"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
              {showingFrom}–{showingTo} of {total} clients
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => handlePageChange(page - 1)}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handlePageChange(n)}
                  className={cn(
                    'w-7 h-7 rounded font-mono text-xs font-medium border transition-colors cursor-pointer',
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
                disabled={page >= totalPages || loading}
                onClick={() => handlePageChange(page + 1)}
                className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50 cursor-pointer transition-colors"
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
