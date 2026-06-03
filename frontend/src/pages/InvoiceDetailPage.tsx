import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileText,
  Receipt,
  Shield,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InvoiceStatusBadge } from '@/components/shared/InvoiceStatusBadge';
import { formatRWF } from '@/lib/utils';
import { fetchInvoiceById, fetchOrgById, issueInvoice, voidInvoice } from '@/services/api';
import type { InvoiceDetail, InvoicePayment } from '@/types/billing';

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchInvoiceById(id)
      .then(async (inv) => {
        setInvoice(inv);
        setLoading(false);
        const org = await fetchOrgById(inv.organizationId).catch(() => null);
        if (org) setOrgName(org.tradingName ?? org.legalName);
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
            {invoice.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => void handleIssue()}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Issue invoice
              </button>
            )}
            {invoice.status !== 'PAID' && invoice.status !== 'VOID' && (
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
    </div>
  );
}
