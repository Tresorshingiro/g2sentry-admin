import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export interface FullProfile {
  id: string;
  phone: string;
  email: string | null;
  status: string;
  roles: string[];
  permissions: string[];
  activeRole: string | null;
  organizations: {
    id: string;
    legalName: string;
    tradingName: string | null;
    role: string;
    verificationStatus: string;
  }[];
}

export async function fetchFullProfile(): Promise<FullProfile> {
  return apiGet<FullProfile>('/users/me');
}

export async function updateProfileEmail(email: string): Promise<unknown> {
  return apiPatch('/users/me', { email });
}

export async function changePassword(
  password: string,
  confirmPassword: string,
): Promise<unknown> {
  return apiPost('/auth/password/set', { password, confirmPassword });
}
