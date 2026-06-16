import {
  ArrowUpRight,
  Banknote,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCcw,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  confirmGuardianPayout,
  fetchAllPayouts,
  PAYOUT_PROVIDER_LABELS,
  type GuardianPayoutRow,
  type PayoutStatus,
} from '@/services/api/payouts';
import { cn, formatRWF } from '@/lib/utils';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

const STATUS_CONFIG: Record<PayoutStatus, { label: string; dot: string; badge: string }> = {
  PENDING:   { label: 'Pending',   dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Completed', dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED:    { label: 'Failed',    dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 border-red-200' },
};

type ViewTab = 'ALL' | PayoutStatus;

const TABS: { key: ViewTab; label: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'PENDING',   label: 'Pending' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'FAILED',    label: 'Failed' },
];

const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function guardianName(p: GuardianPayoutRow): string {
  return p.guardian?.user?.fullName ?? p.guardian?.guardianCode ?? '—';
}

function guardianInitials(p: GuardianPayoutRow): string {
  const n = p.guardian?.user?.fullName;
  if (n) return n.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return p.guardian?.guardianCode?.slice(0, 2).toUpperCase() ?? '??';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── Confirm inline form ──────────────────────────────────────────────────────

interface ConfirmFormProps {
  onConfirm: (txnId: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmForm({ onConfirm, onCancel, loading }: ConfirmFormProps) {
  const [txnId, setTxnId] = useState('');
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={txnId}
        autoFocus
        onChange={(e) => setTxnId(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !loading) onConfirm(txnId.trim()); }}
        placeholder="MoMo / bank ref (optional)…"
        maxLength={100}
        className="w-44 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] focus:border-[#14B87A] transition-all"
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => onConfirm(txnId.trim())}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded transition-colors cursor-pointer"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
        Confirm
      </button>
      <button type="button" disabled={loading} onClick={onCancel}
        className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PayoutsPage() {
  const navigate = useNavigate();

  const [payouts, setPayouts]             = useState<GuardianPayoutRow[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [tab, setTab]                     = useState<ViewTab>('ALL');
  const [confirmingId, setConfirmingId]   = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LIMIT = 20;

  const load = useCallback((p: number) => {
    return fetchAllPayouts(p, LIMIT)
      .then((res) => { setPayouts(res.items); setTotal(res.meta.total); setError(null); })
      .catch((err: unknown) => { setPayouts([]); setTotal(0); setError(err instanceof Error ? err.message : 'Failed to load payouts'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  function showToast(msg: string, ok: boolean) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  async function handleConfirm(p: GuardianPayoutRow, txnId: string) {
    setActionLoading(true);
    try {
      await confirmGuardianPayout(p.id, txnId || undefined);
      setConfirmingId(null);
      showToast(`Payout of ${formatRWF(Number(p.amount))} marked as paid.`, true);
      load(page);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to confirm payout', false);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const totalPages     = Math.max(1, Math.ceil(total / LIMIT));
  const allPending     = payouts.filter((p) => p.status === 'PENDING');
  const allCompleted   = payouts.filter((p) => p.status === 'COMPLETED');
  const pendingAmount  = allPending.reduce((s, p) => s + Number(p.amount), 0);
  const paidAmount     = allCompleted.reduce((s, p) => s + Number(p.amount), 0);

  const visible = tab === 'ALL' ? payouts : payouts.filter((p) => p.status === tab);

  const tabCount: Record<ViewTab, number> = {
    ALL:       payouts.length,
    PENDING:   allPending.length,
    COMPLETED: allCompleted.length,
    FAILED:    payouts.filter((p) => p.status === 'FAILED').length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]" style={{ fontFamily: IBM }}>
      <div className="p-4 space-y-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Guardian Payouts</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Finance · Disbursement history</p>
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); load(page); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCcw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Stat cards ── */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-2.5">
            {/* Total */}
            <div className="bg-white border border-slate-200 border-t-[3px] border-t-[#14B87A] rounded p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Payouts</p>
                <Banknote className="w-4 h-4 text-slate-200" />
              </div>
              <p className="font-mono text-[26px] font-bold text-slate-900 leading-none">{total}</p>
              <p className="text-[10px] text-slate-400 mt-2">
                {total === 1 ? '1 record' : `${total} records`} · page {page}/{totalPages}
              </p>
            </div>

            {/* Pending */}
            <div className="bg-white border border-slate-200 border-t-[3px] border-t-amber-400 rounded p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Confirmation</p>
                <Clock className="w-4 h-4 text-slate-200" />
              </div>
              <p className="font-mono text-[26px] font-bold text-slate-900 leading-none">{allPending.length}</p>
              <p className="text-[10px] mt-2">
                {allPending.length > 0
                  ? <span className="text-amber-600 font-semibold">{formatRWF(pendingAmount)} to disburse</span>
                  : <span className="text-slate-400">Nothing pending on this page</span>}
              </p>
            </div>

            {/* Completed */}
            <div className="bg-white border border-slate-200 border-t-[3px] border-t-sky-400 rounded p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Confirmed Payouts</p>
                <CheckCircle className="w-4 h-4 text-slate-200" />
              </div>
              <p className="font-mono text-[26px] font-bold text-slate-900 leading-none">{allCompleted.length}</p>
              <p className="text-[10px] mt-2">
                {allCompleted.length > 0
                  ? <span className="text-sky-600 font-semibold">{formatRWF(paidAmount)} disbursed</span>
                  : <span className="text-slate-400">None confirmed on this page</span>}
              </p>
            </div>
          </div>
        )}

        {/* ── Toast ── */}
        {toast && (
          <div className={cn(
            'flex items-center gap-2 rounded px-4 py-2.5 text-xs font-medium border',
            toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200',
          )}>
            {toast.ok ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* ── Main card ── */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">

          {/* Tabs + meta row */}
          {!loading && !error && payouts.length > 0 && (
            <div className="flex items-center justify-between border-b border-slate-100 px-1 pt-1">
              <div className="flex items-center">
                {TABS.map(({ key, label }) => {
                  const count = tabCount[key];
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={cn(
                        'relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer',
                        active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600',
                      )}
                    >
                      {label}
                      {count > 0 && (
                        <span className={cn(
                          'inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold',
                          active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
                        )}>
                          {count}
                        </span>
                      )}
                      {active && (
                        <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#14B87A] rounded-t-full" />
                      )}
                    </button>
                  );
                })}
              </div>
              {allPending.length > 0 && (
                <div className="flex items-center gap-1.5 mr-4 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-amber-700">{allPending.length} need confirmation</span>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              <p className="text-xs text-slate-400">Loading payouts…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <div className="w-10 h-10 rounded bg-red-50 border border-red-100 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-red-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Unable to load payouts</p>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => { setLoading(true); load(page); }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6">
              <div className="w-12 h-12 rounded bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600">
                  {tab === 'ALL' ? 'No payouts yet' : `No ${tab.toLowerCase()} payouts`}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
                  {tab === 'ALL'
                    ? "Open a guardian's profile, select pending earnings, and click Create Payout."
                    : 'Switch to All to see the full list.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {['Guardian', 'Amount', 'Provider', 'Reference', 'Status', 'Created', 'Paid', ''].map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((p) => {
                    const cfg      = STATUS_CONFIG[p.status];
                    const gid      = p.guardian?.id ?? p.id;
                    const color    = avatarColor(gid);
                    const name     = guardianName(p);
                    const initials = guardianInitials(p);
                    const canNav   = Boolean(p.guardian?.id);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">

                        {/* Guardian */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              'w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-[11px] font-bold',
                              color,
                            )}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => canNav && navigate(`/guardians/${p.guardian!.id}`)}
                                className={cn(
                                  'text-xs font-semibold text-slate-800 truncate max-w-[140px] flex items-center gap-1 text-left',
                                  canNav && 'cursor-pointer group-hover:text-[#14B87A] transition-colors',
                                )}
                              >
                                {name}
                                {canNav && (
                                  <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                )}
                              </button>
                              {p.guardian?.guardianCode && (
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.guardian.guardianCode}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {formatRWF(Number(p.amount))}
                          </span>
                        </td>

                        {/* Provider */}
                        <td className="px-4 py-3.5">
                          <span className="inline-block text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-medium whitespace-nowrap">
                            {PAYOUT_PROVIDER_LABELS[p.provider] ?? p.provider}
                          </span>
                        </td>

                        {/* Reference */}
                        <td className="px-4 py-3.5">
                          {p.externalTxnId ? (
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 truncate max-w-[110px] inline-block">
                              {p.externalTxnId}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs select-none">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap',
                            cfg.badge,
                          )}>
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot,
                              p.status === 'PENDING' && 'animate-pulse')} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3.5">
                          <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                            {fmtDate(p.createdAt)}
                          </span>
                        </td>

                        {/* Paid */}
                        <td className="px-4 py-3.5">
                          {p.paidAt ? (
                            <span className="text-[11px] text-emerald-600 font-semibold whitespace-nowrap tabular-nums">
                              {fmtDate(p.paidAt)}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs select-none">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-right">
                          {p.status === 'PENDING' && (
                            confirmingId === p.id ? (
                              <ConfirmForm
                                loading={actionLoading}
                                onConfirm={(txnId) => void handleConfirm(p, txnId)}
                                onCancel={() => setConfirmingId(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmingId(p.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#14B87A] border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 rounded transition-all cursor-pointer ml-auto whitespace-nowrap"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Mark Paid
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-600">{total}</span> payout{total !== 1 ? 's' : ''} total
                  {' · '}page <span className="font-semibold text-slate-600">{page}</span> of <span className="font-semibold text-slate-600">{totalPages}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => { setLoading(true); setPage((p) => p - 1); }}
                    className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => { setLoading(true); setPage((p) => p + 1); }}
                    className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-30 cursor-pointer disabled:cursor-default transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
