import { apiGet, apiPatch } from '@/lib/api-client';

export interface AdminProfile {
  id: string;
  phone: string;
  email: string | null;
  roles: string[];
  activeRole: string | null;
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  return apiGet<AdminProfile>('/users/me');
}

export async function updateAdminEmail(email: string): Promise<unknown> {
  return apiPatch('/users/me', { email });
}

export async function fetchDistricts(): Promise<string[]> {
  const res = await apiGet<{ districts: string[] }>('/regions/districts');
  return res.districts;
}
