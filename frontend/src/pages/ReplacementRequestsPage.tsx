import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  UserX,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  approveReplacement,
  denyReplacement,
  fetchReplacementRequests,
  type ReplacementRequest,
} from '@/services/api/assignments';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function guardianLabel(r: ReplacementRequest): string {
  return r.guardian?.user?.fullName ?? r.guardian?.user?.phoneNumber ?? r.guardian?.guardianCode ?? '—';
}

function orgLabel(r: ReplacementRequest): string {
  return r.job?.organization?.tradingName ?? r.job?.organization?.legalName ?? '—';
}

// ─── Deny inline form ─────────────────────────────────────────────────────────

interface DenyFormProps {
  onConfirm: (note: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function DenyForm({ onConfirm, onCancel, loading }: DenyFormProps) {
  const [note, setNote] = useState('');
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note to guardian…"
        maxLength={500}
        className="flex-1 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400 transition-colors"
        autoFocus
      />
      <button
        type="button"
        onClick={() => onConfirm(note)}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
        Confirm Deny
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReplacementRequestsPage() {
  const [requests, setRequests] = useState<ReplacementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchReplacementRequests()
      .then(setRequests)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleApprove(r: ReplacementRequest) {
    setActionLoading(r.assignmentId);
    try {
      await approveReplacement(r.assignmentId);
      setRequests((prev) => prev.filter((x) => x.assignmentId !== r.assignmentId));
      showToast('Replacement approved — re-dispatch triggered.', true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Approve failed', false);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeny(r: ReplacementRequest, note: string) {
    setActionLoading(r.assignmentId);
    try {
      await denyReplacement(r.assignmentId, note || undefined);
      setRequests((prev) => prev.filter((x) => x.assignmentId !== r.assignmentId));
      setDenyingId(null);
      showToast('Replacement request denied.', true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Deny failed', false);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Replacement Requests</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Operations · Guardian Requests</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`px-4 py-2.5 rounded border flex items-center gap-2 text-xs font-medium ${
            toast.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {toast.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded bg-red-50 border border-red-200 flex items-center justify-between gap-4">
            <span className="text-[11px] text-red-700">{error}</span>
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-1 text-[11px] text-red-600 font-medium hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && requests.length === 0 && (
          <div className="bg-white border border-slate-200 rounded flex flex-col items-center justify-center py-20 gap-3">
            <UserX className="w-10 h-10 text-slate-200" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">No pending replacement requests</p>
          </div>
        )}

        {/* Table */}
        {!loading && requests.length > 0 && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Guardian', 'Job', 'Client', 'Reason', 'Requested', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const isDenying = denyingId === r.assignmentId;
                  const isActing = actionLoading === r.assignmentId;

                  return (
                    <tr
                      key={r.assignmentId}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors align-top"
                    >
                      {/* Guardian */}
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">{guardianLabel(r)}</p>
                        {r.guardian?.guardianCode && (
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">{r.guardian.guardianCode}</p>
                        )}
                      </td>

                      {/* Job */}
                      <td className="px-4 py-3">
                        {r.job ? (
                          <>
                            <span className="font-mono text-[11px] text-[#14B87A] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">
                              {r.job.referenceNumber}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">{r.job.jobType}</p>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3 text-xs text-slate-600">{orgLabel(r)}</td>

                      {/* Reason */}
                      <td className="px-4 py-3 max-w-[240px]">
                        <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{r.reason}</p>
                        {isDenying && (
                          <DenyForm
                            loading={isActing}
                            onConfirm={(note) => void handleDeny(r, note)}
                            onCancel={() => setDenyingId(null)}
                          />
                        )}
                      </td>

                      {/* Requested */}
                      <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {timeAgo(r.requestedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {!isDenying && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleApprove(r)}
                              disabled={isActing}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded transition-colors cursor-pointer"
                            >
                              {isActing
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />}
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setDenyingId(r.assignmentId)}
                              disabled={isActing}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 rounded transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                              Deny
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
