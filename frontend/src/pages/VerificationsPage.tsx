import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  Mail,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { cn } from '@/lib/utils';
import { fetchAdminOrgById, fetchOrgLocations, fetchOrgMembers, fetchPendingOrgs, reviewOrganization } from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgItem {
  id: string;
  legalName: string;
  orgType: string;
  tinNumber: string | null;
  applicationSubmittedAt: string | null;
  verificationStatus: string;
}

interface VerificationDoc {
  id: string;
  documentId: string;
  documentType: string;
  createdAt: string;
  document: { id: string; mimeType: string; sizeBytes: string; createdAt: string };
}

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
}

interface OrgDetail {
  id: string;
  legalName: string;
  tradingName: string | null;
  tinNumber: string | null;
  orgType: string | null;
  verificationStatus: string;
  createdAt: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  verificationDocuments?: VerificationDoc[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_TYPE_LABELS: Record<string, string> = {
  BAR: 'Bar', HOTEL: 'Hotel', EVENT_COMPANY: 'Event Company',
  NGO: 'NGO', SCHOOL: 'School', RESTAURANT: 'Restaurant',
  INDIVIDUAL: 'Individual', COMPOUND: 'Compound',
  LOGISTICS: 'Logistics', PRIVATE: 'Private', OTHER: 'Other',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  TIN_CERTIFICATE: 'TIN Certificate',
  BUSINESS_REGISTRATION: 'Business Registration',
  NATIONAL_ID: 'National ID',
  OTHER: 'Other Document',
};

const MEMBER_ROLE_LABELS: Record<string, string> = {
  CLIENT_OWNER: 'Owner', CLIENT_STAFF: 'Staff',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtPhone(p: string) {
  if (p.startsWith('+250') && p.length === 13)
    return `+250 ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
  return p;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function openDocument(documentId: string): Promise<string | null> {
  const token = localStorage.getItem('g2sentry_token');
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/verification/documents/${documentId}/content`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) return null;
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
    if (mimeType.includes('application/json')) return null;
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

// ── Review drawer ─────────────────────────────────────────────────────────────

function ReviewDrawer({
  orgId,
  onClose,
  onApproved,
  onRejected,
}: {
  orgId: string;
  onClose: () => void;
  onApproved: (id: string) => void;
  onRejected: (id: string) => void;
}) {
  const [detail,    setDetail]    = useState<OrgDetail | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members,   setMembers]   = useState<OrgMember[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [docError,  setDocError]  = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg,     setActionMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [showReject,    setShowReject]    = useState(false);
  const [rejectReason,  setRejectReason]  = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAdminOrgById(orgId),
      fetchOrgLocations(orgId).catch(() => [] as unknown[]),
      fetchOrgMembers(orgId).catch(() => [] as unknown[]),
    ]).then(([d, locs, mems]) => {
      setDetail(d as OrgDetail);
      setLocations(locs as Location[]);
      setMembers(mems as OrgMember[]);
    }).finally(() => setLoading(false));
  }, [orgId]);

  function flash(text: string, ok: boolean) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function handleApprove() {
    setActionLoading(true);
    try {
      await reviewOrganization(orgId, 'VERIFIED');
      onApproved(orgId);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await reviewOrganization(orgId, 'REJECTED', rejectReason.trim());
      onRejected(orgId);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleViewDoc(documentId: string) {
    setDocError(null);
    try {
      const url = await openDocument(documentId);
      if (!url) { setDocError('Document preview not available.'); return; }
      const a = Object.assign(document.createElement('a'), {
        href: url, target: '_blank', rel: 'noopener noreferrer',
      });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setDocError('Could not load document.');
    }
  }

  const docs = detail?.verificationDocuments ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
        style={{ fontFamily: IBM }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded bg-green-700 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              {detail ? toInitials(detail.legalName) : '…'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {detail?.legalName ?? 'Loading…'}
              </p>
              {detail?.orgType && (
                <p className="text-[10px] text-slate-400">
                  {ORG_TYPE_LABELS[detail.orgType] ?? detail.orgType}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-5 space-y-4">

              {/* Flash */}
              {actionMsg && (
                <div className={cn(
                  'px-3 py-2.5 rounded text-xs flex items-center gap-2',
                  actionMsg.ok
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700',
                )}>
                  {actionMsg.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  {actionMsg.text}
                </div>
              )}

              {/* Organisation details */}
              <div className="bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Organisation details</h3>
                </div>
                <div className="px-4 py-1 divide-y divide-slate-100">
                  {[
                    { label: 'Legal name',  value: detail?.legalName ?? '—' },
                    { label: 'TIN',         value: detail?.tinNumber ?? '—' },
                    { label: 'Category',    value: detail?.orgType ? (ORG_TYPE_LABELS[detail.orgType] ?? detail.orgType) : '—' },
                    { label: 'Registered',  value: detail?.createdAt ? fmtDate(detail.createdAt) : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 py-2.5">
                      <span className="w-28 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 pt-0.5">{label}</span>
                      <span className="text-sm text-slate-800 font-medium">{value}</span>
                    </div>
                  ))}
                  {(detail?.contactEmail || detail?.contactPhone) && (
                    <div className="flex gap-3 py-2.5">
                      <span className="w-28 text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 pt-0.5">Contact</span>
                      <div className="space-y-1">
                        {detail?.contactEmail && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Mail className="w-3 h-3 text-slate-400" /> {detail.contactEmail}
                          </div>
                        )}
                        {detail?.contactPhone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" /> {fmtPhone(detail.contactPhone)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification documents */}
              <div className="bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Verification documents
                    {docs.length > 0 && (
                      <span className="ml-1.5 font-mono text-slate-400">({docs.length})</span>
                    )}
                  </h3>
                </div>
                <div className="p-4">
                  {docError && (
                    <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{docError}</p>
                  )}
                  {docs.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
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
                          <div key={doc.id} className="flex items-center gap-3 p-3 bg-white rounded border border-slate-100">
                            <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 leading-tight">
                                {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                                {isPdf ? 'PDF' : isImg ? 'Image' : doc.document.mimeType.split('/')[1]?.toUpperCase() ?? 'File'}
                                {' · '}{sizeKb} KB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleViewDoc(doc.documentId)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" /> View
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Locations */}
              {locations.length > 0 && (
                <div className="bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      Locations <span className="font-mono text-slate-400">({locations.length})</span>
                    </h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {locations.map((loc) => (
                      <div
                        key={loc.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded border',
                          loc.isPrimary ? 'bg-green-50/50 border-green-200' : 'bg-white border-slate-100',
                        )}
                      >
                        <MapPin className={cn('w-4 h-4 mt-0.5 shrink-0', loc.isPrimary ? 'text-green-600' : 'text-slate-400')} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{loc.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {[loc.address, loc.cell, loc.sector, loc.district].filter(Boolean).join(', ') || 'No address'}
                          </p>
                        </div>
                        {loc.isPrimary && (
                          <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 uppercase tracking-widest rounded shrink-0">Primary</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members */}
              {members.length > 0 && (
                <div className="bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      Members <span className="font-mono text-slate-400">({members.length})</span>
                    </h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {members.map((m) => {
                      const ini     = m.user.fullName ? toInitials(m.user.fullName) : m.user.phoneNumber.slice(-2).toUpperCase();
                      const isOwner = m.role === 'CLIENT_OWNER';
                      return (
                        <div key={m.userId} className="flex items-center gap-3 p-2.5 bg-white rounded border border-slate-100">
                          <div className={cn(
                            'w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0',
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
                            'px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded shrink-0',
                            isOwner ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600',
                          )}>
                            {MEMBER_ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky action footer */}
        <PermissionGate permission="admin:verification:write">
          <div className="shrink-0 border-t border-slate-100 px-5 py-4 bg-white space-y-2">
            {!showReject ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionLoading || loading}
                  onClick={() => void handleApprove()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actionLoading || loading}
                  onClick={() => setShowReject(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowReject(false); setRejectReason(''); }}
                    className="flex-1 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!rejectReason.trim() || actionLoading}
                    onClick={() => void handleReject()}
                    className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded transition-colors cursor-pointer"
                  >
                    Confirm rejection
                  </button>
                </div>
              </div>
            )}
          </div>
        </PermissionGate>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function VerificationsPage() {
  const [orgs,        setOrgs]        = useState<OrgItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [flashMsg,    setFlashMsg]    = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPendingOrgs()
      .then((d) => { setOrgs(d as OrgItem[]); setFetchError(null); })
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function removeOrg(id: string) {
    setOrgs((prev) => prev.filter((o) => o.id !== id));
  }

  function handleApproved(id: string) {
    removeOrg(id);
    setReviewingId(null);
    setFlashMsg({ text: 'Organisation approved.', ok: true });
    setTimeout(() => setFlashMsg(null), 4000);
  }

  function handleRejected(id: string) {
    removeOrg(id);
    setReviewingId(null);
    setFlashMsg({ text: 'Organisation rejected.', ok: false });
    setTimeout(() => setFlashMsg(null), 4000);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50" style={{ fontFamily: IBM }}>
      <div className="p-4 sm:p-5 space-y-4">

        {/* Flash */}
        {flashMsg && (
          <div className={cn(
            'px-4 py-2.5 rounded text-sm flex items-center gap-2',
            flashMsg.ok
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700',
          )}>
            {flashMsg.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <XCircle className="w-4 h-4 shrink-0" />}
            {flashMsg.text}
          </div>
        )}

        {fetchError && (
          <div className="px-4 py-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pending organisation verifications</h2>
            {!loading && orgs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
                {orgs.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-8 h-8 rounded bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-1/4" />
                  </div>
                  <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : orgs.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">All caught up</p>
              <p className="text-xs text-slate-400 mt-1">No pending organisation verifications.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Organisation', 'Category', 'TIN', 'Submitted', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {orgs.map((org, i) => (
                      <tr key={org.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0',
                              ['bg-blue-700', 'bg-purple-700', 'bg-green-700', 'bg-orange-600'][i % 4],
                            )}>
                              {toInitials(org.legalName)}
                            </div>
                            <p className="text-sm font-medium text-slate-900">{org.legalName}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {ORG_TYPE_LABELS[org.orgType] ?? org.orgType}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sm text-slate-500">
                          {org.tinNumber ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">
                          {org.applicationSubmittedAt ? fmtDate(org.applicationSubmittedAt) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => setReviewingId(org.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-50">
                {orgs.map((org, i) => (
                  <div key={org.id} className="flex items-center gap-3 px-4 py-4">
                    <div className={cn(
                      'w-9 h-9 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0',
                      ['bg-blue-700', 'bg-purple-700', 'bg-green-700', 'bg-orange-600'][i % 4],
                    )}>
                      {toInitials(org.legalName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{org.legalName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {ORG_TYPE_LABELS[org.orgType] ?? org.orgType}
                        {org.applicationSubmittedAt ? ` · ${fmtDate(org.applicationSubmittedAt)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewingId(org.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded transition-colors cursor-pointer shrink-0"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Review drawer */}
      {reviewingId && (
        <ReviewDrawer
          orgId={reviewingId}
          onClose={() => setReviewingId(null)}
          onApproved={handleApproved}
          onRejected={handleRejected}
        />
      )}
    </div>
  );
}
