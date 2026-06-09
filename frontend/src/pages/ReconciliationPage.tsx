import {
  AlertTriangle,
  Clock,
  FileSearch,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchReconciliation } from '@/services/api';
import type { ReconciliationRow } from '@/types/pricing';
import { formatRWF } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtHours(h: number | null): string {
  if (h == null) return '—';
  return h.toFixed(2) + 'h';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReconciliationPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [orgId, setOrgId] = useState('');
  const [guardianId, setGuardianId] = useState('');

  const [rows, setRows] = useState<ReconciliationRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReconciliation({
        from,
        to,
        organizationId: orgId || undefined,
        guardianId: guardianId || undefined,
      });
      setRows(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run report');
    } finally {
      setLoading(false);
    }
  }

  const flaggedCount = rows ? rows.filter((r) => r.earlyCompletion || r.lateArrival).length : 0;
  const totalBillableHours = rows ? rows.reduce((s, r) => s + (r.billableHours ?? 0), 0) : 0;
  const totalInvoiceAmount = rows
    ? rows.reduce((s, r) => s + (r.invoiceTotal != null ? Number(r.invoiceTotal) : 0), 0)
    : 0;

  const INPUT_CLS = 'border border-slate-200 rounded px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] focus:border-[#14B87A] transition-colors';

  return (
    <div
      className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="p-4 space-y-3">

        {/* Header */}
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Reconciliation</h1>
          <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Finance · Audit Tool</p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <form onSubmit={(e) => void handleRun(e)} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">From *</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">To *</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Organization ID</label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Optional"
                className={`${INPUT_CLS} w-44`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Guardian ID / Name</label>
              <input
                type="text"
                value={guardianId}
                onChange={(e) => setGuardianId(e.target.value)}
                placeholder="Optional"
                className={`${INPUT_CLS} w-44`}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !from || !to}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded transition-colors cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
              Run Report
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded bg-red-50 border border-red-200 flex items-center justify-between gap-4">
            <span className="text-[11px] text-red-700">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex items-center gap-1 text-[11px] text-red-600 font-medium hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Dismiss
            </button>
          </div>
        )}

        {/* Summary row */}
        {rows !== null && !loading && (
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: 'Assignments', value: String(rows.length) },
              { label: 'Billable Hours', value: fmtHours(totalBillableHours) },
              { label: 'Invoice Total', value: formatRWF(totalInvoiceAmount) },
              { label: 'Flagged Rows', value: String(flaggedCount), warn: flaggedCount > 0 },
            ].map(({ label, value, warn }) => (
              <div key={label} className={`bg-white border rounded p-3 ${warn ? 'border-amber-300 border-t-[3px] border-t-amber-400' : 'border-slate-200 border-t-[3px] border-t-slate-300'}`}>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className={`font-mono text-lg font-bold ${warn ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Results table */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {rows !== null && !loading && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Clock className="w-8 h-8 text-slate-300" />
                <p className="text-[11px] text-slate-400">No assignments found for the selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Job Ref', 'Organization', 'Guardian', 'Scheduled', 'Actual', 'Billable Hrs', 'Invoice', 'Flags'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const scheduledHrs = row.scheduledHours.toFixed(2);
                      return (
                        <tr key={row.assignmentId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <Link
                              to={`/assignments/${row.assignmentId}`}
                              className="font-mono text-[11px] text-[#14B87A] hover:underline bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm"
                            >
                              {row.jobReference}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700">{row.organizationName}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-mono text-[11px] text-slate-500">{row.guardianCode}</p>
                              {row.guardianName && <p className="text-[11px] text-slate-700">{row.guardianName}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[11px] text-slate-600 whitespace-nowrap">
                              {fmtDateTime(row.scheduledStart)} →
                            </p>
                            <p className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDateTime(row.scheduledEnd)}</p>
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">{scheduledHrs}h sched.</p>
                          </td>
                          <td className="px-4 py-3">
                            {row.arrivedAt || row.completedAt ? (
                              <div>
                                <p className="text-[11px] text-slate-600 whitespace-nowrap">{fmtDateTime(row.arrivedAt)} →</p>
                                <p className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDateTime(row.completedAt)}</p>
                                <p className="font-mono text-[10px] text-slate-400 mt-0.5">{fmtHours(row.actualHours)} actual</p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-[11px] font-semibold text-slate-800">{fmtHours(row.billableHours)}</p>
                            {row.billingBasis && (
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{row.billingBasis}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {row.invoiceStatus ? (
                              <div>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest border ${
                                  row.invoiceStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  row.invoiceStatus === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {row.invoiceStatus}
                                </span>
                                {row.invoiceTotal && (
                                  <p className="font-mono text-[10px] text-slate-500 mt-1">{formatRWF(Number(row.invoiceTotal))}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {row.earlyCompletion && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Early completion
                                </span>
                              )}
                              {row.lateArrival && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> Late arrival
                                </span>
                              )}
                              {!row.earlyCompletion && !row.lateArrival && (
                                <span className="text-[11px] text-slate-300">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
