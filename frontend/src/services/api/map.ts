import type { ClientLocation, Guardian } from '@/types/guardian';
import { apiGet } from '@/lib/api-client';
import { fetchAssignments } from './assignments';

interface GuardianMapItem {
  guardianId: string;
  guardianCode: string;
  fullName: string | null;
  districtBase?: string | null;
  status: string;
  shiftStatus: string;
  availableForJobs: boolean;
  latitude: number | string | null;
  longitude: number | string | null;
  connected: boolean;
  reachable: boolean;
}

interface SiteMapItem {
  id: string;
  name?: string;
  district?: string | null;
  latitude: number | string;
  longitude: number | string;
  organizationId?: string;
  organization?: { legalName?: string; tradingName?: string | null } | null;
}

function shiftStatusToMapStatus(shiftStatus: string): Guardian['status'] {
  if (shiftStatus === 'BUSY') return 'ON_DUTY';
  if (shiftStatus === 'AVAILABLE') return 'AVAILABLE';
  return 'OFFLINE';
}

function toInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export async function fetchGuardians(): Promise<{
  guardians: Guardian[];
  clientLocations: ClientLocation[];
}> {
  const [rawGuardians, rawSites] = await Promise.all([
    apiGet<unknown>('/admin/map/guardians'),
    apiGet<unknown>('/admin/map/sites').catch(() => []),
  ]);

  const guardianItems: GuardianMapItem[] = Array.isArray(rawGuardians)
    ? rawGuardians
    : ((rawGuardians as { items?: GuardianMapItem[] })?.items ?? []);
  const siteItems: SiteMapItem[] = Array.isArray(rawSites)
    ? rawSites
    : ((rawSites as { items?: SiteMapItem[] })?.items ?? []);

  const guardians: Guardian[] = guardianItems.map((g) => {
    const name = g.fullName ?? g.guardianCode ?? 'Guardian';
    return {
      id: g.guardianId,
      name,
      initials: toInitials(name),
      district: g.districtBase ? `${g.districtBase} · ${g.guardianCode}` : g.guardianCode ?? '',
      assignmentType: '',
      status: shiftStatusToMapStatus(g.shiftStatus),
      lat: g.latitude != null ? Number(g.latitude) : NaN,
      lng: g.longitude != null ? Number(g.longitude) : NaN,
    };
  });

  const clientLocations: ClientLocation[] = siteItems.map((s) => ({
    id: s.id,
    lat: Number(s.latitude),
    lng: Number(s.longitude),
    name: s.name,
    district: s.district,
    organizationName: s.organization?.tradingName ?? s.organization?.legalName,
  }));

  return { guardians, clientLocations };
}

export async function fetchGuardianAvailability(): Promise<{
  available: number;
  onDuty: number;
  offline: number;
}> {
  const raw = await apiGet<unknown>('/admin/map/guardians').catch(() => []);
  const items = Array.isArray(raw)
    ? (raw as { shiftStatus: string }[])
    : ((raw as { items?: { shiftStatus: string }[] })?.items ?? []);
  let available = 0, onDuty = 0, offline = 0;
  for (const g of items) {
    if (g.shiftStatus === 'AVAILABLE')   available++;
    else if (g.shiftStatus === 'BUSY')   onDuty++;
    else                                 offline++;
  }
  return { available, onDuty, offline };
}

export async function fetchLiveJobCounts(): Promise<{
  inProgress: number;
  dispatching: number;
  pending: number;
}> {
  const empty = { items: [], meta: { page: 1, limit: 1, total: 0, hasMore: false } };
  const [inProgress, dispatching, pending] = await Promise.all([
    fetchAssignments(1, 1, 'IN_PROGRESS').catch(() => empty),
    fetchAssignments(1, 1, 'DISPATCHING').catch(() => empty),
    fetchAssignments(1, 1, 'PENDING').catch(() => empty),
  ]);
  return {
    inProgress: inProgress.meta?.total ?? 0,
    dispatching: dispatching.meta?.total ?? 0,
    pending: pending.meta?.total ?? 0,
  };
}
