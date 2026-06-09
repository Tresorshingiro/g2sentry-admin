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
  // No global incidents endpoint exists — aggregate from recent jobs
  const jobsRaw = await apiGet<unknown>('/jobs?page=1&limit=50').catch(() => ({ items: [] }));
  const jobs: { id: string }[] = Array.isArray(jobsRaw)
    ? (jobsRaw as { id: string }[])
    : ((jobsRaw as { items?: { id: string }[] }).items ?? []);

  const perJob = await Promise.all(
    jobs.map((j) => fetchJobIncidents(j.id).catch(() => [] as FieldIncident[])),
  );

  let all = perJob
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (severity)     all = all.filter((i) => i.severity === severity);
  if (incidentType) all = all.filter((i) => i.incidentType === incidentType);

  const total = all.length;
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);

  return { items, meta: { page, limit, total, hasMore: start + items.length < total } };
}
