import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  Lock,
  MapPin,
  Server,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import {
  fetchAdminProfile,
  updateAdminEmail,
  fetchDistricts,
  type AdminProfile,
} from '@/services/api/settings';
import { changePassword } from '@/services/api/auth';
import { fetchPricingRules, fetchBillingPolicies } from '@/services/api/pricing';
import type { PricingRule, BillingPolicy } from '@/types/pricing';
import { cn, formatRWF } from '@/lib/utils';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({
  icon,
  iconBg,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-slate-100">
        <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', iconBg)}>
          {icon}
        </div>
        <h3 className="text-xs font-semibold text-slate-900 flex-1">{title}</h3>
        {badge}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-800">{value}</span>
    </div>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function StatusBanner({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <p className="text-[11px] text-slate-500 mt-2">Saving…</p>
    );
  }
  if (status === 'saved') {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-green-700">
        <Check className="w-3 h-3" /> Saved
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-red-600">
      <X className="w-3 h-3" /> {error ?? 'Something went wrong'}
    </div>
  );
}

function RuleScope(rule: PricingRule) {
  const parts: string[] = [];
  if (rule.district) parts.push(rule.district);
  if (rule.jobType) parts.push(rule.jobType.replace('_', ' '));
  if (rule.organizationId) parts.push('Org-specific');
  return parts.length ? parts.join(' · ') : 'Default';
}

function PolicyScope(policy: BillingPolicy) {
  const parts: string[] = [];
  if (policy.organization) parts.push(policy.organization.tradingName ?? policy.organization.legalName);
  if (policy.jobType) parts.push(policy.jobType.replace('_', ' '));
  return parts.length ? parts.join(' · ') : 'Default';
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [email, setEmail] = useState('');
  const [profileStatus, setProfileStatus] = useState<SaveStatus>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwStatus, setPwStatus] = useState<SaveStatus>('idle');
  const [pwError, setPwError] = useState<string | null>(null);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [billingPolicies, setBillingPolicies] = useState<BillingPolicy[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetchAdminProfile(),
      fetchPricingRules(),
      fetchBillingPolicies(),
      fetchDistricts(),
    ]).then(([prof, rules, policies, dists]) => {
      setProfile(prof);
      setEmail(prof.email ?? '');
      setPricingRules(rules);
      setBillingPolicies(policies);
      setDistricts(dists);
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveEmail = async () => {
    if (!profile) return;
    setProfileStatus('saving');
    setProfileError(null);
    try {
      await updateAdminEmail(email);
      setProfile((p) => p ? { ...p, email } : p);
      setProfileStatus('saved');
      setTimeout(() => setProfileStatus('idle'), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save');
      setProfileStatus('error');
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPw) return;
    if (newPassword !== confirmPw) {
      setPwError('Passwords do not match');
      setPwStatus('error');
      return;
    }
    setPwStatus('saving');
    setPwError(null);
    try {
      await changePassword(newPassword, confirmPw);
      setNewPassword('');
      setConfirmPw('');
      setPwStatus('saved');
      setTimeout(() => setPwStatus('idle'), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
      setPwStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50" style={{ fontFamily: IBM }}>
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      </div>
    );
  }

  const activeRole = profile?.activeRole ?? profile?.roles[0] ?? 'ADMIN';

  const DISPATCH_CONFIG = [
    { label: 'Offer TTL', value: '90 s' },
    { label: 'Dispatch window', value: '10 min' },
    { label: 'Max offers per job', value: '20' },
    { label: 'Guardian pool size', value: '50' },
    { label: 'Urgent parallel offers', value: '3' },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50" style={{ fontFamily: IBM }}>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">

          {/* ── Left column ── */}
          <div>

            {/* Admin profile */}
            <FormSection
              icon={<User className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              title="Admin profile"
            >
              <div className="space-y-3">
                <div>
                  <FieldLabel>Phone number</FieldLabel>
                  <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-xs text-slate-600 select-none">
                    {profile?.phone ?? '—'}
                  </div>
                </div>
                <div>
                  <FieldLabel>Role</FieldLabel>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
                      <Shield className="w-3 h-3" />
                      {activeRole.replace('_', ' ')}
                    </span>
                    {(profile?.roles.length ?? 0) > 1 && (
                      <span className="text-[11px] text-slate-400">
                        +{(profile?.roles.length ?? 1) - 1} more
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <FieldLabel>Email address</FieldLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setProfileStatus('idle');
                    }}
                    placeholder="admin@example.com"
                    className="bg-slate-50 h-9"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <StatusBanner status={profileStatus} error={profileError} />
                  <button
                    type="button"
                    onClick={() => void handleSaveEmail()}
                    disabled={profileStatus === 'saving' || !email}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#14B87A] hover:bg-[#12a06b] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Save email
                  </button>
                </div>
              </div>
            </FormSection>

            {/* Change password */}
            <FormSection
              icon={<Lock className="w-4 h-4 text-red-500" />}
              iconBg="bg-red-100"
              title="Change password"
            >
              <div className="space-y-2.5">
                <div>
                  <FieldLabel>New password</FieldLabel>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPwStatus('idle');
                    }}
                    placeholder="Min. 8 characters"
                    className="bg-slate-50 h-9"
                  />
                </div>
                <div>
                  <FieldLabel>Confirm password</FieldLabel>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => {
                      setConfirmPw(e.target.value);
                      setPwStatus('idle');
                    }}
                    placeholder="Repeat new password"
                    className="bg-slate-50 h-9"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <StatusBanner status={pwStatus} error={pwError} />
                  <button
                    type="button"
                    onClick={() => void handleChangePassword()}
                    disabled={pwStatus === 'saving' || !newPassword || !confirmPw}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" /> Update password
                  </button>
                </div>
              </div>
            </FormSection>

            {/* Dispatch configuration */}
            <FormSection
              icon={<Server className="w-4 h-4 text-slate-500" />}
              iconBg="bg-slate-100"
              title="Dispatch configuration"
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Server config
                </span>
              }
            >
              <p className="text-[11px] text-slate-400 mb-2.5">
                These values are set via server environment variables and are read-only here.
              </p>
              {DISPATCH_CONFIG.map((row) => (
                <ReadOnlyRow key={row.label} label={row.label} value={row.value} />
              ))}
            </FormSection>

          </div>

          {/* ── Right column ── */}
          <div>

            {/* Pricing rules */}
            <FormSection
              icon={<Bell className="w-4 h-4 text-amber-500" />}
              iconBg="bg-amber-100"
              title="Pricing rules"
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {pricingRules.length} rule{pricingRules.length !== 1 ? 's' : ''}
                </span>
              }
            >
              {pricingRules.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No pricing rules configured.</p>
              ) : (
                <div className="space-y-1.5">
                  {pricingRules.slice(0, 5).map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center bg-amber-100 text-amber-700 text-[10px] font-bold">
                          {rule.priority}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-800 truncate">
                            {RuleScope(rule)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {rule.pricingModel === 'HOURLY'
                              ? `${formatRWF(rule.hourlyRate ?? 0)}/hr`
                              : `${formatRWF(rule.flatFee ?? 0)} flat`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                          rule.pricingModel === 'HOURLY'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700',
                        )}
                      >
                        {rule.pricingModel === 'HOURLY' ? 'Hourly' : 'Flat'}
                      </span>
                    </div>
                  ))}
                  {pricingRules.length > 5 && (
                    <p className="text-[10px] text-slate-400 pl-1">
                      +{pricingRules.length - 5} more rule{pricingRules.length - 5 !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate('/billing/pricing-policies')}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#14B87A] border border-[#14B87A]/30 hover:bg-[#14B87A]/5 rounded-lg transition-colors cursor-pointer"
              >
                Manage pricing rules <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </FormSection>

            {/* Billing policies */}
            <FormSection
              icon={<ArrowRight className="w-4 h-4 text-blue-500" />}
              iconBg="bg-blue-100"
              title="Billing policies"
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {billingPolicies.length} polic{billingPolicies.length !== 1 ? 'ies' : 'y'}
                </span>
              }
            >
              {billingPolicies.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No billing policies configured.</p>
              ) : (
                <div className="space-y-1.5">
                  {billingPolicies.slice(0, 5).map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center bg-blue-100 text-blue-700 text-[10px] font-bold">
                          {policy.priority}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-800 truncate">
                            {PolicyScope(policy)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Min {policy.minimumHours}h
                            {policy.prorationEnabled ? ' · Prorated' : ''}
                            {policy.allowEarlyRelease ? ' · Early release' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {policy.model.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                  {billingPolicies.length > 5 && (
                    <p className="text-[10px] text-slate-400 pl-1">
                      +{billingPolicies.length - 5} more
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate('/billing/pricing-policies')}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                Manage billing policies <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </FormSection>

            {/* Districts */}
            <FormSection
              icon={<MapPin className="w-4 h-4 text-[#14B87A]" />}
              iconBg="bg-green-100"
              title="Service districts"
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  {districts.length} districts
                </span>
              }
            >
              {districts.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No districts loaded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {districts.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
                    >
                      <MapPin className="w-2.5 h-2.5 text-slate-400" />
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </FormSection>

          </div>
        </div>
      </div>
    </div>
  );
}
