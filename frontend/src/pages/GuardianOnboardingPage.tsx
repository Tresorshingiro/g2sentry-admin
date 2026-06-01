import {
  Award,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Shield,
  UserCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { cn } from '@/lib/utils';
import {
  activateGuardian,
  fetchGuardianProfile,
  reviewCertification,
  reviewGuardian,
} from '@/services/api';

const CERT_TYPE_LABELS: Record<string, string> = {
  FIRST_AID: 'First Aid',
  CROWD_CONTROL: 'Crowd Control',
  FIREARM: 'Firearm',
  RESERVE_FORCE: 'Reserve Force',
  RNP_SECURITY_LICENSE: 'RNP Security License',
};

interface CertItem {
  id: string;
  certificationType: string;
  verificationStatus: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
}

interface GuardianDetail {
  id: string;
  guardianCode: string;
  status: string;
  verificationStatus: string;
  districtBase: string;
  employmentType: string;
  specializations: string[];
  joinedAt: string;
  user: { fullName: string | null; phoneNumber: string; email: string | null };
  certifications: CertItem[];
  vettingRecord: { rnpReferenceNumber: string | null; reserveForceVerified: boolean; notes: string | null } | null;
}

type Step = 0 | 1 | 2;

function derivedStep(g: GuardianDetail): Step {
  if (g.status === 'ACTIVE') return 2;
  if (g.verificationStatus !== 'VERIFIED') return 0;
  if (g.certifications.some((c) => c.verificationStatus === 'PENDING')) return 1;
  return 2;
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

function initials(name: string | null, phone: string) {
  if (!name) return phone.slice(-2).toUpperCase();
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const STEP_LABELS = ['Verify identity', 'Certifications', 'Activate'];

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="w-40 text-xs text-slate-400 shrink-0 pt-0.5">{label}</span>
      <span className={cn('text-sm font-medium', highlight ? 'text-green-600' : 'text-slate-900')}>{value || '—'}</span>
    </div>
  );
}

function Flash({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null;
  return (
    <div className={cn(
      'mx-5 mt-4 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2',
      msg.ok
        ? 'bg-green-50 border border-green-200 text-green-700'
        : 'bg-red-50 border border-red-200 text-red-700',
    )}>
      {msg.ok
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <XCircle className="w-4 h-4 shrink-0" />}
      {msg.text}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GuardianOnboardingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep]         = useState<Step>(0);

  const [busy, setBusy]         = useState<string | null>(null);
  const [flash, setFlash]       = useState<{ text: string; ok: boolean } | null>(null);

  const [showRejectIdentity, setShowRejectIdentity] = useState(false);
  const [rejectReason,       setRejectReason]       = useState('');

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    setTimeout(() => setFlash(null), 5000);
  }

  async function loadGuardian() {
    if (!id) return;
    const data = await fetchGuardianProfile(id);
    const g = data as GuardianDetail;
    setGuardian(g);
    setStep(derivedStep(g));
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadGuardian()
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(key: string, fn: () => Promise<unknown>, onOk: string) {
    setBusy(key);
    try {
      await fn();
      await loadGuardian();
      showFlash(onOk, true);
    } catch (err) {
      showFlash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setBusy(null);
    }
  }

  function handleVerifyIdentity() {
    void run('id-verify', () => reviewGuardian(id!, 'VERIFIED'), 'Identity verified. Proceed to certifications.');
    setShowRejectIdentity(false);
    setRejectReason('');
  }

  function handleRejectIdentity() {
    if (!rejectReason.trim()) return;
    void run('id-reject', () => reviewGuardian(id!, 'REJECTED', rejectReason.trim()), 'Guardian identity rejected.');
    setShowRejectIdentity(false);
    setRejectReason('');
  }

  function handleVerifyCert(certId: string) {
    void run(`cv-${certId}`, () => reviewCertification(certId, 'VERIFIED'), 'Certification verified.');
  }

  function handleRejectCert(certId: string) {
    void run(`cr-${certId}`, () => reviewCertification(certId, 'REJECTED'), 'Certification rejected.');
  }

  function handleActivate() {
    void run('activate', () => activateGuardian(id!), 'Guardian activated! An OTP has been sent to their phone.');
    setTimeout(() => navigate(`/guardians/${id}`), 2200);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!guardian)  return <div className="p-6 text-slate-500">Guardian not found.</div>;

  const name         = guardian.user.fullName ?? guardian.user.phoneNumber;
  const isActivated  = guardian.status === 'ACTIVE';
  const isVerified   = guardian.verificationStatus === 'VERIFIED';
  const pendingCerts = guardian.certifications.filter((c) => c.verificationStatus === 'PENDING');

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50">

      {/* ── Dark banner ── */}
      <div className="relative bg-[#0D1117] px-6 pt-7 pb-5 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10">
          {/* Guardian identity + skip link */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-green-700 flex items-center justify-center text-white text-sm font-bold ring-4 ring-green-500/20 shrink-0 select-none">
                {initials(guardian.user.fullName, guardian.user.phoneNumber)}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-green-500 uppercase tracking-widest mb-0.5">Guardian onboarding</p>
                <h1 className="text-white text-base font-bold tracking-tight leading-tight">{name}</h1>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{guardian.guardianCode}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{guardian.districtBase}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/guardians/${id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0 mt-0.5"
            >
              Skip to profile <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center">
            {STEP_LABELS.map((label, i) => {
              const done    = isActivated ? true : i < step;
              const active  = !isActivated && i === step;
              const pending = !isActivated && i > step;
              return (
                <div key={label} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { if (!isActivated) setStep(i as Step); }}
                    disabled={pending && !done}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                      done    ? 'text-green-400' :
                      active  ? 'text-white' :
                                'text-slate-500 cursor-default',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                      done    ? 'bg-green-500 text-white' :
                      active  ? 'bg-white text-slate-900' :
                                'bg-slate-700 text-slate-400',
                    )}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                    </div>
                    {label}
                  </button>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={cn('w-6 h-px mx-1', i < step || isActivated ? 'bg-green-600' : 'bg-slate-700')} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Flash msg={flash} />

      {/* ── Step content ── */}
      <div className="p-5 space-y-4">

        {/* ── STEP 0: Verify Identity ── */}
        {step === 0 && !isActivated && (
          <div className="grid grid-cols-3 gap-4 items-start">

            {/* Guardian details — left 2/3 */}
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <h2 className="text-sm font-semibold text-slate-900">Registered details — review before verifying</h2>
              </div>
              <div className="px-5 py-1">
                <InfoRow label="Full name"       value={guardian.user.fullName ?? '—'} />
                <InfoRow label="Phone number"    value={fmtPhone(guardian.user.phoneNumber)} />
                <InfoRow label="Email"           value={guardian.user.email ?? '—'} />
                <InfoRow label="District base"   value={guardian.districtBase} />
                <InfoRow label="Employment type" value={employmentLabel(guardian.employmentType)} />
                {guardian.vettingRecord?.rnpReferenceNumber && (
                  <InfoRow label="RNP reference" value={guardian.vettingRecord.rnpReferenceNumber} />
                )}
                {guardian.vettingRecord && (
                  <InfoRow label="Reserve force" value={guardian.vettingRecord.reserveForceVerified ? 'Verified' : 'Not verified'} />
                )}
                {guardian.specializations.length > 0 && (
                  <div className="flex items-start gap-3 py-2.5">
                    <span className="w-40 text-xs text-slate-400 shrink-0 pt-1">Specializations</span>
                    <div className="flex flex-wrap gap-1.5">
                      {guardian.specializations.map((s) => (
                        <span key={s} className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 rounded-md">
                          {s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action panel — right 1/3 */}
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900">Identity verification</h2>
                </div>
                <div className="p-4 space-y-2.5">

                  {guardian.verificationStatus === 'PENDING' && (
                    <>
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          Review the registered details, then verify or reject this guardian's identity.
                        </p>
                      </div>

                      <PermissionGate permission="admin:verification:write">
                        <button
                          type="button"
                          disabled={busy === 'id-verify'}
                          onClick={handleVerifyIdentity}
                          className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {busy === 'id-verify' ? 'Verifying…' : 'Verify identity'}
                        </button>

                        {!showRejectIdentity ? (
                          <button
                            type="button"
                            onClick={() => setShowRejectIdentity(true)}
                            className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <textarea
                              // eslint-disable-next-line jsx-a11y/no-autofocus
                              autoFocus
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejection…"
                              rows={3}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => { setShowRejectIdentity(false); setRejectReason(''); }}
                                className="flex-1 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!rejectReason.trim() || busy === 'id-reject'}
                                onClick={handleRejectIdentity}
                                className="flex-1 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        )}
                      </PermissionGate>
                    </>
                  )}

                  {guardian.verificationStatus === 'VERIFIED' && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-xs font-semibold text-green-700">Identity verified</p>
                    </div>
                  )}

                  {guardian.verificationStatus === 'REJECTED' && (
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-red-700">Identity rejected. Override if new documents have been submitted.</p>
                      </div>
                      <PermissionGate permission="admin:verification:write">
                        <button
                          type="button"
                          disabled={busy === 'id-verify'}
                          onClick={handleVerifyIdentity}
                          className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Override — mark as verified
                        </button>
                      </PermissionGate>
                    </div>
                  )}
                </div>
              </div>

              {isVerified && (
                <button
                  type="button"
                  onClick={() => setStep(guardian.certifications.length > 0 ? 1 : 2)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 1: Certifications ── */}
        {step === 1 && !isActivated && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900">Review certifications</h2>
                  {pendingCerts.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-md">
                      {pendingCerts.length} pending
                    </span>
                  )}
                </div>
                {pendingCerts.length === 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All reviewed
                  </div>
                )}
              </div>

              {guardian.certifications.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No certifications on file.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Type', 'Issuer', 'Issue date', 'Expires', 'Status', 'Action'].map((h) => (
                          <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {guardian.certifications.map((cert) => {
                        const isVerifying = busy === `cv-${cert.id}`;
                        const isRejecting = busy === `cr-${cert.id}`;
                        return (
                          <tr key={cert.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3 text-sm font-medium text-slate-900">
                              {CERT_TYPE_LABELS[cert.certificationType] ?? cert.certificationType}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-600">{cert.issuer}</td>
                            <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                              {new Date(cert.issueDate).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                              {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3">
                              <span className={cn(
                                'inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold',
                                cert.verificationStatus === 'VERIFIED' ? 'text-green-600 bg-green-50 ring-1 ring-green-200'
                                  : cert.verificationStatus === 'REJECTED' ? 'text-red-600 bg-red-50 ring-1 ring-red-200'
                                  : 'text-amber-600 bg-amber-50 ring-1 ring-amber-200',
                              )}>
                                {cert.verificationStatus}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {cert.verificationStatus === 'PENDING' ? (
                                <PermissionGate permission="admin:verification:write">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={isVerifying || isRejecting}
                                      onClick={() => handleVerifyCert(cert.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      {isVerifying ? '…' : 'Verify'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isVerifying || isRejecting}
                                      onClick={() => handleRejectCert(cert.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      {isRejecting ? '…' : 'Reject'}
                                    </button>
                                  </div>
                                </PermissionGate>
                              ) : cert.verificationStatus === 'VERIFIED' ? (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-red-500">
                                  <XCircle className="w-3.5 h-3.5" /> Rejected
                                </span>
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

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Continue to activate <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Activate ── */}
        {step === 2 && (
          <div className="grid grid-cols-3 gap-4 items-start">

            {/* Summary — left 2/3 */}
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <h2 className="text-sm font-semibold text-slate-900">Registration summary</h2>
              </div>
              <div className="px-5 py-1">
                <InfoRow label="Full name"            value={guardian.user.fullName ?? '—'} />
                <InfoRow label="Phone number"         value={fmtPhone(guardian.user.phoneNumber)} />
                <InfoRow label="Email"                value={guardian.user.email ?? '—'} />
                <InfoRow label="District base"        value={guardian.districtBase} />
                <InfoRow label="Employment type"      value={employmentLabel(guardian.employmentType)} />
                <InfoRow
                  label="Identity verification"
                  value={guardian.verificationStatus}
                  highlight={guardian.verificationStatus === 'VERIFIED'}
                />
                <InfoRow
                  label="Certifications"
                  value={
                    guardian.certifications.length === 0
                      ? 'None registered'
                      : `${guardian.certifications.length} on file · ${guardian.certifications.filter((c) => c.verificationStatus === 'VERIFIED').length} verified`
                  }
                />
              </div>
            </div>

            {/* Activate panel — right 1/3 */}
            <div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <Zap className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900">Activate guardian</h2>
                </div>
                <div className="p-4 space-y-3">
                  {isActivated ? (
                    <>
                      <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-green-700 font-semibold">Guardian is active</p>
                          <p className="text-xs text-green-600 mt-0.5">They can now receive and accept jobs.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/guardians/${id}`)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        View profile <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  ) : !isVerified ? (
                    <>
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-amber-700">Identity must be verified before activation.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(0)}
                        className="flex items-center justify-center w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        ← Go back to verify identity
                      </button>
                    </>
                  ) : (
                    <PermissionGate permission="admin:guardians:activate">
                      <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-green-700 leading-relaxed">
                          Identity verified. Activating will send an OTP to the guardian's phone to set up their account.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy === 'activate'}
                        onClick={handleActivate}
                        className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Zap className="w-4 h-4" />
                        {busy === 'activate' ? 'Activating…' : 'Activate guardian'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center justify-center w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        ← Back to certifications
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
