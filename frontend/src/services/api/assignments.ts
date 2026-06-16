import type { JobListResponse } from '@/types/assignment';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export interface ReplacementRequest {
  id: string;                         // assignment ID — use this for API calls
  replacementReason: string | null;
  replacementRequestedAt: string;
  status: string;
  guardian?: {
    id: string;
    guardianCode: string;
    user?: { fullName: string | null; email?: string | null };
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

export interface JobTrackingData {
  jobId: string;
  jobStatus: string;
  assignment: { id: string; status: string; acceptedAt: string | null; arrivedAt: string | null };
  guardian: { id: string; displayName: string | null };
  location: {
    latitude: string | null; longitude: string | null;
    speed: string | null; batteryLevel: number | null;
    recordedAt: string | null; connected: boolean; reachable: boolean;
  };
  destination: { locationId: string; name: string; address: string | null; latitude: string; longitude: string };
  distanceMeters: number | null;
  etaMinutes: number | null;
}

export interface JobInvoiceSummary {
  id: string;
  status: string;
  currency: string;
  amounts: { subtotal: string; tax: string; total: string };
  issuedAt: string | null;
  dueAt: string | null;
  createdAt: string;
}

export async function fetchJobTracking(jobId: string): Promise<JobTrackingData> {
  return apiGet<JobTrackingData>(`/jobs/${jobId}/tracking`);
}

export async function fetchJobInvoice(jobId: string): Promise<JobInvoiceSummary> {
  return apiGet<JobInvoiceSummary>(`/jobs/${jobId}/invoice`);
}
