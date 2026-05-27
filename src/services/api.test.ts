import { describe, it, expect } from 'vitest';
import { login, fetchGuardians, fetchDashboardStats } from './api';

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

  it('fetchDashboardStats returns active assignments count', async () => {
    const stats = await fetchDashboardStats();
    expect(stats.activeAssignments).toBe(34);
  });
});
