import {
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Lock,
  MapPin,
  Plus,
  Save,
  Shield,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  addCertification,
  fetchGuardianProfile,
  reviewCertification,
  updateGuardian,
  uploadDocument,
  type AddCertificationPayload,
  type UpdateGuardianPayload,
} from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Constants ─────────────────────────────────────────────────────────────────
const CERT_TYPE_LABELS: Record<string, string> = {
  FIRST_AID: 'First Aid',
  CROWD_CONTROL: 'Crowd Control',
  FIREARM: 'Firearm',
  RESERVE_FORCE: 'Reserve Force',
  RNP_SECURITY_LICENSE: 'RNP Security License',
};

const CERT_TYPES = Object.entries(CERT_TYPE_LABELS).map(([value, label]) => ({ value, label })) as
  { value: AddCertificationPayload['certificationType']; label: string }[];

const SPECIALIZATIONS = [
  { value: 'PATROL',           label: 'Patrol' },
  { value: 'ESCORT',           label: 'Escort' },
  { value: 'EVENT_SECURITY',   label: 'Event Security' },
  { value: 'DOOR_SUPERVISION', label: 'Door Supervision' },
  { value: 'VIP_PROTECTION',   label: 'VIP Protection' },
  { value: 'EMERGENCY_RESPONSE', label: 'Emergency Response' },
  { value: 'COMPOUND_SECURITY', label: 'Compound Security' },
  { value: 'STATIC_POST',      label: 'Static Post' },
] as const;

// ── Shared sub-components ─────────────────────────────────────────────────────
function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
      {children}
      {optional && <span className="ml-1 text-slate-400 normal-case font-normal tracking-normal">(optional)</span>}
    </p>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-slate-900 transition-colors"
    >
      {children}
    </select>
  );
}

function FormSection({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded border border-slate-200 overflow-hidden mb-3">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className={cn('w-7 h-7 rounded flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
        <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Locked field (sidebar) ────────────────────────────────────────────────────
function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <Lock className="w-3 h-3 text-slate-300 shrink-0" />
        <span className="text-sm text-slate-700 font-medium">{value || '—'}</span>
      </div>
    </div>
  );
}

// ── Guardian detail shape ─────────────────────────────────────────────────────
interface CertificateItem {
  id: string;
  certificationType: string;
  verificationStatus: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  documentId: string | null;
}

interface GuardianDetail {
  id: string;
  guardianCode: string;
  status: string;
  verificationStatus: string;
  districtBase: string;
  sectorBase: string | null;
  coverageDistricts: string[];
  employmentType: string | null;
  yearsExperience: number | null;
  specializations: string[];
  preferredShift: string | null;
  joinedAt: string;
  rating: string;
  certifications: CertificateItem[];
  user: {
    fullName: string | null;
    phoneNumber: string;
    email: string | null;
    dateOfBirth: string | null;
    gender: string | null;
  };
}

