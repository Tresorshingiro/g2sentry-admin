import { apiGet, apiPatch } from '@/lib/api-client';

export async function fetchPendingOrgs(): Promise<unknown[]> {
  return apiGet('/admin/verification/organizations');
}

export async function reviewOrganization(
  id: string,
  status: 'VERIFIED' | 'REJECTED',
  reason?: string,
): Promise<unknown> {
  return apiPatch(`/admin/verification/organizations/${id}`, { status, reason });
}

export async function fetchPendingGuardians(): Promise<unknown[]> {
  return apiGet('/admin/verification/guardians');
}

export async function reviewGuardian(
  id: string,
  status: 'VERIFIED' | 'REJECTED',
  reason?: string,
): Promise<unknown> {
  return apiPatch(`/admin/verification/guardians/${id}`, { status, ...(reason && { reason }) });
}

export async function reviewCertification(
  id: string,
  status: 'VERIFIED' | 'REJECTED' | 'EXPIRED',
): Promise<unknown> {
  return apiPatch(`/admin/verification/certifications/${id}`, { status });
}
