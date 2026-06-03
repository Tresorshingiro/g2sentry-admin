import {
  Briefcase,
  FileDown,
  Loader2,
  MapPin,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportJobsPDF } from '@/lib/export-jobs-pdf';
import { cn } from '@/lib/utils';
import { fetchAssignments } from '@/services/api';
import type { AssignmentFilter, Job } from '@/types/assignment';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; text: string; label: string }> = {
  PENDING:     { dot: 'bg-amber-400',  text: 'text-amber-600',  label: 'Pending dispatch' },
  DISPATCHING: { dot: 'bg-blue-400',   text: 'text-blue-600',   label: 'Dispatching' },
  ASSIGNED:    { dot: 'bg-purple-400', text: 'text-purple-600', label: 'Assigned' },
  IN_PROGRESS: { dot: 'bg-green-500',  text: 'text-green-700',  label: 'On duty' },
  COMPLETED:   { dot: 'bg-slate-400',  text: 'text-slate-500',  label: 'Completed' },
  FAILED:      { dot: 'bg-red-500',    text: 'text-red-600',    label: 'Failed' },
  CANCELLED:   { dot: 'bg-red-400',    text: 'text-red-500',    label: 'Cancelled' },
};

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<string, { cls: string; label: string }> = {
  URGENT:   { cls: 'bg-red-100 text-red-700 ring-1 ring-red-200',        label: 'Urgent' },
  HIGH:     { cls: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200', label: 'High' },
  STANDARD: { cls: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',      label: 'Standard' },
  MEDIUM:   { cls: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',      label: 'Medium' },
  LOW:      { cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',  label: 'Low' },
};

// ── Filter tabs ───────────────────────────────────────────────────────────────
const TABS: { key: AssignmentFilter; label: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'PENDING',   label: 'Pending dispatch' },
  { key: 'ACTIVE',    label: 'On duty' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELED',  label: 'Cancelled' },
];

function filterToStatus(f: AssignmentFilter): string | undefined {
  if (f === 'ACTIVE')    return 'IN_PROGRESS';
  if (f === 'PENDING')   return 'PENDING';
  if (f === 'COMPLETED') return 'COMPLETED';
  if (f === 'CANCELED')  return 'CANCELLED';
  return undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((d.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86_400_000);
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function guardianInitials(fullName: string | null, code: string): string {
  if (!fullName) return code.slice(-2).toUpperCase();
  return fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

// ── Stat card ─────────────────────────────────────────────────────────────────
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

// ── Guardian avatar stack ─────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-green-700', 'bg-blue-700', 'bg-violet-700', 'bg-amber-600', 'bg-cyan-700',
];

function GuardianAvatars({ guardians, requested }: { guardians: Job['assignedGuardians']; requested: number }) {
  const assigned  = guardians.length;
  const isShort   = assigned < requested;
  const shown     = guardians.slice(0, 3);
  const remainder = assigned > 3 ? assigned - 3 : 0;

  return (
    <div className="flex items-center gap-2">
      {assigned > 0 ? (
        <div className="flex items-center">
          {shown.map((a, i) => (
            <div
              key={a.id}
              title={a.guardian.user.fullName ?? a.guardian.guardianCode}
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold ring-2 ring-white shrink-0',
                AVATAR_COLORS[i % AVATAR_COLORS.length],
                i > 0 && '-ml-1.5',
              )}
            >
              {guardianInitials(a.guardian.user.fullName, a.guardian.guardianCode)}
            </div>
          ))}
          {remainder > 0 && (
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold ring-2 ring-white flex items-center justify-center -ml-1.5 shrink-0">
              +{remainder}
            </div>
          )}
        </div>
      ) : null}
      <div className="flex flex-col">
        <span className={cn('font-mono text-xs font-semibold tabular-nums leading-tight', isShort ? 'text-red-500' : 'text-slate-700')}>
          {assigned}/{requested}
        </span>
        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5">
          <div
            className={cn('h-full rounded-full', isShort ? 'bg-red-400' : 'bg-green-500')}
            style={{ width: `${Math.min((assigned / Math.max(requested, 1)) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Pagination helpers ────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export function AssignmentsPage() {
  const navigate = useNavigate();

  const [items,      setItems]      = useState<Job[]>([]);
  const [total,      setTotal]      = useState(0);
  const [filter,     setFilter]     = useState<AssignmentFilter>('ALL');
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [exporting,  setExporting]  = useState(false);

  const [statTotal,     setStatTotal]     = useState<number | null>(null);
  const [statPending,   setStatPending]   = useState<number | null>(null);
  const [statActive,    setStatActive]    = useState<number | null>(null);
  const [statCompleted, setStatCompleted] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchAssignments(1, 1),
      fetchAssignments(1, 1, 'PENDING'),
      fetchAssignments(1, 1, 'IN_PROGRESS'),
      fetchAssignments(1, 1, 'COMPLETED'),
    ]).then(([all, pending, active, completed]) => {
      setStatTotal(all.meta.total);
      setStatPending(pending.meta.total);
      setStatActive(active.meta.total);
      setStatCompleted(completed.meta.total);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFetchError(null);
    fetchAssignments(page, 10, filterToStatus(filter))
      .then((res) => {
        setItems(res.items);
        setTotal(res.meta.total);
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load jobs');
      })
      .finally(() => setLoading(false));
  }, [filter, page]);

  function handleFilterChange(f: AssignmentFilter) {
    setFilter(f);
    setPage(1);
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      const status = filterToStatus(filter);
      const BATCH  = 100;
      const first  = await fetchAssignments(1, BATCH, status);
      const totalCount = first.meta.total;
      const totalPages = Math.ceil(totalCount / BATCH);
      let allItems = [...first.items];
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            fetchAssignments(i + 2, BATCH, status),
          ),
        );
        for (const res of rest) allItems = [...allItems, ...res.items];
      }
      const filterLabel = filter === 'ALL'       ? 'All jobs'
        : filter === 'PENDING'   ? 'Pending dispatch'
        : filter === 'ACTIVE'    ? 'On duty'
        : filter === 'COMPLETED' ? 'Completed'
        : filter === 'CANCELED'  ? 'Cancelled'
        : filter;
      exportJobsPDF(
        allItems,
        { total: statTotal, pending: statPending, active: statActive, completed: statCompleted },
        filterLabel,
      );
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  }

  const visible = search.trim()
    ? items.filter((j) => {
        const q = search.toLowerCase();
        return (
          j.referenceNumber.toLowerCase().includes(q) ||
          (j.organization?.legalName ?? '').toLowerCase().includes(q) ||
          (j.location?.name ?? '').toLowerCase().includes(q) ||
          (j.location?.district ?? '').toLowerCase().includes(q)
        );
      })
    : items;

  const LIMIT      = 10;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50" style={{ fontFamily: IBM }}>
      <div className="p-4 sm:p-5 space-y-4">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total jobs"        value={statTotal}     accentColor="border-t-slate-400"  onClick={() => handleFilterChange('ALL')}       active={filter === 'ALL'} />
          <StatCard label="Pending dispatch"  value={statPending}   accentColor="border-t-amber-400"  onClick={() => handleFilterChange('PENDING')}   active={filter === 'PENDING'} />
          <StatCard label="On duty now"       value={statActive}    accentColor="border-t-[#14B87A]"  onClick={() => handleFilterChange('ACTIVE')}    active={filter === 'ACTIVE'} />
          <StatCard label="Completed"         value={statCompleted} accentColor="border-t-blue-500"   onClick={() => handleFilterChange('COMPLETED')} active={filter === 'COMPLETED'} />
        </div>

        {/* ── Table card ── */}
        <div className="bg-white rounded border border-slate-200 overflow-hidden">

          {/* Controls row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <div className="flex items-center overflow-x-auto">
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

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search jobs, clients…"
                  className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                {exporting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />}
                {exporting ? 'Generating…' : 'Export PDF'}
              </button>
            </div>
          </div>

          {fetchError && (
            <div className="mx-4 mt-3 px-3 py-2.5 bg-red-50 border border-red-100 rounded text-xs text-red-600">
              {fetchError}
            </div>
          )}

          {/* ── Mobile card list ── */}
          <div className="md:hidden divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-24" />
                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-16" />
                  </div>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/5" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
                  <div className="flex justify-between mt-2">
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                    <div className="h-6 bg-slate-100 rounded animate-pulse w-12" />
                  </div>
                </div>
              ))
            ) : visible.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <Briefcase className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  {search ? 'No jobs match your search' : 'No jobs found'}
                </p>
              </div>
            ) : (
              visible.map((job) => {
                const status    = STATUS_CFG[job.status]    ?? { dot: 'bg-slate-400', text: 'text-slate-500', label: job.status };
                const priority  = PRIORITY_CFG[job.priority] ?? { cls: 'bg-slate-100 text-slate-500', label: job.priority };
                const isToday   = relativeDate(job.scheduledStart) === 'Today';
                const dateLabel = relativeDate(job.scheduledStart);

                return (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/assignments/${job.id}`)}
                    className="px-4 py-3.5 hover:bg-slate-50/80 cursor-pointer active:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className={cn(
                        'text-xs font-mono font-semibold',
                        job.status === 'IN_PROGRESS' ? 'text-green-600' : 'text-slate-700',
                      )}>
                        {job.referenceNumber}
                      </code>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                        <span className={cn('text-[11px] font-medium', status.text)}>{status.label}</span>
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 truncate mt-1 leading-tight">
                      {job.organization?.legalName ?? '—'}
                    </p>

                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-500 truncate">
                        {job.location?.name ?? '—'}
                        {job.location?.district ? ` · ${job.location.district}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('font-mono text-xs font-semibold', isToday ? 'text-green-600' : 'text-slate-700')}>
                        {dateLabel} · {fmtTime(job.scheduledStart)}
                        {job.scheduledEnd ? ` – ${fmtTime(job.scheduledEnd)}` : ''}
                      </span>
                      <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold', priority.cls)}>
                        {priority.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2" onClick={(e) => e.stopPropagation()}>
                      <GuardianAvatars
                        guardians={job.assignedGuardians ?? []}
                        requested={job.requestedGuardianCount}
                      />
                      <button
                        type="button"
                        onClick={() => navigate(`/assignments/${job.id}`)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Job ref', 'Client & location', 'Schedule', 'Priority', 'Staffing', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[140, 200, 100, 80, 120, 90, 80].map((w, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Briefcase className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        {search ? 'No jobs match your search' : 'No jobs found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  visible.map((job) => {
                    const status   = STATUS_CFG[job.status]    ?? { dot: 'bg-slate-400', text: 'text-slate-500', label: job.status };
                    const priority = PRIORITY_CFG[job.priority] ?? { cls: 'bg-slate-100 text-slate-500', label: job.priority };
                    const isToday  = relativeDate(job.scheduledStart) === 'Today';
                    const dateLabel = relativeDate(job.scheduledStart);

                    return (
                      <tr
                        key={job.id}
                        onClick={() => navigate(`/assignments/${job.id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <code className={cn('text-xs font-mono font-semibold', job.status === 'IN_PROGRESS' ? 'text-green-600' : 'text-slate-700')}>
                            {job.referenceNumber}
                          </code>
                        </td>
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{job.organization?.legalName ?? '—'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-500 truncate">
                              {job.location?.name ?? '—'}{job.location?.district ? ` · ${job.location.district}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className={cn('font-mono text-xs font-semibold leading-tight', isToday ? 'text-green-600' : 'text-slate-800')}>{dateLabel}</p>
                          <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                            {fmtTime(job.scheduledStart)}{job.scheduledEnd ? ` – ${fmtTime(job.scheduledEnd)}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold', priority.cls)}>{priority.label}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <GuardianAvatars guardians={job.assignedGuardians ?? []} requested={job.requestedGuardianCount} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', status.dot)} />
                            <span className={cn('text-xs font-medium', status.text)}>{status.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => navigate(`/assignments/${job.id}`)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                          >
                            View
                          </button>
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
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} jobs
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                >
                  ‹
                </button>
                {getPageNumbers(page, totalPages).map((n, i) =>
                  n === '…' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center font-mono text-xs text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded font-mono text-xs font-medium border transition-colors cursor-pointer',
                        page === n
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
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
