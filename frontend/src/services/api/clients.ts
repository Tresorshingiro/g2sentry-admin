import type { ClientListItem, ClientListResponse, ClientVerificationStatus } from '@/types/client';
import { apiGet } from '@/lib/api-client';

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

export async function fetchClients(
  page = 1,
  limit = 20,
  verificationStatus?: string,
  district?: string,
  orgType?: string,
): Promise<ClientListResponse> {
  const params = new URLSearchParams();
  if (verificationStatus) params.set('status', verificationStatus);
  const query = params.toString();
  const raw = await apiGet<ClientListResponse | ClientListItem[]>(
    `/admin/organizations${query ? `?${query}` : ''}`,
  );
  const normalize = (c: ClientListItem): ClientListItem => ({
    ...c,
    activeJobCount: c.activeJobCount ?? 0,
    outstandingBalance: c.outstandingBalance ?? 0,
  });

  let fullList: ClientListItem[] = Array.isArray(raw)
    ? raw.map(normalize)
    : ((raw as ClientListResponse).items ?? []).map(normalize);

  const availableDistricts = [...new Set(
    fullList.map((c) => c.primaryDistrict).filter(Boolean) as string[],
  )].sort();
  const availableOrgTypes = [...new Set(
    fullList.map((c) => c.orgType).filter(Boolean) as string[],
  )].sort();

  const statusCounts: Partial<Record<ClientVerificationStatus, number>> = {};
  for (const c of fullList) {
    if (c.verificationStatus) {
      statusCounts[c.verificationStatus] = (statusCounts[c.verificationStatus] ?? 0) + 1;
    }
  }

  if (district) fullList = fullList.filter((c) => c.primaryDistrict === district);
  if (orgType)  fullList = fullList.filter((c) => c.orgType === orgType);

  const total = fullList.length;
  const items = Array.isArray(raw)
    ? fullList.slice((page - 1) * limit, page * limit)
    : fullList;

  return {
    items,
    meta: { page, limit, total, hasMore: (page - 1) * limit + items.length < total },
    statusCounts,
    availableDistricts,
    availableOrgTypes,
  };
}
