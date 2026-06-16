import type { ClientListItem, ClientListResponse, ClientVerificationStatus } from '@/types/client';
import { apiGet } from '@/lib/api-client';
import { fetchDistricts } from './settings';

export async function fetchClientById(id: string): Promise<unknown> {
  return apiGet(`/organizations/${id}`);
}

export async function fetchOrgById(id: string): Promise<{
  id: string;
  legalName: string;
  tradingName: string | null;
  orgType: string;
}> {
  return apiGet(`/organizations/${id}`);
}

export async function fetchAdminOrgById(id: string): Promise<unknown> {
  const BATCH = 100;
  const first = await apiGet<{ items: unknown[]; meta: { total: number } }>(
    `/admin/organizations?page=1&limit=${BATCH}`,
  );
  const items = first.items ?? [];
  const found = items.find((o) => (o as { id: string }).id === id);
  if (found) return found;

  const total = first.meta?.total ?? items.length;
  const totalPages = Math.ceil(total / BATCH);
  if (totalPages <= 1) return null;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      apiGet<{ items: unknown[] }>(`/admin/organizations?page=${i + 2}&limit=${BATCH}`),
    ),
  );
  for (const page of rest) {
    const match = (page.items ?? []).find((o) => (o as { id: string }).id === id);
    if (match) return match;
  }
  return null;
}

export async function fetchOrgLocations(id: string): Promise<unknown[]> {
  const raw = await apiGet<unknown>(`/organizations/${id}/locations`);
  return Array.isArray(raw) ? raw : ((raw as { items?: unknown[] })?.items ?? []);
}

export async function fetchOrgMembers(id: string): Promise<unknown[]> {
  const raw = await apiGet<unknown>(`/organizations/${id}/members`);
  return Array.isArray(raw) ? raw : ((raw as { items?: unknown[] })?.items ?? []);
}

// Raw org shape from /admin/organizations (locations are nested, no primaryDistrict)
interface RawOrgItem {
  id: string;
  legalName: string;
  tradingName: string | null;
  tinNumber: string | null;
  orgType: string | null;
  verificationStatus: ClientVerificationStatus;
  createdAt: string;
  activeJobCount?: number;
  outstandingBalance?: number;
  locations?: { district: string; isPrimary: boolean }[];
}

function derivePrimaryDistrict(org: RawOrgItem): string | null {
  const locs = org.locations ?? [];
  const primary = locs.find((l) => l.isPrimary) ?? locs[0];
  return primary?.district ?? null;
}

export async function fetchClients(
  page = 1,
  limit = 20,
  verificationStatus?: string,
  district?: string,
  orgType?: string,
): Promise<ClientListResponse> {
  const allParams = new URLSearchParams({ page: '1', limit: '100' });
  if (verificationStatus) allParams.set('status', verificationStatus);

  const [allRaw, districtsRes] = await Promise.all([
    apiGet<{ items: RawOrgItem[]; meta: { total: number } } | RawOrgItem[]>(
      `/admin/organizations?${allParams}`,
    ),
    fetchDistricts().catch(() => [] as string[]),
  ]);

  const rawItems: RawOrgItem[] = Array.isArray(allRaw)
    ? allRaw
    : (allRaw as { items: RawOrgItem[] }).items ?? [];

  const allItems: ClientListItem[] = rawItems.map((org) => ({
    id: org.id,
    legalName: org.legalName,
    tradingName: org.tradingName,
    tinNumber: org.tinNumber,
    orgType: org.orgType,
    verificationStatus: org.verificationStatus,
    createdAt: org.createdAt,
    primaryDistrict: derivePrimaryDistrict(org),
    activeJobCount: org.activeJobCount ?? 0,
    outstandingBalance: org.outstandingBalance ?? 0,
  }));

  const availableDistricts = districtsRes.length > 0
    ? districtsRes
    : [...new Set(allItems.map((c) => c.primaryDistrict).filter(Boolean) as string[])].sort();

  const availableOrgTypes = [...new Set(
    allItems.map((c) => c.orgType).filter(Boolean) as string[],
  )].sort();

  const statusCounts: Partial<Record<ClientVerificationStatus, number>> = {};
  for (const c of allItems) {
    if (c.verificationStatus) {
      statusCounts[c.verificationStatus] = (statusCounts[c.verificationStatus] ?? 0) + 1;
    }
  }

  let filtered = allItems;
  if (district) filtered = filtered.filter((c) => c.primaryDistrict === district);
  if (orgType)  filtered = filtered.filter((c) => c.orgType === orgType);

  const total = filtered.length;
  const items = filtered.slice((page - 1) * limit, page * limit);

  return {
    items,
    meta: { page, limit, total, hasMore: (page - 1) * limit + items.length < total },
    statusCounts,
    availableDistricts,
    availableOrgTypes,
  };
}
