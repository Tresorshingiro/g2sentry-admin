import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  Shield,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InvoiceStatusBadge } from '@/components/shared/InvoiceStatusBadge';
import { formatRWF } from '@/lib/utils';
import { fetchAssignmentById, fetchInvoiceById, fetchOrgById, issueInvoice, resolveDispute, voidInvoice } from '@/services/api';
import type { InvoiceDetail, InvoicePayment, ResolveDisputePayload } from '@/types/billing';

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  PATROL: 'Patrol',
  ESCORT: 'Escort',
  EVENT_SECURITY: 'Event Security',
  DOOR_SUPERVISION: 'Door Supervision',
  VIP_PROTECTION: 'VIP Protection',
  EMERGENCY_RESPONSE: 'Emergency Response',
  COMPOUND_SECURITY: 'Compound Security',
  STATIC_POST: 'Static Post',
};

const PAYMENT_PROVIDER_LABELS: Record<string, string> = {
  MOMO_MTN: 'MTN Mobile Money',
  AIRTEL_MONEY: 'Airtel Money',
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
  COMPLETED: 'bg-green-50 text-green-700 border-green-100',
  FAILED: 'bg-red-50 text-red-700 border-red-100',
  REFUNDED: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', opts ?? {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-50 last:border-0 gap-4">
      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
      <span className="text-[11px] font-medium text-slate-800 text-right">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Dispute resolve modal ────────────────────────────────────────────────────

function ResolveDisputeModal({
  invoiceId,
  onClose,
  onResolved,
}: {
  invoiceId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [action, setAction] = useState<'CLEAR' | 'VOID'>('CLEAR');
  const [note, setNote] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (action === 'VOID' && !voidReason.trim()) {
      setError('Void reason is required when voiding an invoice');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ResolveDisputePayload = {
        action,
        note: note || undefined,
        voidReason: action === 'VOID' ? voidReason : undefined,
        replacementInvoiceId: action === 'VOID' && replacementId ? replacementId : undefined,
      };
      await resolveDispute(invoiceId, payload);
      onResolved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve dispute');
    } finally {
      setSaving(false);
    }
  }

  const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] focus:border-[#14B87A] transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Resolve Dispute</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Action</label>
            <div className="flex gap-4">
              {(['CLEAR', 'VOID'] as const).map((a) => (
                <label key={a} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value={a}
                    checked={action === a}
                    onChange={() => setAction(a)}
                    className="accent-[#14B87A]"
                  />
                  <span className="text-xs text-slate-700">{a === 'CLEAR' ? 'Clear (restore to previous status)' : 'Void'}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className={INPUT_CLS}
              placeholder="Add a note…"
            />
            <p className="text-[10px] text-slate-400 mt-0.5 text-right">{note.length}/500</p>
          </div>

          {action === 'VOID' && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Void Reason *</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className={INPUT_CLS}
                  required
                  placeholder="Explain why this invoice is being voided…"
                />
                <p className="text-[10px] text-slate-400 mt-0.5 text-right">{voidReason.length}/500</p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Replacement Invoice ID (optional)</label>
                <input
                  type="text"
                  value={replacementId}
                  onChange={(e) => setReplacementId(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="UUID of replacement invoice"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Resolve Dispute
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchInvoiceById(id)
      .then(async (inv) => {
        setInvoice(inv);
        setLoading(false);
        // Fetch org name and full job details in parallel — the invoice endpoint
        // only returns minimal job context (referenceNumber + status)
        const [org, jobData] = await Promise.all([
          fetchOrgById(inv.organizationId).catch(() => null),
          fetchAssignmentById(inv.jobId).catch(() => null),
        ]);
        if (org) setOrgName(org.tradingName ?? org.legalName);
        if (jobData) {
          const j = jobData as {
            id: string; referenceNumber: string; jobType: string; priority: string;
            status: string; requestedGuardianCount: number;
            scheduledStart: string; scheduledEnd: string | null;
            notes: string | null; specialInstructions: string | null;
          };
          setInvoice((prev) => prev ? {
            ...prev,
            job: {
              id: j.id,
              referenceNumber: j.referenceNumber,
              jobType: j.jobType ?? '',
              priority: j.priority ?? '',
              status: j.status,
              requestedGuardianCount: j.requestedGuardianCount ?? 0,
              scheduledStart: j.scheduledStart ?? '',
              scheduledEnd: j.scheduledEnd ?? '',
              notes: j.notes ?? null,
              specialInstructions: j.specialInstructions ?? null,
            },
          } : prev);
        }
      })
      .catch(() => {
        setError('Invoice not found');
        setLoading(false);
      });
  }, [id]);

  async function handleIssue() {
    if (!invoice) return;
    setActionLoading(true);
    await issueInvoice(invoice.id).catch(() => null);
    const updated = await fetchInvoiceById(invoice.id).catch(() => null);
    if (updated) setInvoice(updated);
    setActionLoading(false);
  }

  async function handleVoid() {
    if (!invoice) return;
    setActionLoading(true);
    await voidInvoice(invoice.id).catch(() => null);
    const updated = await fetchInvoiceById(invoice.id).catch(() => null);
    if (updated) setInvoice(updated);
    setActionLoading(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
        <div className="p-4 space-y-3">
          <div className="h-8 w-32 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-40 bg-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 h-36 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-36 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !invoice) {
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
        <div className="p-4">
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to billing
          </button>
          <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
            <p className="text-sm font-medium text-red-600">{error ?? 'Invoice not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const job = invoice.job;
  const isOverdue =
    invoice.dueAt &&
    new Date(invoice.dueAt) < new Date() &&
    invoice.status !== 'PAID' &&
    invoice.status !== 'VOID';

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer shadow-sm"
              aria-label="Back to billing"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Invoice Detail</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {job?.referenceNumber ?? invoice.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {invoice.status === 'DISPUTED' && (
              <button
                type="button"
                onClick={() => setResolveModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Resolve Dispute
              </button>
            )}
            {invoice.status !== 'DISPUTED' && invoice.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => void handleIssue()}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Issue invoice
              </button>
            )}
            {invoice.status !== 'DISPUTED' && invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
              <button
                type="button"
                onClick={() => void handleVoid()}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <XCircle className="w-3.5 h-3.5" /> Void invoice
              </button>
            )}
          </div>
        </div>

        {/* Invoice Hero Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <InvoiceStatusBadge status={invoice.status} />
                {isOverdue && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-semibold text-red-600">
                    Overdue
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {job?.referenceNumber ?? '—'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {JOB_TYPE_LABELS[job?.jobType ?? ''] ?? 'Security services'}
                {orgName ? ` · ${orgName}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-slate-900 leading-none tabular-nums">
                {formatRWF(Number(invoice.total))}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Total incl. VAT · {invoice.currency}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Created</p>
              <p className="text-xs font-medium text-slate-700">{fmtDate(invoice.createdAt)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Issued</p>
              <p className="text-xs font-medium text-slate-700">{fmtDate(invoice.issuedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Due date</p>
              <p className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-700'}`}>
                {fmtDate(invoice.dueAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Dispute Info Card */}
        {invoice.status === 'DISPUTED' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-900 mb-1">Invoice Under Dispute</p>
              {invoice.disputeReason && (
                <p className="text-xs text-amber-800 mb-2">{invoice.disputeReason}</p>
              )}
              <div className="flex flex-wrap gap-4 text-[11px] text-amber-700">
                {invoice.disputedAt && (
                  <span>Disputed at: <span className="font-medium">{fmtDateTime(invoice.disputedAt)}</span></span>
                )}
                {invoice.statusBeforeDispute && (
                  <span>Status before dispute: <span className="font-medium">{invoice.statusBeforeDispute}</span></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Breakdown + Job Details */}
        <div className="grid grid-cols-3 gap-3">

          {/* Amount Breakdown */}
          <SectionCard title="Invoice Breakdown" icon={<FileText className="w-3.5 h-3.5" />}>
            <div className="space-y-1">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[11px] text-slate-500">Subtotal</span>
                <span className="text-[11px] font-medium text-slate-800 tabular-nums">
                  {formatRWF(Number(invoice.subtotal))}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[11px] text-slate-500">VAT (18%)</span>
                <span className="text-[11px] font-medium text-slate-800 tabular-nums">
                  {formatRWF(Number(invoice.taxAmount))}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-900">Total</span>
                <span className="text-sm font-bold text-emerald-600 tabular-nums">
                  {formatRWF(Number(invoice.total))}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 pb-1">
                <span className="text-[11px] text-slate-400">Currency</span>
                <span className="text-[11px] font-medium text-slate-600">{invoice.currency}</span>
              </div>
            </div>
          </SectionCard>

          {/* Job Details */}
          <div className="col-span-2">
            <SectionCard title="Job Details" icon={<Shield className="w-3.5 h-3.5" />}>
              {job ? (
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <InfoRow label="Job type" value={JOB_TYPE_LABELS[job.jobType] ?? job.jobType} />
                    <InfoRow label="Priority" value={job.priority} />
                    <InfoRow label="Guardians requested" value={String(job.requestedGuardianCount)} />
                    <InfoRow label="Job status" value={job.status} />
                  </div>
                  <div>
                    <InfoRow
                      label="Scheduled start"
                      value={fmtDateTime(job.scheduledStart)}
                    />
                    <InfoRow
                      label="Scheduled end"
                      value={fmtDateTime(job.scheduledEnd)}
                    />
                    <InfoRow label="Notes" value={job.notes} />
                    <InfoRow label="Special instructions" value={job.specialInstructions} />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">Job details not available</p>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Payments */}
        <SectionCard
          title={`Payment History (${invoice.payments.length})`}
          icon={<CreditCard className="w-3.5 h-3.5" />}
        >
          {invoice.payments.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-4">No payments recorded yet</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Provider', 'Amount', 'Status', 'Paid at', 'Transaction ref'].map((h) => (
                      <th
                        key={h}
                        className="pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap pr-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p: InvoicePayment) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-medium text-slate-800">
                          {PAYMENT_PROVIDER_LABELS[p.provider] ?? p.provider}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs font-semibold text-slate-900 tabular-nums">
                        {formatRWF(Number(p.amount))}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold
                          ${PAYMENT_STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-500">
                        {fmtDateTime(p.paidAt)}
                      </td>
                      <td className="py-2.5">
                        <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {p.externalTxnId ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* EBM Receipt */}
        {invoice.ebmReceipt && (
          <SectionCard title="EBM Fiscal Receipt" icon={<Receipt className="w-3.5 h-3.5" />}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <BadgeCheck className="w-5 h-5 text-[#14B87A]" />
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-x-6">
                  <InfoRow label="Receipt number" value={invoice.ebmReceipt.receiptNumber} />
                  <InfoRow label="Issued at" value={fmtDateTime(invoice.ebmReceipt.issuedAt)} />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  This receipt was generated by Rwanda Revenue Authority Electronic Billing Machine (EBM) and is stored on the system.
                </p>
              </div>
            </div>
          </SectionCard>
        )}

      </div>

      {resolveModalOpen && (
        <ResolveDisputeModal
          invoiceId={invoice.id}
          onClose={() => setResolveModalOpen(false)}
          onResolved={async () => {
            setResolveModalOpen(false);
            const updated = await fetchInvoiceById(invoice.id).catch(() => null);
            if (updated) setInvoice(updated);
          }}
        />
      )}
    </div>
  );
}
