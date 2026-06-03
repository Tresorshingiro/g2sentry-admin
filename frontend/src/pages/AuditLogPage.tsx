import {
  AlertTriangle,
  Filter,
  Loader2,
  Search,
  Shield,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchAuditLogs, type AuditLogItem } from '@/services/api';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────

const LIMIT = 100; // fetch more so client-side filters are meaningful

const ENTITY_TYPES = [
  { value: '',                        label: 'All entities' },
  { value: 'identity.users',          label: 'Users' },
  { value: 'customer.organizations',  label: 'Organisations' },
  { value: 'guardian.guardians',      label: 'Guardians' },
  { value: 'job.jobs',                label: 'Jobs' },
  { value: 'job.job_assignments',     label: 'Assignments' },
  { value: 'billing.invoices',        label: 'Invoices' },
  { value: 'billing.payments',        label: 'Payments' },
];

const ENTITY_LABEL: Record<string, string> = {
  'identity.users':         'User',
  'customer.organizations': 'Organisation',
  'guardian.guardians':     'Guardian',
  'job.jobs':               'Job',
  'job.job_assignments':    'Assignment',
  'billing.invoices':       'Invoice',
  'billing.payments':       'Payment',
};

const ACTION_CATEGORY_FILTERS = [
  { value: '',          label: 'All actions' },
  { value: 'AUTH',      label: 'Auth' },
  { value: 'CREATE',    label: 'Create' },
  { value: 'UPDATE',    label: 'Update' },
  { value: 'DELETE',    label: 'Delete' },
  { value: 'ACTIVATE',  label: 'Activate' },
  { value: 'SUSPEND',   label: 'Suspend' },
  { value: 'COMPLETE',  label: 'Complete' },
  { value: 'DENIED',    label: 'Denied' },
];

const PAGE_SIZE = 20; // display rows per page

// ── Helpers ────────────────────────────────────────────────────────────────

