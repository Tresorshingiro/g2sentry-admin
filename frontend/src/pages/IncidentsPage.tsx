import { AlertTriangle, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { fetchAllIncidents, type FieldIncident } from '@/services/api';

const SEVERITY_CFG: Record<string, { cls: string; label: string; dot: string }> = {
  CRITICAL: { cls: 'bg-red-100 text-red-700',    label: 'Critical', dot: 'bg-red-500' },
  HIGH:     { cls: 'bg-orange-100 text-orange-700', label: 'High',   dot: 'bg-orange-500' },
  MEDIUM:   { cls: 'bg-amber-100 text-amber-700',  label: 'Medium',  dot: 'bg-amber-400' },
  LOW:      { cls: 'bg-slate-100 text-slate-600',  label: 'Low',     dot: 'bg-slate-400' },
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  FIGHT:               'Fight',
  TRESPASSING:         'Trespassing',
  THEFT_ATTEMPT:       'Theft attempt',
  PROPERTY_DAMAGE:     'Property damage',
  CUSTOMER_DISPUTE:    'Customer dispute',
  MEDICAL_ASSIST:      'Medical assist',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity',
  OTHER:               'Other',
};

const SEVERITY_FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const TYPE_FILTERS = ['ALL', ...Object.keys(INCIDENT_TYPE_LABELS)] as const;

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function IncidentsPage() {
  const navigate = useNavigate();
  const [items, setItems]         = useState<FieldIncident[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [severity, setSeverity]   = useState<string>('ALL');
  const [incType, setIncType]     = useState<string>('ALL');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAllIncidents(
      page, 20,
      severity !== 'ALL' ? severity : undefined,
      incType  !== 'ALL' ? incType  : undefined,
    )
      .then((res) => {
        setItems(res.items ?? (res as unknown as FieldIncident[]));
        setTotal((res as { meta?: { total?: number } }).meta?.total ?? (res as unknown as FieldIncident[]).length ?? 0);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load incidents');
      })
      .finally(() => setLoading(false));
  }, [page, severity, incType]);

  function handleSeverity(s: string) { setSeverity(s); setPage(1); }
  function handleType(t: string)     { setIncType(t);  setPage(1); }

  const LIMIT      = 20;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50">
      <div className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <Siren className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Field Incidents</h1>
            <p className="text-xs text-slate-500">All incidents reported by guardians across all jobs</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Severity</p>
            <div className="flex gap-1 flex-wrap">
              {SEVERITY_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSeverity(s)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer',
                    severity === s
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {s === 'ALL' ? 'All' : (SEVERITY_CFG[s]?.label ?? s)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Type</p>
            <div className="flex gap-1 flex-wrap">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleType(t)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer',
                    incType === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {t === 'ALL' ? 'All types' : (INCIDENT_TYPE_LABELS[t] ?? t)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {error && (
            <div className="mx-4 mt-3 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Incident', 'Severity', 'Description', 'Job ref', 'Guardian', 'Reporter', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[120, 80, 200, 100, 90, 100, 110].map((w, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No incidents found</p>
                    </td>
                  </tr>
                ) : (
                  items.map((inc) => {
                    const sev = SEVERITY_CFG[inc.severity] ?? SEVERITY_CFG.LOW;
                    const jobRef = inc.assignment?.job?.referenceNumber;
                    const jobId  = inc.assignment?.job ? undefined : undefined;
                    void jobId;
                    return (
                      <tr
                        key={inc.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {INCIDENT_TYPE_LABELS[inc.incidentType] ?? inc.incidentType}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', sev.dot)} />
                            <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold', sev.cls)}>
                              {sev.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <p className="text-sm text-slate-700 truncate">{inc.description}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          {jobRef ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (inc.assignment?.job) {
                                  navigate(`/assignments/${inc.assignment!.id}`);
                                }
                              }}
                              className="text-xs font-mono font-semibold text-green-600 hover:underline cursor-pointer"
                            >
                              {jobRef}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-600">
                            {inc.assignment?.guardian?.guardianCode ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-600">
                            {inc.reporter?.fullName ?? inc.reporter?.phoneNumber ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs text-slate-500">{fmt(inc.createdAt)}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} incidents
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                >‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={cn(
                      'w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium border transition-colors cursor-pointer',
                      page === n ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                    )}
                  >{n}</button>
                ))}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                >›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
