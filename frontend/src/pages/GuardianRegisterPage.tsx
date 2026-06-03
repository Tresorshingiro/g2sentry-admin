import {
  Award,
  Briefcase,
  Check,
  FileUp,
  MapPin,
  Plus,
  Save,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addCertification, createGuardian, uploadDocument, type AddCertificationPayload } from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

const CERT_TYPES: { value: AddCertificationPayload['certificationType']; label: string }[] = [
  { value: 'FIRST_AID', label: 'First Aid' },
  { value: 'CROWD_CONTROL', label: 'Crowd Control' },
  { value: 'FIREARM', label: 'Firearm' },
  { value: 'RESERVE_FORCE', label: 'Reserve Force' },
  { value: 'RNP_SECURITY_LICENSE', label: 'RNP Security License' },
];

const SPECIALIZATIONS = [
  { value: 'PATROL', label: 'Patrol' },
  { value: 'ESCORT', label: 'Escort' },
  { value: 'EVENT_SECURITY', label: 'Event Security' },
  { value: 'DOOR_SUPERVISION', label: 'Door Supervision' },
  { value: 'VIP_PROTECTION', label: 'VIP Protection' },
  { value: 'EMERGENCY_RESPONSE', label: 'Emergency Response' },
  { value: 'COMPOUND_SECURITY', label: 'Compound Security' },
  { value: 'STATIC_POST', label: 'Static Post' },
] as const;

interface CertRow {
  cert: AddCertificationPayload;
  file: File | null;
}

const EMPTY_CERT_ROW: CertRow = {
  cert: { certificationType: 'FIRST_AID', issuer: '', issueDate: '', expiryDate: '' },
  file: null,
};

// ── Shared sub-components ────────────────────────────────────────────────────

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
  required,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
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

// ── Certification card ────────────────────────────────────────────────────────

