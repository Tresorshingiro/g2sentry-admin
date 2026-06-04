import type { JobListResponse } from '@/types/assignment';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export async function fetchAssignments(
  page = 1,
  limit = 20,
  status?: string,
): Promise<JobListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiGet<JobListResponse>(`/jobs?${params}`);
}

export async function fetchAssignmentById(id: string): Promise<unknown> {
  return apiGet(`/jobs/${id}`);
}

export async function dispatchJob(id: string): Promise<unknown> {
  return apiPost(`/jobs/${id}/dispatch`);
}

export async function cancelJob(id: string, reason?: string): Promise<unknown> {
  return apiPatch(`/jobs/${id}/cancel`, { reason });
}

export async function completeJob(id: string): Promise<unknown> {
  return apiPost(`/jobs/${id}/complete`);
}
