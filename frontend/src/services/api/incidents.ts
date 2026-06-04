import { apiGet } from '@/lib/api-client';

export interface FieldIncident {
  id: string;
  incidentType: string;
  severity: string;
  description: string;
  mediaIds: string[];
  createdAt: string;
  reporter: { fullName: string | null; phoneNumber: string } | null;
  assignment: {
    id: string;
    guardianId: string;
    status: string;
    guardian?: { guardianCode: string } | null;
    job?: { referenceNumber: string; status: string } | null;
  } | null;
}

export async function fetchJobIncidents(jobId: string): Promise<FieldIncident[]> {
  const raw = await apiGet<unknown>(`/jobs/${jobId}/incidents`);
  if (Array.isArray(raw)) return raw as FieldIncident[];
  return ((raw as { items?: FieldIncident[] })?.items ?? []) as FieldIncident[];
}

export async function fetchAllIncidents(
  page = 1,
  limit = 20,
  severity?: string,
  incidentType?: string,
): Promise<{ items: FieldIncident[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (severity)     params.set('severity', severity);
  if (incidentType) params.set('incidentType', incidentType);
  return apiGet(`/admin/incidents?${params}`);
}
