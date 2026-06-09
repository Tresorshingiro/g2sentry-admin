import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type { BillingPolicy, PricingRule, ReconciliationRow } from '@/types/pricing';

export async function fetchPricingRules(): Promise<PricingRule[]> {
  return apiGet<PricingRule[]>('/admin/pricing-rules');
}

export async function createPricingRule(data: Partial<PricingRule>): Promise<PricingRule> {
  return apiPost<PricingRule>('/admin/pricing-rules', data);
}

export async function updatePricingRule(id: string, data: Partial<PricingRule>): Promise<PricingRule> {
  return apiPatch<PricingRule>(`/admin/pricing-rules/${id}`, data);
}

export async function fetchBillingPolicies(): Promise<BillingPolicy[]> {
  return apiGet<BillingPolicy[]>('/admin/billing-policies');
}

export async function createBillingPolicy(data: Partial<BillingPolicy>): Promise<BillingPolicy> {
  return apiPost<BillingPolicy>('/admin/billing-policies', data);
}

export async function updateBillingPolicy(id: string, data: Partial<BillingPolicy>): Promise<BillingPolicy> {
  return apiPatch<BillingPolicy>(`/admin/billing-policies/${id}`, data);
}

export async function fetchReconciliation(query: {
  from: string;
  to: string;
  organizationId?: string;
  guardianId?: string;
}): Promise<ReconciliationRow[]> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.organizationId) params.set('organizationId', query.organizationId);
  if (query.guardianId) params.set('guardianId', query.guardianId);
  const raw = await apiGet<{ items: ReconciliationRow[] } | ReconciliationRow[]>(`/admin/billing/reconciliation?${params}`);
  return Array.isArray(raw) ? raw : (raw.items ?? []);
}
