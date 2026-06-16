import {
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBillingPolicy,
  createPricingRule,
  fetchBillingPolicies,
  fetchPricingRules,
  updateBillingPolicy,
  updatePricingRule,
} from '@/services/api';
import type { BillingPolicy, BillingPolicyModel, PricingModel, PricingRule } from '@/types/pricing';

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPES = [
  'PATROL', 'ESCORT', 'EVENT_SECURITY', 'DOOR_SUPERVISION',
  'VIP_PROTECTION', 'EMERGENCY_RESPONSE', 'COMPOUND_SECURITY', 'STATIC_POST',
];

const JOB_TYPE_LABELS: Record<string, string> = {
  PATROL: 'Patrol', ESCORT: 'Escort', EVENT_SECURITY: 'Event Security',
  DOOR_SUPERVISION: 'Door Supervision', VIP_PROTECTION: 'VIP Protection',
  EMERGENCY_RESPONSE: 'Emergency Response', COMPOUND_SECURITY: 'Compound Security',
  STATIC_POST: 'Static Post',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function validRange(from: string | null, until: string | null): string {
  if (!from && !until) return 'Always active';
  return `${fmtDate(from)} → ${fmtDate(until)}`;
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

function PriorityBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-600">
      {n}
    </span>
  );
}

function ModelChip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest border ${color}`}>
      {label}
    </span>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
      {children}
    </th>
  );
}

function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-4 my-4 px-4 py-3 rounded bg-red-50 border border-red-200 flex items-center justify-between gap-4">
      <span className="text-[11px] text-red-700">{message}</span>
      <button type="button" onClick={onRetry} className="flex items-center gap-1 text-[11px] text-red-600 font-medium hover:underline cursor-pointer">
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full border border-slate-200 rounded px-2.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#14B87A] focus:border-[#14B87A] transition-colors';
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

// ─── Pricing Rules slide-over ─────────────────────────────────────────────────

interface PricingRuleFormState {
  priority: number;
  organizationId: string;
  district: string;
  jobType: string;
  pricingModel: PricingModel;
  hourlyRate: string;
  flatFee: string;
  currency: string;
  validFrom: string;
  validUntil: string;
}

const DEFAULT_RULE_FORM: PricingRuleFormState = {
  priority: 10,
  organizationId: '',
  district: '',
  jobType: '',
  pricingModel: 'HOURLY',
  hourlyRate: '',
  flatFee: '',
  currency: 'RWF',
  validFrom: '',
  validUntil: '',
};

function PricingRuleSlideOver({
  rule,
  onClose,
  onSaved,
}: {
  rule: PricingRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PricingRuleFormState>(() => rule ? {
    priority: rule.priority,
    organizationId: rule.organizationId ?? '',
    district: rule.district ?? '',
    jobType: rule.jobType ?? '',
    pricingModel: rule.pricingModel,
    hourlyRate: rule.hourlyRate != null ? String(rule.hourlyRate) : '',
    flatFee: rule.flatFee != null ? String(rule.flatFee) : '',
    currency: rule.currency,
    validFrom: rule.validFrom ? rule.validFrom.slice(0, 10) : '',
    validUntil: rule.validUntil ? rule.validUntil.slice(0, 10) : '',
  } : DEFAULT_RULE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof PricingRuleFormState>(k: K, v: PricingRuleFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        priority: form.priority,
        organizationId: form.organizationId || null,
        district: form.district || null,
        jobType: form.jobType || null,
        pricingModel: form.pricingModel,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
        flatFee: form.flatFee ? Number(form.flatFee) : null,
        currency: form.currency,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      if (rule) {
        await updatePricingRule(rule.id, payload);
      } else {
        await createPricingRule(payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={panelRef}
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-y-auto"
        style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-900">{rule ? 'Edit Pricing Rule' : 'New Pricing Rule'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">{error}</div>
          )}

          <FormField label="Priority">
            <input type="number" min={1} value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} className={INPUT_CLS} required />
          </FormField>

          <FormField label="Organization ID (optional)">
            <input type="text" value={form.organizationId} onChange={(e) => set('organizationId', e.target.value)} placeholder="Leave blank for global" className={INPUT_CLS} />
          </FormField>

          <FormField label="District (optional)">
            <input type="text" value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="e.g. Kigali" className={INPUT_CLS} />
          </FormField>

          <FormField label="Job Type (optional)">
            <select value={form.jobType} onChange={(e) => set('jobType', e.target.value)} className={SELECT_CLS}>
              <option value="">Any job type</option>
              {JOB_TYPES.map((jt) => <option key={jt} value={jt}>{JOB_TYPE_LABELS[jt]}</option>)}
            </select>
          </FormField>

          <FormField label="Pricing Model">
            <div className="flex gap-3">
              {(['HOURLY', 'FLAT_FEE'] as PricingModel[]).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="pricingModel"
                    value={m}
                    checked={form.pricingModel === m}
                    onChange={() => set('pricingModel', m)}
                    className="accent-[#14B87A]"
                  />
                  <span className="text-xs text-slate-700">{m === 'HOURLY' ? 'Hourly' : 'Flat Fee'}</span>
                </label>
              ))}
            </div>
          </FormField>

          {form.pricingModel === 'HOURLY' && (
            <FormField label="Hourly Rate (RWF)">
              <input type="number" min={0} step="0.01" value={form.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)} className={INPUT_CLS} required />
            </FormField>
          )}

          {form.pricingModel === 'FLAT_FEE' && (
            <FormField label="Flat Fee (RWF)">
              <input type="number" min={0} step="0.01" value={form.flatFee} onChange={(e) => set('flatFee', e.target.value)} className={INPUT_CLS} required />
            </FormField>
          )}

          <FormField label="Currency">
            <input type="text" value={form.currency} onChange={(e) => set('currency', e.target.value)} className={INPUT_CLS} required />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valid From">
              <input type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={INPUT_CLS} />
            </FormField>
            <FormField label="Valid Until">
              <input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={INPUT_CLS} />
            </FormField>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {rule ? 'Save Changes' : 'Create Rule'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Billing Policy slide-over ────────────────────────────────────────────────

interface PolicyFormState {
  priority: number;
  organizationId: string;
  jobType: string;
  model: BillingPolicyModel;
  minimumHours: number;
  prorationEnabled: boolean;
  allowEarlyRelease: boolean;
  earlyReleaseRequiresClientApproval: boolean;
  autoApproveAfterMinutes: string;
  validFrom: string;
  validUntil: string;
}

const DEFAULT_POLICY_FORM: PolicyFormState = {
  priority: 10,
  organizationId: '',
  jobType: '',
  model: 'STANDARD',
  minimumHours: 2,
  prorationEnabled: false,
  allowEarlyRelease: false,
  earlyReleaseRequiresClientApproval: false,
  autoApproveAfterMinutes: '',
  validFrom: '',
  validUntil: '',
};

function PolicySlideOver({
  policy,
  onClose,
  onSaved,
}: {
  policy: BillingPolicy | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PolicyFormState>(() => policy ? {
    priority: policy.priority,
    organizationId: policy.organizationId ?? '',
    jobType: policy.jobType ?? '',
    model: policy.model,
    minimumHours: policy.minimumHours,
    prorationEnabled: policy.prorationEnabled,
    allowEarlyRelease: policy.allowEarlyRelease,
    earlyReleaseRequiresClientApproval: policy.earlyReleaseRequiresClientApproval,
    autoApproveAfterMinutes: policy.autoApproveAfterMinutes != null ? String(policy.autoApproveAfterMinutes) : '',
    validFrom: policy.validFrom ? policy.validFrom.slice(0, 10) : '',
    validUntil: policy.validUntil ? policy.validUntil.slice(0, 10) : '',
  } : DEFAULT_POLICY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PolicyFormState>(k: K, v: PolicyFormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        priority: form.priority,
        organizationId: form.organizationId || null,
        jobType: form.jobType || null,
        model: form.model,
        minimumHours: form.minimumHours,
        prorationEnabled: form.prorationEnabled,
        allowEarlyRelease: form.allowEarlyRelease,
        earlyReleaseRequiresClientApproval: form.earlyReleaseRequiresClientApproval,
        autoApproveAfterMinutes: form.autoApproveAfterMinutes ? Number(form.autoApproveAfterMinutes) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      if (policy) {
        await updateBillingPolicy(policy.id, payload);
      } else {
        await createBillingPolicy(payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-y-auto"
        style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-900">{policy ? 'Edit Billing Policy' : 'New Billing Policy'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">{error}</div>
          )}

          <FormField label="Priority">
            <input type="number" min={1} value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} className={INPUT_CLS} required />
          </FormField>

          <FormField label="Organization ID (optional)">
            <input type="text" value={form.organizationId} onChange={(e) => set('organizationId', e.target.value)} placeholder="Leave blank for global" className={INPUT_CLS} />
          </FormField>

          <FormField label="Job Type (optional)">
            <select value={form.jobType} onChange={(e) => set('jobType', e.target.value)} className={SELECT_CLS}>
              <option value="">Any job type</option>
              {JOB_TYPES.map((jt) => <option key={jt} value={jt}>{JOB_TYPE_LABELS[jt]}</option>)}
            </select>
          </FormField>

          <FormField label="Model">
            <select value={form.model} onChange={(e) => set('model', e.target.value as BillingPolicyModel)} className={SELECT_CLS}>
              <option value="STANDARD">Standard</option>
              <option value="MINIMUM_HOURS">Minimum Hours</option>
            </select>
          </FormField>

          <FormField label="Minimum Hours">
            <input type="number" min={0} step="0.5" value={form.minimumHours} onChange={(e) => set('minimumHours', Number(e.target.value))} className={INPUT_CLS} required />
          </FormField>

          <FormField label="Options">
            <div className="space-y-2.5">
              {([
                ['prorationEnabled', 'Proration enabled'],
                ['allowEarlyRelease', 'Allow early release'],
              ] as [keyof PolicyFormState, string][]).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[k] as boolean}
                    onChange={(e) => set(k, e.target.checked)}
                    className="w-4 h-4 rounded accent-[#14B87A]"
                  />
                  <span className="text-xs text-slate-700">{lbl}</span>
                </label>
              ))}

              {form.allowEarlyRelease && (
                <>
                  <label className="flex items-center gap-2.5 cursor-pointer pl-1">
                    <input
                      type="checkbox"
                      checked={form.earlyReleaseRequiresClientApproval}
                      onChange={(e) => set('earlyReleaseRequiresClientApproval', e.target.checked)}
                      className="w-4 h-4 rounded accent-[#14B87A]"
                    />
                    <span className="text-xs text-slate-600">Requires client approval</span>
                  </label>
                  <div className="pl-1">
                    <FormField label="Auto-approve after (minutes)">
                      <input
                        type="number"
                        min={0}
                        value={form.autoApproveAfterMinutes}
                        onChange={(e) => set('autoApproveAfterMinutes', e.target.value)}
                        className={INPUT_CLS}
                        placeholder="Leave blank to disable"
                      />
                    </FormField>
                  </div>
                </>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valid From">
              <input type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={INPUT_CLS} />
            </FormField>
            <FormField label="Valid Until">
              <input type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={INPUT_CLS} />
            </FormField>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] disabled:opacity-50 rounded transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {policy ? 'Save Changes' : 'Create Policy'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SubTab = 'PRICING_RULES' | 'BILLING_POLICIES';

export function PricingPoliciesPage() {
  const [subTab, setSubTab] = useState<SubTab>('PRICING_RULES');

  // pricing rules state
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulePanel, setRulePanel] = useState<{ open: boolean; rule: PricingRule | null }>({ open: false, rule: null });

  // billing policies state
  const [policies, setPolicies] = useState<BillingPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [policyPanel, setPolicyPanel] = useState<{ open: boolean; policy: BillingPolicy | null }>({ open: false, policy: null });

  const loadRules = useCallback(() => {
    setRulesLoading(true);
    setRulesError(null);
    fetchPricingRules()
      .then(setRules)
      .catch((err: unknown) => setRulesError(err instanceof Error ? err.message : 'Failed to load pricing rules'))
      .finally(() => setRulesLoading(false));
  }, []);

  const loadPolicies = useCallback(() => {
    setPoliciesLoading(true);
    setPoliciesError(null);
    fetchBillingPolicies()
      .then(setPolicies)
      .catch((err: unknown) => setPoliciesError(err instanceof Error ? err.message : 'Failed to load billing policies'))
      .finally(() => setPoliciesLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRules(); loadPolicies(); }, [loadRules, loadPolicies]);

  return (
    <div
      className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]"
      style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Pricing & Policies</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">Finance · Configuration</p>
          </div>
          <button
            type="button"
            onClick={() => subTab === 'PRICING_RULES' ? setRulePanel({ open: true, rule: null }) : setPolicyPanel({ open: true, policy: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#14B87A] hover:bg-[#12a56d] rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {subTab === 'PRICING_RULES' ? 'New Rule' : 'New Policy'}
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1">
          {([['PRICING_RULES', 'Pricing Rules'], ['BILLING_POLICIES', 'Billing Policies']] as [SubTab, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubTab(key)}
              className={`px-4 py-2 text-[11px] font-semibold rounded-full transition-colors cursor-pointer ${
                subTab === key
                  ? 'bg-[#14B87A] text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Pricing Rules tab ─────────────────────────────────────────────── */}
        {subTab === 'PRICING_RULES' && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            {rulesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : rulesError ? (
              <ErrorCard message={rulesError} onRetry={loadRules} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <TH>Priority</TH>
                      <TH>Scope</TH>
                      <TH>Model</TH>
                      <TH>Rate</TH>
                      <TH>Valid</TH>
                      <TH>Actions</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[11px] text-slate-400">No pricing rules configured</td>
                      </tr>
                    )}
                    {rules.map((rule) => {
                      const scopeParts: string[] = [];
                      if (rule.district) scopeParts.push(rule.district);
                      if (rule.jobType) scopeParts.push(JOB_TYPE_LABELS[rule.jobType] ?? rule.jobType);
                      const scopeLabel = scopeParts.length > 0 ? scopeParts.join(' · ') : 'Global default';

                      return (
                        <tr key={rule.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <TD><PriorityBadge n={rule.priority} /></TD>
                          <TD>
                            <span className="text-xs text-slate-700">{scopeLabel}</span>
                          </TD>
                          <TD>
                            <ModelChip
                              label={rule.pricingModel === 'HOURLY' ? 'HOURLY' : 'FLAT'}
                              color={rule.pricingModel === 'HOURLY' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}
                            />
                          </TD>
                          <TD>
                            <span className="font-mono text-[11px] text-slate-700">
                              {rule.pricingModel === 'HOURLY'
                                ? `${rule.hourlyRate?.toLocaleString() ?? '—'} RWF/hr`
                                : `${rule.flatFee?.toLocaleString() ?? '—'} RWF flat`}
                            </span>
                          </TD>
                          <TD>
                            <span className="text-[11px] text-slate-500">{validRange(rule.validFrom, rule.validUntil)}</span>
                          </TD>
                          <TD>
                            <button
                              type="button"
                              onClick={() => setRulePanel({ open: true, rule })}
                              className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300 transition-colors cursor-pointer"
                              title="Edit rule"
                              aria-label="Edit rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Billing Policies tab ─────────────────────────────────────────── */}
        {subTab === 'BILLING_POLICIES' && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            {policiesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : policiesError ? (
              <ErrorCard message={policiesError} onRetry={loadPolicies} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <TH>Priority</TH>
                      <TH>Scope</TH>
                      <TH>Model</TH>
                      <TH>Min Hours</TH>
                      <TH>Proration</TH>
                      <TH>Early Release</TH>
                      <TH>Valid</TH>
                      <TH>Actions</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-[11px] text-slate-400">No billing policies configured</td>
                      </tr>
                    )}
                    {policies.map((pol) => {
                      const orgLabel = pol.organization
                        ? (pol.organization.tradingName ?? pol.organization.legalName)
                        : 'Global default';
                      const scopeLabel = pol.jobType
                        ? `${orgLabel} · ${JOB_TYPE_LABELS[pol.jobType] ?? pol.jobType}`
                        : orgLabel;

                      return (
                        <tr key={pol.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <TD><PriorityBadge n={pol.priority} /></TD>
                          <TD><span className="text-xs text-slate-700">{scopeLabel}</span></TD>
                          <TD>
                            <ModelChip
                              label={pol.model === 'MINIMUM_HOURS' ? 'MIN HRS' : pol.model}
                              color={pol.model === 'STANDARD' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                            />
                          </TD>
                          <TD><span className="font-mono text-[11px] text-slate-700">{pol.minimumHours}</span></TD>
                          <TD>
                            <span className={`text-[11px] font-medium ${pol.prorationEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {pol.prorationEnabled ? 'Yes' : 'No'}
                            </span>
                          </TD>
                          <TD>
                            <span className={`text-[11px] font-medium ${pol.allowEarlyRelease ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {pol.allowEarlyRelease ? 'Allowed' : 'Not allowed'}
                            </span>
                          </TD>
                          <TD><span className="text-[11px] text-slate-500">{validRange(pol.validFrom, pol.validUntil)}</span></TD>
                          <TD>
                            <button
                              type="button"
                              onClick={() => setPolicyPanel({ open: true, policy: pol })}
                              className="w-7 h-7 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300 transition-colors cursor-pointer"
                              title="Edit policy"
                              aria-label="Edit policy"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {rulePanel.open && (
        <PricingRuleSlideOver
          rule={rulePanel.rule}
          onClose={() => setRulePanel({ open: false, rule: null })}
          onSaved={() => { setRulePanel({ open: false, rule: null }); loadRules(); }}
        />
      )}

      {policyPanel.open && (
        <PolicySlideOver
          policy={policyPanel.policy}
          onClose={() => setPolicyPanel({ open: false, policy: null })}
          onSaved={() => { setPolicyPanel({ open: false, policy: null }); loadPolicies(); }}
        />
      )}
    </div>
  );
}
