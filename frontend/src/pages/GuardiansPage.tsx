import { Download, Pencil, Plus, Search, Shield, UserCheck, UserX, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { fetchGuardianRoster } from '@/services/api';
import type {
  GuardianFilter,
  GuardianListItem,
} from '@/types/guardian-roster';

// ── Avatar colours — solid, high-contrast ──────────────────────────────────
const AVATAR_COLORS = [
  'bg-slate-700',
  'bg-green-700',
  'bg-blue-700',
  'bg-violet-700',
  'bg-amber-600',
  'bg-rose-700',
  'bg-cyan-700',
  'bg-teal-700',
];

function toInitials(name: string | null, phone: string) {
  if (!name) return phone.slice(-2);
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatPhone(phone: string) {
  if (phone.startsWith('+250') && phone.length === 13) {
    return `+250 ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

function employmentLabel(type: string) {
  if (type === 'FULL_TIME') return 'Full-time';
  if (type === 'PART_TIME') return 'Part-time';
  if (type === 'RESERVE') return 'Reserve';
  return type;
}

// ── Status helpers ─────────────────────────────────────────────────────────
function resolveStatus(g: GuardianListItem): { label: string; dot: string; text: string } {
  if (g.status === 'SUSPENDED') return { label: 'Suspended', dot: 'bg-red-500', text: 'text-red-600' };
  if (g.status === 'INACTIVE')  return { label: 'Inactive',  dot: 'bg-slate-400', text: 'text-slate-500' };
  if (g.shiftState?.shiftStatus === 'AVAILABLE') return { label: 'Available', dot: 'bg-green-500', text: 'text-green-700' };
  if (g.shiftState?.shiftStatus === 'BUSY')      return { label: 'On duty',   dot: 'bg-blue-500',  text: 'text-blue-700' };
  return { label: 'Active', dot: 'bg-green-500', text: 'text-green-700' };
}

function vettingStyle(status: string): { label: string; cls: string } {
  if (status === 'VERIFIED') return { label: 'Verified',  cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' };
  if (status === 'REJECTED') return { label: 'Rejected',  cls: 'bg-red-50 text-red-600 ring-1 ring-red-200' };
  return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' };
}

function employmentCls(type: string) {
  if (type === 'FULL_TIME') return 'bg-slate-100 text-slate-600';
  if (type === 'RESERVE')   return 'bg-amber-50 text-amber-700';
  return 'bg-blue-50 text-blue-600';
}

// ── Filter tabs ────────────────────────────────────────────────────────────
const TABS: { key: GuardianFilter; label: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'ACTIVE',    label: 'Active' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'VETTING',   label: 'Pending vetting' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

function filterToParams(f: GuardianFilter): { status?: string; verificationStatus?: string } {
  if (f === 'ACTIVE')    return { status: 'ACTIVE' };
  if (f === 'SUSPENDED') return { status: 'SUSPENDED' };
  if (f === 'VETTING')   return { verificationStatus: 'PENDING' };
  return {};
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3.5 px-4 py-3.5 bg-white rounded-xl border text-left transition-all cursor-pointer hover:shadow-sm',
        active ? 'border-green-500 ring-1 ring-green-500/30' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('w-4 h-4', iconColor)} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 leading-none">
          {value === null ? <span className="text-slate-300">—</span> : value}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function GuardiansPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<GuardianListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<GuardianFilter>('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Stat counts (fetched once on mount)
  const [statTotal,     setStatTotal]     = useState<number | null>(null);
  const [statActive,    setStatActive]    = useState<number | null>(null);
  const [statPending,   setStatPending]   = useState<number | null>(null);
  const [statSuspended, setStatSuspended] = useState<number | null>(null);

  // Parallel stat fetches on mount
  useEffect(() => {
    void Promise.all([
      fetchGuardianRoster(1, 1),
      fetchGuardianRoster(1, 1, 'ACTIVE'),
      fetchGuardianRoster(1, 1, undefined, 'PENDING'),
      fetchGuardianRoster(1, 1, 'SUSPENDED'),
    ]).then(([all, active, pending, suspended]) => {
      setStatTotal(all.meta.total);
      setStatActive(active.meta.total);
      setStatPending(pending.meta.total);
      setStatSuspended(suspended.meta.total);
    }).catch(() => {});
  }, []);

  // Main list fetch
  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    const { status, verificationStatus } = filterToParams(filter);
    fetchGuardianRoster(page, 10, status, verificationStatus)
      .then((res) => {
        setItems(res.items);
        setTotal(res.meta.total);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load guardians');
      })
      .finally(() => setLoading(false));
  }, [filter, page]);

  function handleFilterChange(f: GuardianFilter) {
    setFilter(f);
    setPage(1);
  }

  // Client-side search filter (searches name + code + phone)
  const visible = search.trim()
    ? items.filter((g) => {
        const q = search.toLowerCase();
        return (
          (g.user.fullName ?? '').toLowerCase().includes(q) ||
          g.guardianCode.toLowerCase().includes(q) ||
          g.user.phoneNumber.includes(q) ||
          g.districtBase.toLowerCase().includes(q)
        );
      })
    : items;

  const LIMIT      = 10;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function getPageNumbers(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (current > 3) pages.push('…');
    const start = Math.max(2, current - 1);
    const end   = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">

      <div className="p-4 sm:p-5 space-y-4">
        {/* Actions row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {statTotal !== null ? `${statTotal} registered guardians · Rwanda` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button type="button" onClick={() => navigate('/guardians/new')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Register guardian
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users}     label="Total guardians"  value={statTotal}     iconBg="bg-slate-100" iconColor="text-slate-600" onClick={() => handleFilterChange('ALL')}       active={filter === 'ALL'} />
          <StatCard icon={UserCheck} label="Active"           value={statActive}    iconBg="bg-green-100" iconColor="text-green-600" onClick={() => handleFilterChange('ACTIVE')}    active={filter === 'ACTIVE'} />
          <StatCard icon={Shield}    label="Pending vetting"  value={statPending}   iconBg="bg-amber-100" iconColor="text-amber-600" onClick={() => handleFilterChange('VETTING')}   active={filter === 'VETTING'} />
          <StatCard icon={UserX}     label="Suspended"        value={statSuspended} iconBg="bg-red-100"   iconColor="text-red-500"   onClick={() => handleFilterChange('SUSPENDED')} active={filter === 'SUSPENDED'} />
        </div>

        {/* ── Table card ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            {/* Filter tabs */}
            <div className="flex items-center gap-0 overflow-x-auto">
              {TABS.map(({ key, label }) => (
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
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code, district…"
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
              />
            </div>
          </div>

          {fetchError && (
            <div className="mx-4 mt-3 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
              {fetchError}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest w-64">Guardian</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">District</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Rating</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Vetting</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '80%' : '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        {search ? 'No guardians match your search' : 'No guardians found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visible.map((g, i) => {
                    const isDeleted  = g.user.status === 'DELETED';
                    const statusInfo = resolveStatus(g);
                    const vetting    = vettingStyle(g.verificationStatus);
                    const rating     = Number(g.rating);
                    const initials   = isDeleted
                      ? g.guardianCode.slice(-2).toUpperCase()
                      : toInitials(g.user.fullName, g.user.phoneNumber);
                    const avatarBg   = isDeleted
                      ? 'bg-slate-200 text-slate-400'
                      : AVATAR_COLORS[i % AVATAR_COLORS.length];

                    return (
                      <tr
                        key={g.id}
                        onClick={() => !isDeleted && navigate(`/guardians/${g.id}`)}
                        className={cn(
                          'transition-colors',
                          isDeleted
                            ? 'opacity-50 cursor-default'
                            : 'hover:bg-slate-50/80 cursor-pointer',
                        )}
                      >
                        {/* Guardian identity */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 select-none',
                              avatarBg,
                            )}>
                              {initials}
                            </div>
                            {isDeleted ? (
                              <div className="min-w-0">
                                <p className="text-sm text-slate-400 italic leading-tight">Deleted account</p>
                                <code className="text-[10px] text-slate-300 font-mono">{g.guardianCode}</code>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                                  {g.user.fullName ?? formatPhone(g.user.phoneNumber)}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <code className="text-[10px] text-slate-400 font-mono">{g.guardianCode}</code>
                                  {g.user.fullName && (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <span className="text-[10px] text-slate-400">{formatPhone(g.user.phoneNumber)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusInfo.dot)} />
                            <span className={cn('text-xs font-medium', statusInfo.text)}>
                              {statusInfo.label}
                            </span>
                          </div>
                        </td>

                        {/* District */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-slate-600">{g.districtBase}</span>
                        </td>

                        {/* Employment type */}
                        <td className="px-4 py-3.5">
                          {g.employmentType ? (
                            <span className={cn(
                              'inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium',
                              employmentCls(g.employmentType),
                            )}>
                              {employmentLabel(g.employmentType)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Rating */}
                        <td className="px-4 py-3.5">
                          {rating > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${(rating / 5) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                {rating.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">No ratings</span>
                          )}
                        </td>

                        {/* Vetting */}
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold', vetting.cls)}>
                            {vetting.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {!isDeleted && (
                            <button
                              type="button"
                              onClick={() => navigate(`/guardians/${g.id}`)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            >
                              View
                            </button>
                            )}
                            {!isDeleted && (
                              <button
                                type="button"
                                onClick={() => navigate(`/guardians/${g.id}/edit`)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                aria-label="Edit guardian"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} guardians
              </span>
              <div className="flex items-center gap-1">
                {/* Prev */}
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                >
                  ‹
                </button>

                {/* Page numbers with ellipsis */}
                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium border transition-colors cursor-pointer',
                        page === n
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {n}
                    </button>
                  ),
                )}

                {/* Next */}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
