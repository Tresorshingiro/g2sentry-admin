import {
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Hash,
  Mail,
  MapPin,
  Phone,
  Shield,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { fetchAdminOrgById, fetchOrgLocations, fetchOrgMembers, reviewOrganization } from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgMember {
  userId: string;
  role: string;
  user: { fullName: string | null; phoneNumber: string; email: string | null };
}

interface Location {
  id: string;
  name: string;
  district: string | null;
  sector: string | null;
  cell: string | null;
  address: string | null;
  isPrimary: boolean;
  status?: string;
}

interface VerificationDoc {
  id: string;
  documentId: string;
  documentType: string;
  createdAt: string;
  document: {
    id: string;
    mimeType: string;
    sizeBytes: string;
    createdAt: string;
  };
}

interface ClientDetail {
  id: string;
  legalName: string;
  tradingName: string | null;
  tinNumber: string | null;
  orgType: string | null;
  verificationStatus: string;
  status?: string;
  mobileMoneyProvider?: string | null;
  mobileMoneyPhone?: string | null;
  createdAt: string;
  primaryDistrict?: string | null;
  locations?: Location[];
  members?: OrgMember[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  verificationDocuments?: VerificationDoc[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const ORG_TYPE_LABELS: Record<string, string> = {
  BAR: 'Bar', HOTEL: 'Hotel', EVENT_COMPANY: 'Event Company',
  NGO: 'NGO', SCHOOL: 'School', RESTAURANT: 'Restaurant',
  INDIVIDUAL: 'Individual', COMPOUND: 'Compound',
  LOGISTICS: 'Logistics', OTHER: 'Other',
};

const MEMBER_ROLE_LABELS: Record<string, string> = {
  CLIENT_OWNER: 'Owner', CLIENT_STAFF: 'Staff',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  TIN_CERTIFICATE:       'TIN Certificate',
  BUSINESS_REGISTRATION: 'Business Registration',
  NATIONAL_ID:           'National ID',
  OTHER:                 'Other Document',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtPhone(p: string) {
  if (p.startsWith('+250') && p.length === 13)
    return `+250 ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
  return p;
}

// ── Workflow step ─────────────────────────────────────────────────────────────

function WorkflowStep({
  label, state, isLast,
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

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="w-36 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 pt-1">{label}</span>
      <span className={cn('text-sm text-slate-900 font-medium', mono && 'font-mono')}>{value || '—'}</span>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, children, action,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [client,        setClient]        = useState<ClientDetail | null>(null);
  const [locations,     setLocations]     = useState<Location[]>([]);
  const [members,       setMembers]       = useState<OrgMember[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg,     setActionMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [showReject,    setShowReject]    = useState(false);
  const [rejectReason,  setRejectReason]  = useState('');

  async function reload() {
    if (!id) return;
    const [data, locs, mems] = await Promise.all([
      fetchAdminOrgById(id),
      fetchOrgLocations(id).catch(() => [] as unknown[]),
      fetchOrgMembers(id).catch(() => [] as unknown[]),
    ]);
    setClient(data as ClientDetail);
    setLocations(locs as Location[]);
    setMembers(mems as OrgMember[]);
  }

  useEffect(() => {
    if (!id) return;
    const clientId = id;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [c, locs, mems] = await Promise.all([
          fetchAdminOrgById(clientId),
          fetchOrgLocations(clientId).catch(() => [] as unknown[]),
          fetchOrgMembers(clientId).catch(() => [] as unknown[]),
        ]);
        setClient(c as ClientDetail);
        setLocations(locs as Location[]);
        setMembers(mems as OrgMember[]);
      } catch (err: unknown) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load client');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function viewDocument(documentId: string) {
    const token = localStorage.getItem('g2sentry_token');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/admin/verification/documents/${documentId}/content`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) { flash('Could not load document.', false); return; }
      const bytes = await res.arrayBuffer();
      const magic = new Uint8Array(bytes.slice(0, 5));
      let mimeType: string;
      if (magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46) {
        mimeType = 'application/pdf';
      } else if (magic[0] === 0xFF && magic[1] === 0xD8) {
        mimeType = 'image/jpeg';
      } else if (magic[0] === 0x89 && magic[1] === 0x50) {
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

  function flash(text: string, ok: boolean) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function doAction(fn: () => Promise<unknown>, msg: string) {
    if (!id || actionLoading) return;
    setActionLoading(true);
    try {
      await fn();
      await reload();
      flash(msg, true);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerify() {
    await doAction(() => reviewOrganization(id!, 'VERIFIED'), 'Organisation verified successfully.');
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await doAction(() => reviewOrganization(id!, 'REJECTED', rejectReason.trim()), 'Organisation rejected.');
    setShowReject(false);
    setRejectReason('');
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!client)   return <div className="p-6 text-slate-500">Client not found.</div>;


  const verifyState =
    client.verificationStatus === 'VERIFIED' ? 'done'
    : client.verificationStatus === 'REJECTED' ? 'rejected'
    : 'active';

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50" style={{ fontFamily: IBM }}>

      {/* ── Dark banner ── */}
      <div className="relative bg-[#0D1117] px-6 pt-8 pb-6 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="relative z-10 flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded bg-green-700 flex items-center justify-center text-white text-xl font-bold ring-4 ring-green-500/20 shrink-0 select-none">
            {toInitials(client.legalName)}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-white text-lg font-bold tracking-tight">{client.legalName}</h1>

              {client.verificationStatus === 'VERIFIED' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">Verified</span>
              )}
              {client.verificationStatus === 'REJECTED' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Rejected</span>
              )}
              {client.verificationStatus === 'PENDING' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending review</span>
              )}
              {client.status === 'SUSPENDED' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">Suspended</span>
              )}
              {client.orgType && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 text-slate-400 border border-white/10">
                  {ORG_TYPE_LABELS[client.orgType] ?? client.orgType}
                </span>
              )}
            </div>

            {client.tradingName && (
              <p className="text-slate-400 text-sm mb-1">{client.tradingName}</p>
            )}

            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              {client.tinNumber && (
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3" />
                  <code className="font-mono">{client.tinNumber}</code>
                </span>
              )}
              {client.tinNumber && (client.primaryDistrict || members.length > 0) && (
                <span className="w-1 h-1 rounded-full bg-slate-600" />
              )}
              {client.primaryDistrict && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> {client.primaryDistrict}
                </span>
              )}
              {client.primaryDistrict && members.length > 0 && (
                <span className="w-1 h-1 rounded-full bg-slate-600" />
              )}
              {members.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  <span className="font-mono">{members.length}</span> {members.length === 1 ? 'member' : 'members'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0 mt-4 flex-wrap gap-y-2">
              <WorkflowStep label="Registered"   state="done" />
              <WorkflowStep label="Verification" state={verifyState} isLast />
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
          {actionMsg.ok
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <XCircle className="w-4 h-4 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* ── Content ── */}
      <div className="p-5 flex flex-col lg:flex-row gap-5 items-start">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 space-y-4 w-full">

          {/* Organisation details */}
          <Section icon={Building2} title="Organisation details">
            <InfoRow label="Legal name"      value={client.legalName} />
            {client.tradingName     && <InfoRow label="Trading name"     value={client.tradingName} />}
            {client.tinNumber       && <InfoRow label="TIN number"       value={client.tinNumber} mono />}
            {client.orgType         && <InfoRow label="Category"         value={ORG_TYPE_LABELS[client.orgType] ?? client.orgType} />}
            {client.primaryDistrict && <InfoRow label="Primary district" value={client.primaryDistrict} />}
            <InfoRow label="Verification" value={
              client.verificationStatus === 'VERIFIED' ? 'Verified'
              : client.verificationStatus === 'REJECTED' ? 'Rejected'
              : 'Pending review'
            } />
            <InfoRow label="Registered" value={fmtDate(client.createdAt)} />
            {client.mobileMoneyProvider && (
              <InfoRow label="Mobile money" value={
                `${client.mobileMoneyProvider.replace(/_/g, ' ')}${client.mobileMoneyPhone ? ` · ${fmtPhone(client.mobileMoneyPhone)}` : ''}`
              } />
            )}
            {client.contactEmail && <InfoRow label="Contact email" value={client.contactEmail} />}
            {client.contactPhone && <InfoRow label="Contact phone" value={fmtPhone(client.contactPhone)} />}
          </Section>

          {/* Locations */}
          <Section icon={MapPin} title={`Locations${locations.length > 0 ? ` (${locations.length})` : ''}`}>
            {locations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MapPin className="w-7 h-7 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">No locations on file</p>
              </div>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded border',
                      loc.isPrimary ? 'bg-green-50/50 border-green-200' : 'bg-slate-50 border-slate-100',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5',
                      loc.isPrimary ? 'bg-green-100' : 'bg-slate-100',
                    )}>
                      <MapPin className={cn('w-4 h-4', loc.isPrimary ? 'text-green-600' : 'text-slate-400')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{loc.name}</p>
                        {loc.isPrimary && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 uppercase tracking-widest rounded">Primary</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[loc.address, loc.cell, loc.sector, loc.district].filter(Boolean).join(', ') || 'No address on file'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Verification Documents */}
          {(() => {
            const docs = client.verificationDocuments ?? [];
            return (
              <Section icon={FileText} title={`Verification documents${docs.length > 0 ? ` (${docs.length})` : ''}`}>
                {docs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="w-7 h-7 text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc) => {
                      const isPdf  = doc.document.mimeType === 'application/pdf';
                      const isImg  = doc.document.mimeType.startsWith('image/');
                      const sizeKb = Math.round(Number(doc.document.sizeBytes) / 1024);
                      return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded bg-slate-50 border border-slate-100">
                          <div className="w-9 h-9 rounded bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 leading-tight">
                              {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                              {isPdf ? 'PDF' : isImg ? 'Image' : doc.document.mimeType.split('/')[1]?.toUpperCase() ?? 'File'}
                              {' · '}{sizeKb} KB{' · '}
                              {new Date(doc.document.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => viewDocument(doc.documentId)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            );
          })()}

          {/* Members */}
          {members.length > 0 && (
            <Section icon={Users} title={`Members (${members.length})`}>
              <div className="space-y-2">
                {members.map((m) => {
                  const ini     = m.user.fullName ? toInitials(m.user.fullName) : m.user.phoneNumber.slice(-2).toUpperCase();
                  const isOwner = m.role === 'CLIENT_OWNER';
                  const roleLbl = MEMBER_ROLE_LABELS[m.role] ?? m.role;

                  return (
                    <div key={m.userId} className="flex items-center gap-3 p-2.5 rounded bg-slate-50 border border-slate-100">
                      <div className={cn(
                        'w-9 h-9 rounded flex items-center justify-center text-[11px] font-bold text-white shrink-0',
                        isOwner ? 'bg-green-700' : 'bg-slate-500',
                      )}>
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {m.user.fullName ?? fmtPhone(m.user.phoneNumber)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {m.user.fullName ? fmtPhone(m.user.phoneNumber) : m.user.email ?? ''}
                        </p>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded shrink-0',
                        isOwner ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600',
                      )}>
                        {roleLbl}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">

          {/* Actions */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Actions</h3>
            </div>
            <div className="p-3 space-y-2">
              {client.verificationStatus === 'VERIFIED' && (
                <div className="px-3 py-2 rounded bg-green-50 border border-green-100 text-xs text-green-700">
                  <span className="font-semibold">Organisation is verified</span> and active on the platform.
                </div>
              )}
              {client.verificationStatus === 'REJECTED' && (
                <div className="px-3 py-2 rounded bg-red-50 border border-red-100 text-xs text-red-700">
                  <span className="font-semibold">Verification was rejected.</span> Review and re-verify if needed.
                </div>
              )}
              {client.verificationStatus === 'PENDING' && (
                <>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleVerify}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verify organisation
                  </button>

                  {!showReject ? (
                    <button
                      type="button"
                      onClick={() => setShowReject(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection…"
                        rows={3}
                        className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={!rejectReason.trim() || actionLoading}
                          onClick={handleReject}
                          className="flex-1 px-2 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                        >
                          Confirm reject
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowReject(false); setRejectReason(''); }}
                          className="px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Quick stats</h3>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <div className="px-4 py-4 text-center">
                <p className="font-mono text-2xl font-bold text-slate-900 leading-none">{locations.length}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Locations</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="font-mono text-2xl font-bold text-slate-900 leading-none">{members.length || '—'}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Members</p>
              </div>
            </div>
          </div>

          {/* Contact info */}
          {(client.contactEmail || client.contactPhone) && (
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Contact</h3>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                {client.contactEmail && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{client.contactEmail}</span>
                  </div>
                )}
                {client.contactPhone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{fmtPhone(client.contactPhone)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