function fmtPhone(phone: string) {
  if (phone.startsWith('+250') && phone.length === 13)
    return `+250 ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  return phone;
}

function toInitials(name: string | null, phone: string) {
  if (!name) return phone.slice(-2).toUpperCase();
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function employmentLabel(t: string) {
  if (t === 'FULL_TIME') return 'Full-time';
  if (t === 'PART_TIME') return 'Part-time';
  if (t === 'RESERVE') return 'Reserve';
  return t;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function GuardianEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [original, setOriginal] = useState<GuardianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [certs, setCerts] = useState<CertificateItem[]>([]);
  const [showAddCert, setShowAddCert] = useState(false);
  const [certForm, setCertForm] = useState<AddCertificationPayload>({
    certificationType: 'FIRST_AID', issuer: '', issueDate: '', expiryDate: '',
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certSubmitting, setCertSubmitting] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certMsg, setCertMsg] = useState<string | null>(null);

  const [fullName,          setFullName]          = useState('');
  const [email,             setEmail]             = useState('');
  const [dateOfBirth,       setDateOfBirth]       = useState('');
  const [gender,            setGender]            = useState('');
  const [districtBase,      setDistrictBase]      = useState('');
  const [sectorBase,        setSectorBase]        = useState('');
  const [coverageDistricts, setCoverageDistricts] = useState('');
  const [preferredShift,    setPreferredShift]    = useState('');
  const [employmentType,    setEmploymentType]    = useState('');
  const [yearsExperience,   setYearsExperience]   = useState('');
  const [specializations,   setSpecializations]   = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchGuardianProfile(id)
      .then((g) => {
        const data = g as GuardianDetail;
        setOriginal(data);
        setCerts(data.certifications ?? []);
        setFullName(data.user.fullName ?? '');
        setEmail(data.user.email ?? '');
        setDateOfBirth(data.user.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : '');
        setGender(data.user.gender ?? '');
        setDistrictBase(data.districtBase);
        setSectorBase(data.sectorBase ?? '');
        setCoverageDistricts(data.coverageDistricts.join(', '));
        setPreferredShift(data.preferredShift ?? '');
        setEmploymentType(data.employmentType ?? '');
        setYearsExperience(data.yearsExperience != null ? String(data.yearsExperience) : '');
        setSpecializations(data.specializations);
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Failed to load guardian'))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleSpecialization(value: string) {
    setSpecializations((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  async function handleAddCert(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setCertSubmitting(true);
    setCertError(null);
    try {
      let documentId: string | undefined;
      if (certFile) documentId = await uploadDocument(certFile);
      await addCertification(id, {
        certificationType: certForm.certificationType,
        issuer: certForm.issuer,
        issueDate: certForm.issueDate,
        ...(certForm.expiryDate && { expiryDate: certForm.expiryDate }),
        ...(documentId          && { documentId }),
      });
      const updated = await fetchGuardianProfile(id);
      setCerts((updated as GuardianDetail).certifications ?? []);
      setShowAddCert(false);
      setCertForm({ certificationType: 'FIRST_AID', issuer: '', issueDate: '', expiryDate: '' });
      setCertFile(null);
      setCertMsg('Certification added.');
      setTimeout(() => setCertMsg(null), 3000);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Failed to add certification');
    } finally {
      setCertSubmitting(false);
    }
  }

  async function handleCertStatus(certId: string, status: 'VERIFIED' | 'REJECTED' | 'EXPIRED') {
    try {
      await reviewCertification(certId, status);
      setCerts((prev) => prev.map((c) => c.id === certId ? { ...c, verificationStatus: status } : c));
      setCertMsg(`Certification marked as ${status.toLowerCase()}.`);
      setTimeout(() => setCertMsg(null), 3000);
    } catch (err) {
      setCertMsg(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  async function viewDocument(documentId: string) {
    const token = localStorage.getItem('g2sentry_token');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/verification/documents/${documentId}/content`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const blob = new Blob([await res.arrayBuffer()], { type: res.headers.get('Content-Type') ?? 'application/octet-stream' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), target: '_blank', rel: 'noopener noreferrer' });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch { /* silent */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const dto: UpdateGuardianPayload = {};
      if (fullName)         dto.fullName    = fullName;
      if (email)            dto.email       = email;
      else                  dto.email       = undefined;
      if (dateOfBirth)      dto.dateOfBirth = dateOfBirth;
      if (gender)           dto.gender      = gender as UpdateGuardianPayload['gender'];
      if (districtBase)     dto.districtBase = districtBase;
      if (sectorBase)       dto.sectorBase   = sectorBase;
      if (coverageDistricts) {
        dto.coverageDistricts = coverageDistricts.split(',').map((d) => d.trim()).filter(Boolean);
      }
      if (preferredShift)  dto.preferredShift  = preferredShift  as UpdateGuardianPayload['preferredShift'];
      if (employmentType)  dto.employmentType  = employmentType  as UpdateGuardianPayload['employmentType'];
      if (yearsExperience !== '') dto.yearsExperience = Number(yearsExperience);
      dto.specializations = specializations;

      await updateGuardian(id, dto);
      navigate(`/guardians/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;

  const name = original?.user.fullName ?? original?.user.phoneNumber ?? '';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50" style={{ fontFamily: IBM }}>

      {/* ── Identity banner ── */}
      <div className="relative bg-[#0D1117] px-6 py-5 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded bg-green-700 flex items-center justify-center text-white text-sm font-bold ring-4 ring-green-500/20 shrink-0 select-none">
            {original ? toInitials(original.user.fullName, original.user.phoneNumber) : '..'}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{name || 'Loading…'}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 flex-wrap">
              {original?.guardianCode && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <code className="font-mono">{original.guardianCode}</code>
                </span>
              )}
              {original?.districtBase && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span>{original.districtBase}</span>
                </>
              )}
              {original?.employmentType && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span>{employmentLabel(original.employmentType)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/guardians/${id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-white/10 rounded hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {submitError && (
        <div className="mx-5 mt-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex gap-5 p-5 items-start">

        {/* ── Left: editable sections ── */}
        <div className="flex-1 min-w-0">

          {/* Identity */}
          <FormSection
            icon={<User className="w-3.5 h-3.5 text-green-600" />}
            iconBg="bg-green-100"
            title="Identity"
          >
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <FieldLabel>Full name</FieldLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean-Marie Uwimana"
                  className="bg-slate-50"
                />
              </div>
              <div>
                <FieldLabel optional>Email address</FieldLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="bg-slate-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Date of birth</FieldLabel>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="bg-slate-50"
                />
              </div>
              <div>
                <FieldLabel optional>Gender</FieldLabel>
                <SelectField value={gender} onChange={setGender}>
                  <option value="">— Select gender —</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </SelectField>
              </div>
            </div>
          </FormSection>

          {/* Deployment */}
          <FormSection
            icon={<MapPin className="w-3.5 h-3.5 text-blue-500" />}
            iconBg="bg-blue-100"
            title="Deployment"
          >
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <FieldLabel>District base</FieldLabel>
                <Input
                  value={districtBase}
                  onChange={(e) => setDistrictBase(e.target.value)}
                  placeholder="Nyarugenge"
                  className="bg-slate-50"
                />
              </div>
              <div>
                <FieldLabel optional>Sector base</FieldLabel>
                <Input
                  value={sectorBase}
                  onChange={(e) => setSectorBase(e.target.value)}
                  placeholder="Kimisagara"
                  className="bg-slate-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Coverage districts</FieldLabel>
                <Input
                  value={coverageDistricts}
                  onChange={(e) => setCoverageDistricts(e.target.value)}
                  placeholder="Gasabo, Kicukiro"
                  className="bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">Comma-separated</p>
              </div>
              <div>
                <FieldLabel optional>Preferred shift</FieldLabel>
                <SelectField value={preferredShift} onChange={setPreferredShift}>
                  <option value="">— Select shift —</option>
                  <option value="DAY">Day</option>
                  <option value="NIGHT">Night</option>
                  <option value="BOTH">Both</option>
                </SelectField>
              </div>
            </div>
          </FormSection>

          {/* Professional */}
          <FormSection
            icon={<Briefcase className="w-3.5 h-3.5 text-purple-500" />}
            iconBg="bg-purple-100"
            title="Professional"
          >
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <FieldLabel optional>Employment type</FieldLabel>
                <SelectField value={employmentType} onChange={setEmploymentType}>
                  <option value="">— Select type —</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="RESERVE">Reserve</option>
                </SelectField>
              </div>
              <div>
                <FieldLabel optional>Years of experience</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder="0"
                  className="bg-slate-50"
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>Specializations</FieldLabel>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {SPECIALIZATIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-slate-200 bg-slate-50 cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                  >
                    <div className={cn(
                      'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors',
                      specializations.includes(value) ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-white',
                    )}>
                      {specializations.includes(value) && (
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={specializations.includes(value)}
                      onChange={() => toggleSpecialization(value)}
                    />
                    <span className="text-xs text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          {/* Certifications */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden mb-3">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded flex items-center justify-center bg-green-100 shrink-0">
                  <Award className="w-3.5 h-3.5 text-green-600" />
                </div>
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Certifications</h3>
                {certs.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded">
                    {certs.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setShowAddCert((v) => !v); setCertError(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add certification
              </button>
            </div>

            {certMsg && (
              <div className="mx-4 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                {certMsg}
              </div>
            )}

            {/* Add cert form */}
            {showAddCert && (
              <form onSubmit={handleAddCert} className="mx-4 mt-4 p-4 bg-slate-50 rounded border border-slate-200 space-y-3 mb-2">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">New certification</p>
                {certError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{certError}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Type</FieldLabel>
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
                    <FieldLabel>Issuing authority</FieldLabel>
                    <input required type="text" value={certForm.issuer} onChange={(e) => setCertForm((f) => ({ ...f, issuer: e.target.value }))} placeholder="e.g. Rwanda Red Cross" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                  </div>
                  <div>
                    <FieldLabel>Issue date</FieldLabel>
                    <input required type="date" value={certForm.issueDate} onChange={(e) => setCertForm((f) => ({ ...f, issueDate: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                  </div>
                  <div>
                    <FieldLabel optional>Expiry date</FieldLabel>
                    <input type="date" value={certForm.expiryDate ?? ''} onChange={(e) => setCertForm((f) => ({ ...f, expiryDate: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Document (PDF / PNG / JPG)</FieldLabel>
                  {certFile ? (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded text-xs">
                      <FileUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="flex-1 truncate text-slate-700 font-medium">{certFile.name}</span>
                      <button type="button" onClick={() => setCertFile(null)} className="text-slate-400 hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
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
                  <button type="button" onClick={() => { setShowAddCert(false); setCertError(null); }} className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={certSubmitting} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded cursor-pointer">
                    {certSubmitting ? 'Saving…' : 'Save certification'}
                  </button>
                </div>
              </form>
            )}

            {/* Cert list */}
            {certs.length === 0 && !showAddCert ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">No certifications on file.</p>
            ) : certs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Type', 'Issuer', 'Status', 'Issue date', 'Expires', 'Doc', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {certs.map((c) => {
                      const statusCls =
                        c.verificationStatus === 'VERIFIED' ? 'text-green-600 bg-green-50 ring-1 ring-green-200'
                        : c.verificationStatus === 'REJECTED' || c.verificationStatus === 'EXPIRED' ? 'text-red-600 bg-red-50 ring-1 ring-red-200'
                        : 'text-amber-600 bg-amber-50 ring-1 ring-amber-200';
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            {CERT_TYPE_LABELS[c.certificationType] ?? c.certificationType}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{c.issuer}</td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold', statusCls)}>
                              {c.verificationStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-slate-500">{new Date(c.issueDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-mono text-sm text-slate-500">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3">
                            {c.documentId ? (
                              <button type="button" onClick={() => viewDocument(c.documentId!)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {c.verificationStatus !== 'VERIFIED' && (
                              <button type="button" onClick={() => handleCertStatus(c.id, 'VERIFIED')} title="Mark verified" className="p-1 text-green-500 hover:bg-green-50 rounded transition-colors cursor-pointer">
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {c.verificationStatus !== 'REJECTED' && (
                              <button type="button" onClick={() => handleCertStatus(c.id, 'REJECTED')} title="Mark rejected" className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors cursor-pointer">
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-[11px] text-slate-400">
                Certification details (type, issuer, dates) cannot be edited after creation — delete and re-add if needed.
              </p>
            </div>
          </div>

        </div>

        {/* ── Right: locked info sidebar ── */}
        <div className="w-64 shrink-0">
          <div className="sticky top-4 space-y-3">

            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Read-only</h3>
              </div>
              <div className="px-4 py-1">
                <LockedField
                  label="Phone number"
                  value={original ? fmtPhone(original.user.phoneNumber) : '—'}
                />
                <LockedField
                  label="Guardian code"
                  value={original?.guardianCode ?? '—'}
                />
                <LockedField
                  label="Status"
                  value={original?.status ?? '—'}
                />
                <LockedField
                  label="Verification"
                  value={original?.verificationStatus ?? '—'}
                />
                <LockedField
                  label="Joined"
                  value={original?.joinedAt
                    ? new Date(original.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                />
              </div>
              <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Phone and guardian code are tied to the auth identity and cannot be changed here.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-3.5">
              <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mb-1">Editing profile</p>
              <p className="text-[11px] text-amber-600 leading-relaxed">
                Changes affect identity, deployment, and specializations. Certifications and vetting must be managed from the profile page.
              </p>
            </div>

          </div>
        </div>
      </div>
    </form>
  );
}
