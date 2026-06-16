import { Banknote, ChevronLeft, ChevronRight, Loader2, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  createGuardianPayout,
  fetchGuardianEarnings,
  PAYOUT_PROVIDER_LABELS,
  type EarningStatus,
  type GuardianEarningRow,
  type PayoutProvider,
} from '@/services/api/payouts';
import { cn, formatRWF } from '@/lib/utils';

const STATUS_BADGES: Record<EarningStatus, { label: string; cls: string }> = {
  PENDING_PAYOUT: { label: 'Pending payout', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  PAID:           { label: 'Paid',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  BLOCKED:        { label: 'Needs review',   cls: 'bg-red-50 text-red-600 border-red-200' },
  CANCELLED:      { label: 'Cancelled',      cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const FILTERS: { key: EarningStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',            label: 'All' },
  { key: 'PENDING_PAYOUT', label: 'Pending' },
  { key: 'PAID',           label: 'Paid' },
  { key: 'BLOCKED',        label: 'Blocked' },
  { key: 'CANCELLED',      label: 'Cancelled' },
];

interface Props {
  guardianId: string;
}

export function GuardianEarningsPanel({ guardianId }: Props) {
  const [rows, setRows]         = useState<GuardianEarningRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [filter, setFilter]     = useState<EarningStatus | 'ALL'>('ALL');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<PayoutProvider>('MOMO_MTN');
  const [creating, setCreating] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const LIMIT = 10;

  const load = useCallback((p: number, f: EarningStatus | 'ALL') => {
    return fetchGuardianEarnings(guardianId, p, LIMIT, f === 'ALL' ? undefined : f)
      .then((res) => {
        setRows(res.items);
        setTotal(res.meta.total);
        setError(null);
      })
      .catch((err: unknown) => {
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Failed to load earnings');
      })
      .finally(() => setLoading(false));
  }, [guardianId]);

  useEffect(() => { void load(page, filter); }, [load, page, filter]);

  function changeFilter(f: EarningStatus | 'ALL') {
    setLoading(true);
    setFilter(f);
    setPage(1);
    setSelected(new Set());
  }

  function changePage(p: number) {
    setLoading(true);
    setPage(p);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedRows  = rows.filter((r) => selected.has(r.id));
  const selectedTotal = selectedRows.reduce((s, r) => s + Number(r.amount), 0);
  const totalPages    = Math.max(1, Math.ceil(total / LIMIT));

  async function handleCreatePayout() {
    if (!selected.size) return;
    setCreating(true);
    try {
      await createGuardianPayout(guardianId, Array.from(selected), provider);
      setToast({ msg: `Payout created via ${PAYOUT_PROVIDER_LABELS[provider]} — confirm it on the Payouts page once the transfer is sent.`, ok: true });
      setSelected(new Set());
      load(page, filter);
    } catch (err: unknown) {
      setToast({ msg: err instanceof Error ? err.message : 'Failed to create payout', ok: false });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-[#14B87A]" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Earnings & Payouts</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Per-assignment earnings — accrue when the client pays the invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          {FILTERS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => changeFilter(key)}
              className={cn('px-2.5 py-1 text-[10px] font-bold rounded transition-all cursor-pointer',
                filter === key ? 'bg-[#14B87A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className={cn('px-5 py-2.5 text-[11px] font-medium border-b',
          toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100')}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="px-5 py-10 text-center">
          <p className="text-xs text-slate-500">{error}</p>
          <p className="text-[10px] text-slate-400 mt-1">If this persists, the earnings API may not be deployed on this environment yet.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-xs text-slate-400">No earnings {filter !== 'ALL' ? 'with this status' : 'yet'} — earnings appear after the client pays for a job.</p>
        </div>
      ) : (
        <>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 w-8" />
                {['Job', 'Hours', 'Rate', 'Amount', 'Status', 'Accrued'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = STATUS_BADGES[r.status];
                const selectable = r.status === 'PENDING_PAYOUT' && !r.payoutId;
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      {selectable && (
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)}
                          className="w-3.5 h-3.5 accent-[#14B87A] cursor-pointer" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">{r.jobReference ?? `…${r.jobId.slice(-6)}`}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">{Number(r.payableHours).toFixed(1)}h</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">{formatRWF(Number(r.hourlyPayRate))}/h</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 tabular-nums">{formatRWF(Number(r.amount))}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold', badge.cls)}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap">{new Date(r.accruedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400">{total} earning{total === 1 ? '' : 's'} · page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}
                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)}
                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create payout bar */}
      {selected.size > 0 && (
        <div className="px-5 py-3.5 border-t border-slate-200 bg-emerald-50/50 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-700">
            <span className="font-bold">{selected.size}</span> earning{selected.size > 1 ? 's' : ''} selected ·{' '}
            <span className="font-mono font-bold text-slate-900">{formatRWF(selectedTotal)}</span>
          </p>
          <div className="flex items-center gap-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value as PayoutProvider)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] cursor-pointer">
              {Object.entries(PAYOUT_PROVIDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button type="button" onClick={handleCreatePayout} disabled={creating}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] rounded-lg disabled:opacity-50 cursor-pointer">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
              Create Payout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
