import type { JobListResponse } from '@/types/assignment';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export interface ReplacementRequest {
  id: string;
  assignmentId: string;
  reason: string;
  status: string;
  requestedAt: string;
  guardian?: {
    id: string;
    guardianCode: string;
    user?: { fullName: string | null; phoneNumber: string };
  };
  job?: {
    id: string;
    referenceNumber: string;
    jobType: string;
    organization?: { legalName: string; tradingName: string | null };
  };
}

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

export async function fetchReplacementRequests(): Promise<ReplacementRequest[]> {
  const raw = await apiGet<ReplacementRequest[] | { items: ReplacementRequest[] }>(
    '/admin/assignments/replacement-requests',
  );
  return Array.isArray(raw) ? raw : (raw.items ?? []);
}

export async function approveReplacement(assignmentId: string): Promise<unknown> {
  return apiPost(`/admin/assignments/${assignmentId}/replacement/approve`);
}

export async function denyReplacement(assignmentId: string, note?: string): Promise<unknown> {
  return apiPost(`/admin/assignments/${assignmentId}/replacement/deny`, note ? { note } : {});
}