function actionStyle(action: string): { cls: string } {
  const a = action.toUpperCase();
  if (a.includes('LOGIN') || a.includes('SIGN_IN') || a.includes('AUTH') || a.includes('REFRESH'))
    return { cls: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' };
  if (a.includes('DELETE') || a.includes('REMOVE') || a.includes('DENIED'))
    return { cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
  if (a.includes('CREATE') || a.includes('REGISTER') || a.includes('ADDED'))
    return { cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' };
  if (a.includes('UPDATE') || a.includes('EDIT') || a.includes('PATCH') || a.includes('CHANGE'))
    return { cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' };
  if (a.includes('ACTIV'))
    return { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' };
  if (a.includes('SUSPEND') || a.includes('BLOCK'))
    return { cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' };
  if (a.includes('COMPLETE') || a.includes('VERIFY') || a.includes('APPROVE'))
    return { cls: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' };
  return { cls: 'bg-slate-100 text-slate-600' };
}

function matchesCategory(action: string, category: string): boolean {
  if (!category) return true;
  const a = action.toUpperCase();
  if (category === 'AUTH')     return a.includes('LOGIN') || a.includes('SIGN_IN') || a.includes('AUTH') || a.includes('REFRESH');
  if (category === 'CREATE')   return a.includes('CREATE') || a.includes('REGISTER');
  if (category === 'UPDATE')   return a.includes('UPDATE') || a.includes('EDIT') || a.includes('PATCH');
  if (category === 'DELETE')   return a.includes('DELETE') || a.includes('REMOVE');
  if (category === 'ACTIVATE') return a.includes('ACTIV');
  if (category === 'SUSPEND')  return a.includes('SUSPEND') || a.includes('BLOCK');
  if (category === 'COMPLETE') return a.includes('COMPLETE') || a.includes('VERIFY') || a.includes('APPROVE');
  if (category === 'DENIED')   return a.includes('DENIED');
  return true;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function actorInitials(actor: AuditLogItem['actor']): string {
  if (!actor) return 'SY';
  if (actor.fullName) return actor.fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return actor.phoneNumber.slice(-2);
}

// ── Page ───────────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [logs,        setLogs]        = useState<AuditLogItem[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);

  // Server-side filters
  const [entityType,  setEntityType]  = useState('');

  // Client-side filters
  const [search,      setSearch]      = useState('');
  const [actionCat,   setActionCat]   = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  // Display page
  const [displayPage, setDisplayPage] = useState(1);

  const hasFilters = !!search || !!actionCat || !!dateFrom || !!dateTo;

  // Fetch when server-side filter or page changes
  useEffect(() => {
    let cancelled = false;
    fetchAuditLogs(page, LIMIT, undefined, entityType || undefined)
      .then((res) => {
        if (!cancelled) {
          setLogs(res.items);
          setTotal(res.meta.total);
          setFetchError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, entityType]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = logs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        (l.actor?.fullName ?? '').toLowerCase().includes(q) ||
        (l.actor?.phoneNumber ?? '').includes(q) ||
        l.entityType.toLowerCase().includes(q),
      );
    }
    if (actionCat) {
      result = result.filter((l) => matchesCategory(l.action, actionCat));
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((l) => new Date(l.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.createdAt) <= to);
    }
    return result;
  }, [logs, search, actionCat, dateFrom, dateTo]);

  const totalPages    = Math.max(1, Math.ceil(total / LIMIT));
  const displayTotal  = filtered.length;
  const displayPages  = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
  const visibleLogs   = filtered.slice((displayPage - 1) * PAGE_SIZE, displayPage * PAGE_SIZE);

  function clearFilters() {
    setSearch('');
    setActionCat('');
    setDateFrom('');
    setDateTo('');
    setDisplayPage(1);
    setLoading(true);
    setEntityType('');
    setPage(1);
  }

  const anyActiveFilter = !!search || !!actionCat || !!dateFrom || !!dateTo || !!entityType;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="p-4 sm:p-5 space-y-3">

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">

          {/* Row 1: search + clear */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDisplayPage(1); }}
                placeholder="Search by action, actor, or entity…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-colors"
              />
            </div>
            {anyActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Row 2: dropdown filters + date range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span className="font-medium">Filters:</span>
            </div>

            {/* Entity type — server-side */}
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(1); setDisplayPage(1); setLoading(true); }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-green-500 cursor-pointer"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Action category — client-side */}
            <select
              value={actionCat}
              onChange={(e) => { setActionCat(e.target.value); setDisplayPage(1); }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-green-500 cursor-pointer"
            >
              {ACTION_CATEGORY_FILTERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Date range — client-side */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setDisplayPage(1); }}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-green-500 cursor-pointer"
              />
              <span className="text-xs text-slate-400">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setDisplayPage(1); }}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-green-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Active filter chips */}
          {anyActiveFilter && (
            <div className="flex flex-wrap gap-1.5">
              {entityType && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[11px] font-medium rounded-full ring-1 ring-green-200">
                  Entity: {ENTITY_TYPES.find((t) => t.value === entityType)?.label}
                  <button type="button" onClick={() => setEntityType('')} className="cursor-pointer hover:text-green-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {actionCat && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-full ring-1 ring-blue-200">
                  Action: {actionCat}
                  <button type="button" onClick={() => setActionCat('')} className="cursor-pointer hover:text-blue-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-[11px] font-medium rounded-full ring-1 ring-violet-200">
                  From: {dateFrom}
                  <button type="button" onClick={() => setDateFrom('')} className="cursor-pointer hover:text-violet-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-[11px] font-medium rounded-full ring-1 ring-violet-200">
                  To: {dateTo}
                  <button type="button" onClick={() => setDateTo('')} className="cursor-pointer hover:text-violet-900"><X className="w-3 h-3" /></button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-medium rounded-full ring-1 ring-slate-200">
                  "{search}"
                  <button type="button" onClick={() => setSearch('')} className="cursor-pointer hover:text-slate-900"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {fetchError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

          {/* Table header row with count */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">Audit trail</span>
              {!loading && (
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-semibold rounded-full">
                  {hasFilters ? `${displayTotal} filtered` : `${total} total`}
                </span>
              )}
            </div>
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['When', 'Actor', 'Action', 'Entity', 'ID'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><div className="h-3.5 bg-slate-100 rounded animate-pulse w-24" /></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-slate-100 animate-pulse shrink-0" /><div className="h-3 bg-slate-100 rounded animate-pulse w-20" /></div></td>
                      <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded-full animate-pulse w-28" /></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded-full animate-pulse w-20" /></td>
                      <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse w-16" /></td>
                    </tr>
                  ))
                ) : visibleLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <AlertTriangle className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No audit logs match your filters</p>
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map((log) => {
                    const { cls } = actionStyle(log.action);
                    const entityLabel = ENTITY_LABEL[log.entityType] ?? log.entityType.split('.').pop() ?? log.entityType;
                    const initials = actorInitials(log.actor);
                    const actorName = log.actor
                      ? (log.actor.fullName ?? log.actor.phoneNumber)
                      : 'System';
                    const isSystem = !log.actor;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">

                        {/* When */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-medium text-slate-700">
                            {new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            {' '}
                            {new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(log.createdAt)}</p>
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 select-none',
                              isSystem ? 'bg-slate-100 text-slate-400' : 'bg-slate-700 text-white',
                            )}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate max-w-[120px]">{actorName}</p>
                              {log.actor?.fullName && (
                                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{log.actor.phoneNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono whitespace-nowrap',
                            cls,
                          )}>
                            {log.action}
                          </span>
                        </td>

                        {/* Entity */}
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md whitespace-nowrap">
                            {entityLabel}
                          </span>
                        </td>

                        {/* ID */}
                        <td className="px-4 py-3">
                          <span className="text-[10px] text-slate-400 font-mono" title={log.entityId}>
                            {log.entityId.slice(0, 8)}…
                          </span>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
            <span className="text-xs text-slate-500">
              {loading ? 'Loading…' : (
                hasFilters
                  ? `Showing ${Math.min((displayPage - 1) * PAGE_SIZE + 1, displayTotal)}–${Math.min(displayPage * PAGE_SIZE, displayTotal)} of ${displayTotal} filtered`
                  : `Page ${page} of ${totalPages} · ${total} total entries`
              )}
            </span>

            <div className="flex items-center gap-1.5">
              {/* Prev fetch page */}
              {!hasFilters && (
                <button
                  type="button"
                  disabled={page === 1 || loading}
                  onClick={() => { setPage((p) => p - 1); setLoading(true); }}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ← Prev
                </button>
              )}

              {/* Display page numbers */}
              {displayPages > 1 && Array.from({ length: Math.min(displayPages, 7) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDisplayPage(n)}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                    displayPage === n
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {n}
                </button>
              ))}

              {/* Next fetch page */}
              {!hasFilters && (
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => { setPage((p) => p + 1); setLoading(true); }}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
