import { describe, it, expect, vi } from 'vitest';
import { login, fetchGuardians, fetchDashboardStats } from './api';

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn().mockResolvedValue({
    jobCount: 34,
    activeGuardians: 28,
    pendingOrgVerifications: 5,
    pendingGuardianVerifications: 7,
    totalRevenue: '620000',
  }),
  apiPost: vi.fn(),
  TOKEN_KEY: 'g2sentry_token',
  REFRESH_KEY: 'g2sentry_refresh_token',
}));

describe('api service', () => {
  it('login resolves with token and user', async () => {
    const result = await login('admin@g2sentry.rw', 'secret');
    expect(result.token).toBeTruthy();
    expect(result.user.name).toBe('Admin');
    expect(result.user.role).toBe('SUPER_ADMIN');
  });

  it('fetchGuardians returns 15 guardians', async () => {
    const { guardians } = await fetchGuardians();
    expect(guardians).toHaveLength(15);
  });

  it('fetchDashboardStats returns job count from real API', async () => {
    const stats = await fetchDashboardStats();
    expect(stats.jobCount).toBe(34);
    expect(stats.activeGuardians).toBe(28);
    expect(stats.totalRevenue).toBe('620000');
  });
});
