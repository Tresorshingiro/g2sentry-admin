import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  SendHorizontal,
  Shield,
  Users,
  XCircle,
  Zap,
  Siren,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { cn } from '@/lib/utils';
import { cancelJob, completeJob, dispatchJob, fetchAssignmentById, fetchJobIncidents, type FieldIncident } from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Guardian {
  id: string;
  guardianCode: string;
  districtBase: string;
  user: { fullName: string | null; phoneNumber: string };
}

interface Assignment {
  id: string;
  guardianId: string;
  status: string;
  assignmentRound: number;
  offerSentAt: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  noShowReason: string | null;
  guardian: Guardian;
}

interface StatusHistory {
  id: string;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
  reason: string | null;
}

interface Location {
  id: string;
  name: string;
  district: string | null;
  sector: string | null;
  address: string | null;
}

interface JobDetail {
  id: string;
  referenceNumber: string;
  status: string;
  priority: string;
  jobType: string | null;
  organizationId: string;
  organization?: { legalName: string } | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  requestedGuardianCount: number;
  dispatchAttempts: number;
  maxDispatchAttempts: number;
  notes: string | null;
  specialInstructions: string | null;
  location: Location | null;
  assignments: Assignment[];
  statusHistory: StatusHistory[];
}

// ── Status / priority configs ─────────────────────────────────────────────────
const JOB_STATUS: Record<string, { dot: string; text: string; badge: string; label: string }> = {
  PENDING:     { dot: 'bg-amber-400',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',   label: 'Pending dispatch' },
  DISPATCHING: { dot: 'bg-blue-400',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',     label: 'Dispatching' },
  ASSIGNED:    { dot: 'bg-purple-400', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', label: 'Assigned' },
  IN_PROGRESS: { dot: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700',   label: 'On duty' },
  COMPLETED:   { dot: 'bg-slate-400',  text: 'text-slate-500',  badge: 'bg-slate-100 text-slate-600',   label: 'Completed' },
  FAILED:      { dot: 'bg-red-500',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',       label: 'Failed' },
  CANCELLED:   { dot: 'bg-red-400',    text: 'text-red-600',    badge: 'bg-red-100 text-red-600',       label: 'Cancelled' },
};

const ASSIGNMENT_STATUS: Record<string, { badge: string; label: string; dot: string }> = {
  OFFERED:   { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  label: 'Offer sent' },
  ACCEPTED:  { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400',   label: 'Accepted' },
  DECLINED:  { badge: 'bg-red-100 text-red-600',       dot: 'bg-red-400',    label: 'Declined' },
  EXPIRED:   { badge: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-300',  label: 'Expired' },
  EN_ROUTE:  { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400', label: 'En route' },
  ON_SITE:   { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  label: 'On site' },
  COMPLETED: { badge: 'bg-slate-100 text-slate-700',   dot: 'bg-green-400',  label: 'Completed' },
  NO_SHOW:   { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: 'No show' },
  CANCELLED: { badge: 'bg-slate-100 text-slate-400',   dot: 'bg-slate-300',  label: 'Cancelled' },
};

const PRIORITY_CFG: Record<string, { cls: string; label: string }> = {
  URGENT:   { cls: 'bg-red-100 text-red-700 ring-1 ring-red-200',        label: 'Urgent' },
  HIGH:     { cls: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200', label: 'High' },
  STANDARD: { cls: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',      label: 'Standard' },
  MEDIUM:   { cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',   label: 'Medium' },
  LOW:      { cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',  label: 'Low' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function relativeDate(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diff = Math.floor(
    (new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86_400_000,
  );
  if (diff === 0)  return 'Today';
  if (diff === 1)  return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function guardianInitials(name: string | null, phone: string): string {
  if (!name) return phone.slice(-2).toUpperCase();
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function labelify(s: string | null | undefined): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Section card ──────────────────────────────────────────────────────────────
function Card({ icon, title, count, children }: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded border border-slate-200 overflow-hidden mb-4">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        {icon}
        <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
        {count !== undefined && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded font-mono">
            {count}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Info row (sidebar) ────────────────────────────────────────────────────────
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-slate-100 last:border-0 gap-3">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 pt-1">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['bg-green-700','bg-blue-700','bg-violet-700','bg-amber-600','bg-cyan-700'];

export function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [incidents, setIncidents] = useState<FieldIncident[]>([]);

  useEffect(() => {
    if (!id) return;
    const jobId = id;
    let cancelled = false;
    async function load() {
      try {
        const [jobData, incidentData] = await Promise.all([
          fetchAssignmentById(jobId),
          fetchJobIncidents(jobId).catch(() => []),
        ]);
        if (!cancelled) {
          setJob(jobData as JobDetail);
          setIncidents(incidentData);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load job');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleAction(fn: () => Promise<unknown>, msg: string) {
    if (!id || actionLoading) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await fn();
      const data = await fetchAssignmentById(id);
      setJob(data as JobDetail);
      setActionMsg({ text: msg, ok: true });
    } catch (err) {
      setActionMsg({ text: err instanceof Error ? err.message : 'Action failed', ok: false });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!job)      return <div className="p-6 text-slate-500">Job not found.</div>;

  const isDone          = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status);
  const status          = JOB_STATUS[job.status]    ?? { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', label: job.status, text: 'text-slate-600' };
  const priority        = PRIORITY_CFG[job.priority] ?? { cls: 'bg-slate-100 text-slate-500', label: job.priority };
  const activeGuardians = job.assignments.filter((a) => ['ACCEPTED','EN_ROUTE','ON_SITE','COMPLETED'].includes(a.status));
  const dateLabel       = relativeDate(job.scheduledStart);
  const isToday         = dateLabel === 'Today';

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-contain bg-slate-50" style={{ fontFamily: IBM }}>

      {/* ── Dark banner ── */}
      <div className="relative bg-[#0D1117] px-4 pt-5 pb-5 sm:px-6 sm:pt-7 sm:pb-6 shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">

          {/* Identity block */}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <code className="text-white text-lg font-bold font-mono tracking-tight">{job.referenceNumber}</code>
              <span className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', status.badge)}>
                {status.label}
              </span>
              <span className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', priority.cls)}>
                {priority.label}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              {job.organization?.legalName && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> {job.organization.legalName}
                </span>
              )}
              {job.location && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-600 hidden sm:inline-block" />
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {job.location.name}{job.location.district ? ` · ${job.location.district}` : ''}
                  </span>
                </>
              )}
              {job.jobType && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-600 hidden sm:inline-block" />
                  <span>{labelify(job.jobType)}</span>
                </>
              )}
            </div>

            {/* Schedule */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
                isToday ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-slate-400 border border-white/10',
              )}>
                <Calendar className="w-3 h-3" />
                <span className="font-mono">{dateLabel} · {fmtTime(job.scheduledStart)}{job.scheduledEnd ? ` – ${fmtTime(job.scheduledEnd)}` : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-white/5 border border-white/10 text-slate-400">
                <Users className="w-3 h-3" />
                <span className="font-mono">{activeGuardians.length} / {job.requestedGuardianCount} guardians</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:pt-1">
            <PermissionGate permission="jobs:dispatch">
              <button
                type="button"
                disabled={actionLoading || job.status !== 'PENDING'}
                onClick={() => handleAction(() => dispatchJob(job.id), 'Job dispatched to nearest available guardians.')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
              >
                <SendHorizontal className="w-3.5 h-3.5" /> Dispatch
              </button>
            </PermissionGate>
            <PermissionGate permission="jobs:complete">
              <button
                type="button"
                disabled={actionLoading || isDone}
                onClick={() => handleAction(() => completeJob(job.id), 'Job marked as complete.')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
              </button>
            </PermissionGate>
            <PermissionGate permission="jobs:cancel">
              <button
                type="button"
                disabled={actionLoading || isDone}
                onClick={() => handleAction(() => cancelJob(job.id), 'Job cancelled.')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* ── Flash message ── */}
      {actionMsg && (
        <div className={cn(
          'mx-4 sm:mx-5 mt-4 px-4 py-2.5 rounded text-sm flex items-center gap-2',
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

      {/* ── Content grid ── */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 sm:p-5 items-start">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 w-full">

          {/* Active guardians */}
          <Card
            icon={<Shield className="w-3.5 h-3.5 text-slate-400" />}
            title="Assigned guardians"
            count={activeGuardians.length}
          >
            {/* Staffing bar */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded border border-slate-100">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Staffing</span>
                  <span className={cn(
                    'font-mono text-xs font-semibold tabular-nums',
                    activeGuardians.length < job.requestedGuardianCount ? 'text-red-500' : 'text-green-600',
                  )}>
                    {activeGuardians.length} / {job.requestedGuardianCount}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', activeGuardians.length < job.requestedGuardianCount ? 'bg-red-400' : 'bg-green-500')}
                    style={{ width: `${Math.min((activeGuardians.length / Math.max(job.requestedGuardianCount, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {activeGuardians.length === 0 ? (
              <div className="text-center py-6">
                <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No guardians assigned yet</p>
                {job.status === 'PENDING' && (
                  <p className="text-xs text-slate-400 mt-1">Use the Dispatch button above to assign guardians</p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeGuardians.map((a, i) => {
                  const aStatus = ASSIGNMENT_STATUS[a.status] ?? { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300', label: a.status };
                  return (
                    <div key={a.id} className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded border border-slate-200">
                      <div className={cn(
                        'w-10 h-10 rounded flex items-center justify-center text-white text-xs font-bold shrink-0',
                        AVATAR_COLORS[i % AVATAR_COLORS.length],
                      )}>
                        {guardianInitials(a.guardian.user.fullName, a.guardian.user.phoneNumber)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 leading-tight">
                          {a.guardian.user.fullName ?? a.guardian.user.phoneNumber}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <code className="font-mono">{a.guardian.guardianCode}</code> · {a.guardian.districtBase}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className={cn('w-1.5 h-1.5 rounded-full', aStatus.dot)} />
                          <span className="text-xs font-medium text-slate-700">{aStatus.label}</span>
                        </div>
                        {a.acceptedAt && (
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                            Accepted {fmt(a.acceptedAt)}
                          </p>
                        )}
                        {a.arrivedAt && (
                          <p className="font-mono text-[10px] text-slate-400">
                            Arrived {fmt(a.arrivedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Dispatch history */}
          {job.assignments.length > 0 && (
            <Card
              icon={<SendHorizontal className="w-3.5 h-3.5 text-slate-400" />}
              title="Dispatch history"
              count={job.assignments.length}
            >
              {/* Mobile cards */}
              <div className="md:hidden -mx-5 divide-y divide-slate-50">
                {job.assignments.map((a) => {
                  const aStatus = ASSIGNMENT_STATUS[a.status] ?? { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300', label: a.status };
                  return (
                    <div key={a.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="font-mono text-[11px] text-slate-400 shrink-0">#{a.assignmentRound}</code>
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {a.guardian.user.fullName ?? a.guardian.user.phoneNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={cn('w-1.5 h-1.5 rounded-full', aStatus.dot)} />
                          <span className="text-xs font-medium text-slate-700">{aStatus.label}</span>
                        </div>
                      </div>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">{a.guardian.guardianCode}</p>
                      {a.noShowReason && <p className="text-xs text-red-500 mt-0.5">{a.noShowReason}</p>}
                      <p className="font-mono text-[11px] text-slate-400 mt-1.5">
                        Offered {fmt(a.offerSentAt)}
                        {a.expiresAt ? ` · Exp. ${fmt(a.expiresAt)}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-5">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Round', 'Guardian', 'Status', 'Offered at', 'Expires'].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {job.assignments.map((a) => {
                      const aStatus = ASSIGNMENT_STATUS[a.status] ?? { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300', label: a.status };
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-slate-400">#{a.assignmentRound}</td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-slate-900">
                              {a.guardian.user.fullName ?? a.guardian.user.phoneNumber}
                            </p>
                            <p className="font-mono text-xs text-slate-400">{a.guardian.guardianCode}</p>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', aStatus.dot)} />
                              <span className="text-xs font-medium text-slate-700">{aStatus.label}</span>
                            </div>
                            {a.noShowReason && <p className="text-xs text-red-500 mt-0.5">{a.noShowReason}</p>}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{fmt(a.offerSentAt)}</td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{fmt(a.expiresAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dispatch progress */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dispatch attempts</p>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', job.dispatchAttempts >= job.maxDispatchAttempts ? 'bg-red-400' : 'bg-blue-400')}
                    style={{ width: `${Math.min((job.dispatchAttempts / Math.max(job.maxDispatchAttempts, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className={cn(
                  'font-mono text-xs font-semibold tabular-nums',
                  job.dispatchAttempts >= job.maxDispatchAttempts ? 'text-red-500' : 'text-slate-700',
                )}>
                  {job.dispatchAttempts} / {job.maxDispatchAttempts}
                </span>
              </div>
            </Card>
          )}

          {/* Status timeline */}
          <Card
            icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
            title="Status timeline"
            count={job.statusHistory.length}
          >
            {job.statusHistory.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No status changes yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" />
                <div className="space-y-4">
                  {job.statusHistory.map((h, i) => {
                    const isFirst  = i === 0;
                    const toStatus = JOB_STATUS[h.newStatus];
                    return (
                      <div key={h.id} className="flex gap-3.5 relative">
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white shrink-0 mt-0.5 z-10',
                          toStatus?.dot ?? 'bg-slate-300',
                        )} />
                        <div className={cn('flex-1 pb-1', !isFirst && 'border-0')}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-700">
                              {labelify(h.newStatus)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ← from {labelify(h.oldStatus)}
                            </span>
                          </div>
                          {h.reason && (
                            <p className="text-xs text-slate-500 mt-0.5">{h.reason}</p>
                          )}
                          <p className="font-mono text-[10px] text-slate-400 mt-0.5">{fmt(h.changedAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Field incidents */}
          <Card icon={<Siren className="w-3.5 h-3.5 text-slate-400" />} title="Field incidents" count={incidents.length}>
            {incidents.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No incidents reported for this job.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => {
                  const severityColors: Record<string, string> = {
                    CRITICAL: 'bg-red-100 text-red-700 ring-1 ring-red-200',
                    HIGH:     'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
                    MEDIUM:   'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
                    LOW:      'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
                  };
                  return (
                    <div key={inc.id} className="p-4 bg-slate-50 rounded border border-slate-200">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">
                            {labelify(inc.incidentType)}
                          </span>
                          <span className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', severityColors[inc.severity] ?? severityColors.LOW)}>
                            {labelify(inc.severity)}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">{fmt(inc.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 mb-2">{inc.description}</p>
                      {inc.reporter && (
                        <p className="text-xs text-slate-400">
                          Reported by {inc.reporter.fullName ?? inc.reporter.phoneNumber}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-full lg:w-72 lg:shrink-0 space-y-4">

          {/* Job details */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Job details</h3>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Reference">
                <code className="font-mono text-xs font-semibold text-green-600">{job.referenceNumber}</code>
              </InfoRow>
              <InfoRow label="Type">
                <span className="text-sm font-medium text-slate-900">{job.jobType ? labelify(job.jobType) : '—'}</span>
              </InfoRow>
              <InfoRow label="Priority">
                <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold', priority.cls)}>
                  {priority.label}
                </span>
              </InfoRow>
              <InfoRow label="Status">
                <div className="flex items-center gap-1.5 justify-end">
                  <div className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                  <span className={cn('text-xs font-medium', status.text)}>{status.label}</span>
                </div>
              </InfoRow>
              <InfoRow label="Guardians">
                <span className="font-mono text-sm font-semibold text-slate-900">{job.requestedGuardianCount}</span>
              </InfoRow>
              <InfoRow label="Start">
                <div>
                  <p className={cn('font-mono text-xs font-semibold', isToday ? 'text-green-600' : 'text-slate-800')}>{dateLabel}</p>
                  <p className="font-mono text-[11px] text-slate-400">{fmtTime(job.scheduledStart)}</p>
                </div>
              </InfoRow>
              {job.scheduledEnd && (
                <InfoRow label="End">
                  <p className="font-mono text-xs text-slate-700 font-medium">{fmtTime(job.scheduledEnd)}</p>
                </InfoRow>
              )}
              {job.notes && (
                <InfoRow label="Notes">
                  <p className="text-xs text-slate-600 text-right max-w-[160px]">{job.notes}</p>
                </InfoRow>
              )}
              {job.specialInstructions && (
                <InfoRow label="Instructions">
                  <p className="text-xs text-slate-600 text-right max-w-[160px]">{job.specialInstructions}</p>
                </InfoRow>
              )}
            </div>
          </div>

          {/* Location */}
          {job.location && (
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Location</h3>
              </div>
              <div className="p-5">
                <p className="text-sm font-semibold text-slate-900 mb-2">{job.location.name}</p>
                <div className="space-y-1.5">
                  {job.location.district && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      {job.location.district}
                      {job.location.sector ? ` · ${job.location.sector}` : ''}
                    </div>
                  )}
                  {job.location.address && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-1" />
                      {job.location.address}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Incidents notice */}
          <div className="bg-slate-50 rounded border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Field incidents</p>
            </div>
            <p className="text-xs text-slate-400">No incidents reported for this job.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
