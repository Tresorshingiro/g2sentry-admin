import {
  Award,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileUp,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Shield,
  Star,
  UserCheck,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { GuardianEarningsPanel } from '@/components/shared/GuardianEarningsPanel';
import { cn } from '@/lib/utils';
import {
  activateGuardian,
  addCertification,
  fetchGuardianProfile,
  reviewCertification,
  reviewGuardian,
  suspendGuardian,
  uploadDocument,
  type AddCertificationPayload,
} from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
const CERT_TYPE_LABELS: Record<string, string> = {
  FIRST_AID: 'First Aid',
  CROWD_CONTROL: 'Crowd Control',
  FIREARM: 'Firearm',
  RESERVE_FORCE: 'Reserve Force',
  RNP_SECURITY_LICENSE: 'RNP Security License',
};

const CERT_TYPES = Object.entries(CERT_TYPE_LABELS).map(([value, label]) => ({ value, label })) as
  { value: AddCertificationPayload['certificationType']; label: string }[];

interface GuardianDetail {
  id: string;
  guardianCode: string;
  status: string;
  verificationStatus: string;
  rating: string;
  districtBase: string;
  employmentType: string;
  specializations: string[];
  joinedAt: string;
  user: { fullName: string | null; phoneNumber: string; email: string | null };
  shiftState: { shiftStatus: string; availableForJobs: boolean } | null;
  certifications: {
    id: string;
    certificationType: string;
    verificationStatus: string;
    issuer: string;
    issueDate: string;
    expiryDate: string | null;
    documentId: string | null;
  }[];
  vettingRecord: {
    rnpReferenceNumber: string | null;
    reserveForceVerified: boolean;
    notes: string | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string | null, phone: string) {
  if (!name) return phone.slice(-2).toUpperCase();
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function fmtPhone(phone: string) {
  if (phone.startsWith('+250') && phone.length === 13)
    return `+250 ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  return phone;
}

function employmentLabel(t: string) {
  if (t === 'FULL_TIME') return 'Full-time';
  if (t === 'PART_TIME') return 'Part-time';
  if (t === 'RESERVE') return 'Reserve';
  return t;
}

function certVerifColor(s: string) {
  if (s === 'VERIFIED') return 'text-green-600 bg-green-50 ring-1 ring-green-200';
  if (s === 'REJECTED' || s === 'EXPIRED') return 'text-red-600 bg-red-50 ring-1 ring-red-200';
  return 'text-amber-600 bg-amber-50 ring-1 ring-amber-200';
}

// ── Workflow step indicator ───────────────────────────────────────────────────
function WorkflowStep({
  label,
  state,
  isLast,
}: {
  label: string;
  state: 'done' | 'active' | 'pending' | 'rejected';
  isLast?: boolean;
}) {
  const icon = {
    done:     <CheckCircle2 className="w-4 h-4" />,
    active:   <Zap className="w-4 h-4" />,
    pending:  <div className="w-2 h-2 rounded-full bg-current" />,
    rejected: <XCircle className="w-4 h-4" />,
  }[state];

  const color = {
    done:     'text-green-400 border-green-500/40 bg-green-500/10',
    active:   'text-blue-400 border-blue-500/40 bg-blue-500/10',
    pending:  'text-slate-500 border-slate-600 bg-slate-800',
    rejected: 'text-red-400 border-red-500/40 bg-red-500/10',
  }[state];

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-7 h-7 rounded border flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <span className={cn('text-xs font-medium', state === 'pending' ? 'text-slate-500' : 'text-white')}>
        {label}
      </span>
      {!isLast && <div className="w-8 h-px bg-slate-700 mx-1" />}
    </div>
  );
}

// ── Inline field row ──────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="w-36 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 pt-1">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value || '—'}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function GuardianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [certBusy, setCertBusy] = useState<string | null>(null);

  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState<AddCertificationPayload>({
    certificationType: 'FIRST_AID', issuer: '', issueDate: '', expiryDate: '',
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSubmitting, setCertSubmitting] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    const data = await fetchGuardianProfile(id);
    setGuardian(data as GuardianDetail);
  }

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const g = await fetchGuardianProfile(id!);
        setGuardian(g as GuardianDetail);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  function flash(text: string, ok: boolean) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function doAction(fn: () => Promise<unknown>, successMsg: string) {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      await fn();
      await reload();
      flash(successMsg, true);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerify() {
    await doAction(() => reviewGuardian(id!, 'VERIFIED'), 'Identity verified. You can now activate this guardian.');
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await doAction(() => reviewGuardian(id!, 'REJECTED', rejectReason.trim()), 'Guardian rejected.');
    setShowRejectInput(false);
    setRejectReason('');
  }

  async function handleActivate() {
    await doAction(() => activateGuardian(id!), 'Guardian activated successfully.');
  }

  async function handleSuspend() {
    await doAction(() => suspendGuardian(id!), 'Guardian suspended.');
  }

  async function handleVerifyCert(certId: string) {
    setCertBusy(certId + '-v');
    try {
      await reviewCertification(certId, 'VERIFIED');
      await reload();
      flash('Certification verified.', true);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setCertBusy(null);
    }
  }

  async function handleRejectCert(certId: string) {
    setCertBusy(certId + '-r');
    try {
      await reviewCertification(certId, 'REJECTED');
      await reload();
      flash('Certification rejected.', false);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setCertBusy(null);
    }
  }

  async function handleAddCert(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setCertSubmitting(true);
    setCertError(null);
    try {
      const documentId = certFile ? await uploadDocument(certFile) : undefined;
      await addCertification(id, {
        certificationType: certForm.certificationType,
        issuer: certForm.issuer,
        issueDate: certForm.issueDate,
        ...(certForm.expiryDate && { expiryDate: certForm.expiryDate }),
        ...(documentId          && { documentId }),
      });
      setShowCertForm(false);
      setCertForm({ certificationType: 'FIRST_AID', issuer: '', issueDate: '', expiryDate: '' });
      setCertFile(null);
      await reload();
      flash('Certification added.', true);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Failed to add certification');
    } finally {
      setCertSubmitting(false);
    }
  }

  async function viewDocument(documentId: string) {
    const token = localStorage.getItem('g2sentry_token');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/verification/documents/${documentId}/content`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { flash('Could not load document.', false); return; }

      const bytes = await res.arrayBuffer();
      const magic = new Uint8Array(bytes.slice(0, 5));
      console.log('[doc] status:', res.status, 'content-type:', res.headers.get('Content-Type'), 'size:', bytes.byteLength, 'magic:', Array.from(magic).map(b => b.toString(16).padStart(2,'0')).join(' '), 'text:', new TextDecoder().decode(bytes.slice(0, 100)));

      let mimeType: string;
      if (magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46) {
        mimeType = 'application/pdf';
      } else if (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) {
        mimeType = 'image/jpeg';
      } else if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) {
        mimeType = 'image/png';
      } else {
        mimeType = res.headers.get('Content-Type') ?? 'application/octet-stream';
        if (mimeType.includes('application/json')) {
          flash('Document preview not yet available.', false); return;
        }
      }

      const blob = new Blob([bytes], { type: mimeType });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), target: '_blank', rel: 'noopener noreferrer',
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      flash('Could not load document.', false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!guardian) return <div className="p-6 text-slate-500">Guardian not found.</div>;

  const name = guardian.user.fullName ?? guardian.user.phoneNumber;
  const rating = Number(guardian.rating);

  const verifyState =
    guardian.verificationStatus === 'VERIFIED' ? 'done'
    : guardian.verificationStatus === 'REJECTED' ? 'rejected'
    : 'pending';

  const activateState =
    guardian.status === 'ACTIVE' ? 'done'
    : guardian.status === 'SUSPENDED' ? 'rejected'
    : guardian.verificationStatus === 'VERIFIED' ? 'active'
    : 'pending';

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50" style={{ fontFamily: IBM }}>

      {/* ── Dark banner ── */}
      <div className="relative bg-[#0D1117] px-4 sm:px-6 pt-6 sm:pt-8 pb-5 sm:pb-6 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded bg-green-700 flex items-center justify-center text-white text-base sm:text-xl font-bold ring-4 ring-green-500/20 shrink-0 select-none">
            {initials(guardian.user.fullName, guardian.user.phoneNumber)}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-white text-base sm:text-lg font-bold tracking-tight">{name}</h1>
                {guardian.status === 'ACTIVE' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
                )}
                {guardian.status === 'SUSPENDED' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Suspended</span>
                )}
                {guardian.status === 'INACTIVE' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700 text-slate-400 border border-slate-600">Inactive</span>
                )}
                {guardian.employmentType && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 text-slate-400 border border-white/10">
                    {employmentLabel(guardian.employmentType)}
                  </span>
                )}
              </div>
              <PermissionGate permission="admin:guardians:write">
                <button
                  type="button"
                  onClick={() => navigate(`/guardians/${id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-white/10 rounded hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Edit</span>
                </button>
              </PermissionGate>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                <code className="font-mono">{guardian.guardianCode}</code>
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {guardian.districtBase}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> {fmtPhone(guardian.user.phoneNumber)}
              </span>
            </div>

            {/* Workflow steps */}
            <div className="flex items-center flex-wrap gap-y-2 mt-3">
              <WorkflowStep label="Registered" state="done" />
              <WorkflowStep label="Identity verified" state={verifyState} />
              <WorkflowStep label="Activated" state={activateState} isLast />
            </div>
          </div>
        </div>
      </div>

      {/* ── Flash message ── */}
      {actionMsg && (
        <div className={cn(
          'mx-5 mt-4 px-4 py-2.5 rounded text-sm flex items-center gap-2',
          actionMsg.ok
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700',
        )}>
          {actionMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* ── Content ── */}
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-4 sm:gap-5 items-start">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 space-y-4 w-full">

          {/* Profile info */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Profile</h2>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Phone" value={fmtPhone(guardian.user.phoneNumber)} />
              <InfoRow label="Email" value={guardian.user.email ?? '—'} />
              <InfoRow label="Employment" value={employmentLabel(guardian.employmentType)} />
              <InfoRow label="District base" value={guardian.districtBase} />
              <InfoRow label="Joined" value={new Date(guardian.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              {guardian.specializations.length > 0 && (
                <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                  <span className="w-36 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 pt-1">Specializations</span>
                  <div className="flex flex-wrap gap-1.5">
                    {guardian.specializations.map((s) => (
                      <span key={s} className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 rounded">
                        {s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {rating > 0 && (
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-36 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Rating</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} className={cn('w-3.5 h-3.5', n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
                      ))}
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-700">{rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shift state */}
          {guardian.shiftState && (
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Current shift</h2>
              </div>
              <div className="px-5 py-1">
                <InfoRow label="Shift status" value={guardian.shiftState.shiftStatus.replace(/_/g, ' ')} />
                <InfoRow label="Available for jobs" value={guardian.shiftState.availableForJobs ? 'Yes' : 'No'} />
              </div>
            </div>
          )}

          {/* RNP Vetting */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <Award className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">RNP Vetting</h2>
            </div>
            <div className="px-5 py-1">
              {guardian.vettingRecord ? (
                <>
                  <InfoRow label="RNP reference" value={guardian.vettingRecord.rnpReferenceNumber ?? '—'} />
                  <InfoRow label="Reserve force" value={guardian.vettingRecord.reserveForceVerified ? 'Verified' : 'Not verified'} />
                  {guardian.vettingRecord.notes && <InfoRow label="Notes" value={guardian.vettingRecord.notes} />}
                </>
              ) : (
                <p className="py-4 text-sm text-slate-400">No vetting record on file.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">

          {/* Context-aware action card */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Actions</h2>
            </div>
            <div className="p-4 space-y-2.5">

              {/* ── PENDING: show verify + reject ── */}
              {guardian.verificationStatus === 'PENDING' && (
                <PermissionGate permission="admin:verification:write">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <p className="text-xs text-amber-700 leading-relaxed">
                        This guardian's identity is <strong>pending verification</strong>. Verify to allow activation.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleVerify}
                      className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Verify identity
                    </button>
                    {!showRejectInput ? (
                      <button
                        type="button"
                        onClick={() => setShowRejectInput(true)}
                        className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <textarea
                          autoFocus
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection…"
                          rows={3}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                            className="flex-1 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!rejectReason.trim() || actionLoading}
                            onClick={handleReject}
                            className="flex-1 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                          >
                            Confirm rejection
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </PermissionGate>
              )}

              {/* ── VERIFIED + INACTIVE: show activate ── */}
              {guardian.verificationStatus === 'VERIFIED' && guardian.status !== 'ACTIVE' && guardian.status !== 'SUSPENDED' && (
                <PermissionGate permission="admin:guardians:activate">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-green-700 leading-relaxed">
                        Identity verified. Click below to <strong>activate this guardian</strong> and allow them to take jobs.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleActivate}
                      className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Activate guardian
                    </button>
                  </div>
                </PermissionGate>
              )}

              {/* ── ACTIVE: show suspend ── */}
              {guardian.status === 'ACTIVE' && (
                <PermissionGate permission="admin:guardians:suspend">
                  <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-green-700">Guardian is <strong>active</strong> and available for dispatch.</p>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleSuspend}
                    className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Suspend guardian
                  </button>
                </PermissionGate>
              )}

              {/* ── REJECTED: show re-verify option ── */}
              {guardian.verificationStatus === 'REJECTED' && (
                <PermissionGate permission="admin:verification:write">
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded mb-3">
                    <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">Identity was <strong>rejected</strong>. You can re-verify if new documents have been submitted.</p>
                  </div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleVerify}
                    className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Override — mark as verified
                  </button>
                </PermissionGate>
              )}

              {/* ── SUSPENDED: show re-activate ── */}
              {guardian.status === 'SUSPENDED' && (
                <PermissionGate permission="admin:guardians:activate">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleActivate}
                    className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Re-activate guardian
                  </button>
                </PermissionGate>
              )}

            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Quick stats</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-slate-50 rounded">
                <p className="font-mono text-xl font-bold text-slate-900 leading-none">{guardian.certifications.length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Certifications</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded">
                <p className="font-mono text-xl font-bold text-slate-900 leading-none">{rating > 0 ? rating.toFixed(1) : '—'}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Rating</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Certifications (full width) ── */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Certifications</h2>
              {guardian.certifications.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded">
                  {guardian.certifications.length}
                </span>
              )}
            </div>
            <PermissionGate permission="admin:guardians:write">
              <button
                type="button"
                onClick={() => { setShowCertForm((v) => !v); setCertError(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add certification
              </button>
            </PermissionGate>
          </div>

          {/* Inline cert form */}
          {showCertForm && (
            <form onSubmit={handleAddCert} className="mx-5 mt-4 p-4 bg-slate-50 rounded border border-slate-200 space-y-3 mb-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">New certification</p>
              {certError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{certError}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Type</label>
                  <select
                    required
                    value={certForm.certificationType}
                    onChange={(e) => setCertForm((f) => ({ ...f, certificationType: e.target.value as AddCertificationPayload['certificationType'] }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  >
                    {CERT_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Issuing authority</label>
                  <input required type="text" value={certForm.issuer} onChange={(e) => setCertForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="e.g. Rwanda Red Cross" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Issue date</label>
                  <input required type="date" value={certForm.issueDate} onChange={(e) => setCertForm((f) => ({ ...f, issueDate: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Expiry date <span className="text-slate-400 normal-case font-normal">(optional)</span></label>
                  <input type="date" value={certForm.expiryDate ?? ''} onChange={(e) => setCertForm((f) => ({ ...f, expiryDate: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                </div>
              </div>

              {/* Document upload */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Document <span className="text-slate-400 normal-case font-normal">(optional — PDF / PNG / JPG)</span></label>
                {certFile ? (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded text-xs">
                    <FileUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="flex-1 truncate text-slate-700 font-medium">{certFile.name}</span>
                    <button type="button" onClick={() => setCertFile(null)} className="text-slate-400 hover:text-red-500 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-500 cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors">
                    <FileUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Click to attach certificate file</span>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => { setCertFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => { setShowCertForm(false); setCertError(null); }} className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={certSubmitting} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer">
                  {certSubmitting ? 'Saving…' : 'Save certification'}
                </button>
              </div>
            </form>
          )}

          {/* Cert list */}
          {guardian.certifications.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">No certifications on file.</p>
          ) : (
            <>
              {/* ── Mobile cards ── */}
              <div className="md:hidden divide-y divide-slate-100">
                {guardian.certifications.map((c) => (
                  <div key={c.id} className="px-4 py-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {CERT_TYPE_LABELS[c.certificationType] ?? c.certificationType}
                      </p>
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold shrink-0', certVerifColor(c.verificationStatus))}>
                        {c.verificationStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{c.issuer}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(c.issueDate).toLocaleDateString()}
                      {' → '}
                      {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'No expiry'}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      {c.documentId && (
                        <button type="button" onClick={() => viewDocument(c.documentId!)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors cursor-pointer">
                          <ExternalLink className="w-3.5 h-3.5" /> View file
                        </button>
                      )}
                      {c.verificationStatus === 'PENDING' && (
                        <PermissionGate permission="admin:verification:write">
                          <button
                            type="button"
                            disabled={certBusy === c.id + '-v' || certBusy === c.id + '-r'}
                            onClick={() => void handleVerifyCert(c.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {certBusy === c.id + '-v' ? '…' : 'Verify'}
                          </button>
                          <button
                            type="button"
                            disabled={certBusy === c.id + '-v' || certBusy === c.id + '-r'}
                            onClick={() => void handleRejectCert(c.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            {certBusy === c.id + '-r' ? '…' : 'Reject'}
                          </button>
                        </PermissionGate>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Type', 'Issuer', 'Status', 'Issue date', 'Expires', 'Document', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {guardian.certifications.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">
                          {CERT_TYPE_LABELS[c.certificationType] ?? c.certificationType}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">{c.issuer}</td>
                        <td className="px-5 py-3">
                          <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold', certVerifColor(c.verificationStatus))}>
                            {c.verificationStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-sm text-slate-500">{new Date(c.issueDate).toLocaleDateString()}</td>
                        <td className="px-5 py-3 font-mono text-sm text-slate-500">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'}</td>
                        <td className="px-5 py-3">
                          {c.documentId ? (
                            <button type="button" onClick={() => viewDocument(c.documentId!)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors cursor-pointer">
                              <ExternalLink className="w-3.5 h-3.5" /> View file
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {c.verificationStatus === 'PENDING' ? (
                            <PermissionGate permission="admin:verification:write">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={certBusy === c.id + '-v' || certBusy === c.id + '-r'}
                                  onClick={() => void handleVerifyCert(c.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {certBusy === c.id + '-v' ? '…' : 'Verify'}
                                </button>
                                <button
                                  type="button"
                                  disabled={certBusy === c.id + '-v' || certBusy === c.id + '-r'}
                                  onClick={() => void handleRejectCert(c.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
                                >
                                  <XCircle className="w-3 h-3" />
                                  {certBusy === c.id + '-r' ? '…' : 'Reject'}
                                </button>
                              </div>
                            </PermissionGate>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Earnings & payouts (full width) ── */}
        {id && (
          <div className="mt-4">
            <GuardianEarningsPanel guardianId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
