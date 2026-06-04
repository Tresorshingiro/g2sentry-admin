import type { AuthUser } from '@/types/auth';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  await delay(800);
  if (!email || !password) throw new Error('Email and password are required');
  return {
    token: `mock-token-${Date.now()}`,
    user: { id: '1', name: 'Admin', role: 'SUPER_ADMIN', permissions: [] },
  };
}

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
