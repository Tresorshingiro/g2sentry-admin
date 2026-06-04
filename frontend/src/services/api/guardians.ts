import type { GuardianListResponse } from '@/types/guardian-roster';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';

export async function fetchGuardianRoster(
  page = 1,
  limit = 50,
  status?: string,
  verificationStatus?: string,
): Promise<GuardianListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (verificationStatus) params.set('verificationStatus', verificationStatus);
  return apiGet<GuardianListResponse>(`/admin/guardians?${params}`);
}

export async function fetchGuardianProfile(id: string): Promise<unknown> {
  return apiGet(`/admin/guardians/${id}`);
}

export interface UpdateGuardianPayload {
  fullName?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  districtBase?: string;
  sectorBase?: string;
  coverageDistricts?: string[];
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'RESERVE';
  yearsExperience?: number;
  specializations?: string[];
  preferredShift?: 'DAY' | 'NIGHT' | 'BOTH';
}

export async function updateGuardian(id: string, dto: UpdateGuardianPayload): Promise<unknown> {
  return apiPatch(`/admin/guardians/${id}`, dto);
}

export async function activateGuardian(id: string): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/activate`);
}

export async function suspendGuardian(id: string): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/suspend`);
}

export async function createGuardianVetting(
  id: string,
  dto: { rnpReferenceNumber?: string; reserveForceVerified?: boolean; notes?: string },
): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/vetting`, dto);
}

export interface CreateGuardianPayload {
  phone: string;
  fullName: string;
  nationalId: string;
  districtBase: string;
  sectorBase?: string;
  coverageDistricts?: string[];
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  email?: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'RESERVE';
  yearsExperience?: number;
  specializations?: string[];
  preferredShift?: 'DAY' | 'NIGHT' | 'BOTH';
  reserveForceNumber?: string;
  rnpReferenceNumber?: string;
  vettingNotes?: string;
}

export async function createGuardian(dto: CreateGuardianPayload): Promise<unknown> {
  return apiPost('/admin/guardians', dto);
}

export interface AddCertificationPayload {
  certificationType: 'FIRST_AID' | 'CROWD_CONTROL' | 'FIREARM' | 'RESERVE_FORCE' | 'RNP_SECURITY_LICENSE';
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  documentId?: string;
}

export async function addCertification(
  guardianId: string,
  dto: AddCertificationPayload,
): Promise<unknown> {
  return apiPost(`/admin/guardians/${guardianId}/certifications`, dto);
}

export async function uploadDocument(file: File): Promise<string> {
  const token = localStorage.getItem('g2sentry_token');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `File upload failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data: { documentId: string } };
  return json.data.documentId;
}

export async function deleteGuardianUser(userId: string): Promise<void> {
  return apiDelete(`/admin/users/${userId}?mode=hard`);
}