function CertCard({
  index,
  row,
  onUpdate,
  onFileChange,
  onRemove,
}: {
  index: number;
  row: CertRow;
  onUpdate: (patch: Partial<AddCertificationPayload>) => void;
  onFileChange: (f: File | null) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function fmt(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          Certification {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>Type</FieldLabel>
          <SelectField
            value={row.cert.certificationType}
            onChange={(v) => onUpdate({ certificationType: v as AddCertificationPayload['certificationType'] })}
            required
          >
            {CERT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectField>
        </div>
        <div>
          <FieldLabel>Issuing authority</FieldLabel>
          <Input
            required
            value={row.cert.issuer}
            onChange={(e) => onUpdate({ issuer: e.target.value })}
            placeholder="e.g. Rwanda Red Cross"
            className="bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>Issue date</FieldLabel>
          <Input
            required
            type="date"
            value={row.cert.issueDate}
            onChange={(e) => onUpdate({ issueDate: e.target.value })}
            className="bg-white"
          />
        </div>
        <div>
          <FieldLabel optional>Expiry date</FieldLabel>
          <Input
            type="date"
            value={row.cert.expiryDate ?? ''}
            onChange={(e) => onUpdate({ expiryDate: e.target.value })}
            className="bg-white"
          />
        </div>
      </div>

      <div>
        <FieldLabel optional>Certificate document (PDF / PNG / JPG)</FieldLabel>
        {row.file ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded text-xs">
            <FileUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="flex-1 truncate text-slate-700 font-medium">{row.file.name}</span>
            <span className="text-slate-400 shrink-0">{fmt(row.file.size)}</span>
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-500 cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
          >
            <FileUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Click to attach certificate file</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: 'none' }}
          onChange={(e) => {
            onFileChange(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function GuardianRegisterPage() {
  const navigate = useNavigate();

  const [fullName,    setFullName]    = useState('');
  const [nationalId,  setNationalId]  = useState('');
  const [phone,       setPhone]       = useState('');
  const [email,       setEmail]       = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender,      setGender]      = useState('');

  const [districtBase,       setDistrictBase]       = useState('');
  const [sectorBase,         setSectorBase]         = useState('');
  const [coverageDistricts,  setCoverageDistricts]  = useState('');
  const [preferredShift,     setPreferredShift]     = useState('');

  const [employmentType,  setEmploymentType]  = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);

  const [reserveForceNumber, setReserveForceNumber] = useState('');
  const [rnpReferenceNumber, setRnpReferenceNumber] = useState('');
  const [vettingNotes,       setVettingNotes]       = useState('');

  const [certRows,     setCertRows]     = useState<CertRow[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  function addCertRow() {
    setCertRows((prev) => [...prev, { ...EMPTY_CERT_ROW }]);
  }

  function removeCertRow(i: number) {
    setCertRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCertField(i: number, patch: Partial<AddCertificationPayload>) {
    setCertRows((prev) =>
      prev.map((row, idx) => idx === i ? { ...row, cert: { ...row.cert, ...patch } } : row),
    );
  }

  function updateCertFile(i: number, file: File | null) {
    setCertRows((prev) => prev.map((row, idx) => idx === i ? { ...row, file } : row));
  }

  function toggleSpecialization(value: string) {
    setSpecializations((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  const checks = [
    { label: 'Full name',       done: fullName.length > 0 },
    { label: 'National ID',     done: nationalId.length > 0 },
    { label: 'Phone number',    done: phone.length > 0 },
    { label: 'Email',           done: email.length > 0 },
    { label: 'Gender',          done: gender.length > 0 },
    { label: 'District base',   done: districtBase.length > 0 },
    { label: 'Employment type', done: employmentType.length > 0 },
    { label: 'Specializations', done: specializations.length > 0 },
  ];
  const doneCount   = checks.filter((c) => c.done).length;
  const progressPct = Math.round((doneCount / checks.length) * 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await createGuardian({
        phone,
        fullName,
        nationalId,
        districtBase,
        email,
        gender: gender as 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY',
        employmentType: employmentType as 'FULL_TIME' | 'PART_TIME' | 'RESERVE',
        specializations,
        ...(sectorBase         && { sectorBase }),
        ...(coverageDistricts  && { coverageDistricts: coverageDistricts.split(',').map((d) => d.trim()).filter(Boolean) }),
        ...(dateOfBirth        && { dateOfBirth }),
        ...(preferredShift     && { preferredShift: preferredShift as 'DAY' | 'NIGHT' | 'BOTH' }),
        ...(yearsExperience    && { yearsExperience: Number(yearsExperience) }),
        ...(reserveForceNumber && { reserveForceNumber }),
        ...(rnpReferenceNumber && { rnpReferenceNumber }),
        ...(vettingNotes       && { vettingNotes }),
      }) as { id: string };

      for (const row of certRows) {
        if (!row.cert.issuer || !row.cert.issueDate) continue;
        const documentId = row.file ? await uploadDocument(row.file) : undefined;
        await addCertification(created.id, {
          certificationType: row.cert.certificationType,
          issuer: row.cert.issuer,
          issueDate: row.cert.issueDate,
          ...(row.cert.expiryDate && { expiryDate: row.cert.expiryDate }),
          ...(documentId          && { documentId }),
        });
      }

      navigate(`/guardians/${created.id}/onboard`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-slate-50" style={{ fontFamily: IBM }}>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="flex gap-5 px-4 sm:px-5 pb-5 pt-5 items-start">

          {/* Left: form sections */}
          <div className="flex-1 min-w-0 space-y-0">
            {submitError && (
              <div className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Identity */}
            <FormSection icon={<User className="w-3.5 h-3.5 text-green-600" />} iconBg="bg-green-100" title="Identity">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <FieldLabel>Full name</FieldLabel>
                  <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean-Marie Uwimana" className="bg-slate-50" />
                </div>
                <div>
                  <FieldLabel>National ID (Indangamuntu)</FieldLabel>
                  <Input required value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="1 19XX X XXXXXXX X XX" className="bg-slate-50" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <FieldLabel>Phone number</FieldLabel>
                  <Input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250788123456" className="bg-slate-50" />
                  <p className="text-[10px] text-slate-400 mt-1">E.164 format — include country code</p>
                </div>
                <div>
                  <FieldLabel>Email address</FieldLabel>
                  <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="bg-slate-50" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel optional>Date of birth</FieldLabel>
                  <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="bg-slate-50" />
                </div>
                <div>
                  <FieldLabel>Gender</FieldLabel>
                  <SelectField value={gender} onChange={setGender} required>
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
            <FormSection icon={<MapPin className="w-3.5 h-3.5 text-blue-500" />} iconBg="bg-blue-100" title="Deployment">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <FieldLabel>District base</FieldLabel>
                  <Input required value={districtBase} onChange={(e) => setDistrictBase(e.target.value)} placeholder="Nyarugenge" className="bg-slate-50" />
                </div>
                <div>
                  <FieldLabel>Sector base</FieldLabel>
                  <Input value={sectorBase} onChange={(e) => setSectorBase(e.target.value)} placeholder="Kimisagara" className="bg-slate-50" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Coverage districts</FieldLabel>
                  <Input value={coverageDistricts} onChange={(e) => setCoverageDistricts(e.target.value)} placeholder="Gasabo, Kicukiro" className="bg-slate-50" />
                  <p className="text-[10px] text-slate-400 mt-1">Comma-separated</p>
                </div>
                <div>
                  <FieldLabel>Preferred shift</FieldLabel>
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
            <FormSection icon={<Briefcase className="w-3.5 h-3.5 text-purple-500" />} iconBg="bg-purple-100" title="Professional">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <FieldLabel>Employment type</FieldLabel>
                  <SelectField value={employmentType} onChange={setEmploymentType} required>
                    <option value="">— Select type —</option>
                    <option value="FULL_TIME">Full-time</option>
                    <option value="PART_TIME">Part-time</option>
                    <option value="RESERVE">Reserve</option>
                  </SelectField>
                </div>
                <div>
                  <FieldLabel optional>Years of experience</FieldLabel>
                  <Input type="number" min="0" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="0" className="bg-slate-50" />
                </div>
              </div>
              <div>
                <FieldLabel>Specializations</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {SPECIALIZATIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-slate-200 bg-slate-50 cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                    >
                      <div className={cn(
                        'w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors',
                        specializations.includes(value) ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-white',
                      )}>
                        {specializations.includes(value) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
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

            {/* Vetting / RNP */}
            <FormSection icon={<Shield className="w-3.5 h-3.5 text-orange-500" />} iconBg="bg-orange-100" title="Vetting / RNP">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <FieldLabel optional>Reserve force number</FieldLabel>
                  <Input value={reserveForceNumber} onChange={(e) => setReserveForceNumber(e.target.value)} placeholder="RF-XXXXX" className="bg-slate-50" />
                </div>
                <div>
                  <FieldLabel optional>RNP reference number</FieldLabel>
                  <Input value={rnpReferenceNumber} onChange={(e) => setRnpReferenceNumber(e.target.value)} placeholder="RNP-XXXXX" className="bg-slate-50" />
                </div>
              </div>
              <div>
                <FieldLabel optional>Vetting notes</FieldLabel>
                <textarea
                  value={vettingNotes}
                  onChange={(e) => setVettingNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes on background check…"
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none transition-colors"
                />
              </div>
            </FormSection>

            {/* Certifications */}
            <FormSection icon={<Award className="w-3.5 h-3.5 text-green-600" />} iconBg="bg-green-100" title="Certifications">
              {certRows.length === 0 ? (
                <p className="text-xs text-slate-400 mb-3">No certifications added yet. Click below to add one.</p>
              ) : (
                <div className="space-y-3 mb-3">
                  {certRows.map((row, i) => (
                    <CertCard
                      key={i}
                      index={i}
                      row={row}
                      onUpdate={(patch) => updateCertField(i, patch)}
                      onFileChange={(f) => updateCertFile(i, f)}
                      onRemove={() => removeCertRow(i)}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addCertRow}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 border border-green-300 bg-green-50 rounded hover:bg-green-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add certification
              </button>
            </FormSection>
          </div>

          {/* ── Right: progress sidebar — hidden on mobile ── */}
          <div className="hidden lg:block w-64 shrink-0 self-start sticky top-4">
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Required fields</h3>
              </div>
              <div className="p-4">
                <div className="space-y-1 mb-4">
                  {checks.map((item) => (
                    <div key={item.label} className="flex items-center gap-2.5 py-1.5">
                      <div className={cn(
                        'w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors',
                        item.done ? 'bg-green-500' : 'bg-slate-100 border border-slate-200',
                      )}>
                        {item.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <span className={cn('text-xs', item.done ? 'text-slate-800 font-medium' : 'text-slate-400')}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="font-mono text-[10px] text-slate-400 mt-1.5 text-center">
                  {doneCount} / {checks.length} required fields
                </p>

                {doneCount === checks.length && (
                  <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-center">
                    <p className="text-[9px] font-bold text-green-700 uppercase tracking-widest">Ready to register</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Action buttons — always visible at bottom ── */}
      <div className="shrink-0 px-5 pb-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-4 bg-white">
        <button
          type="button"
          onClick={() => navigate('/guardians')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> {submitting ? 'Saving…' : 'Save registration'}
        </button>
      </div>
    </form>
  );
}
