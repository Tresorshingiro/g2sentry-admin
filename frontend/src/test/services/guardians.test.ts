import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiGet } from '@/lib/api-client';
import { fetchFullGuardianRoster } from '@/services/api/guardians';

const mockApiGet = vi.mocked(apiGet);

beforeEach(() => vi.clearAllMocks());

function makeRosterPage(ids: string[], hasMore: boolean) {
  return {
    items: ids.map(id => ({
      id,
      guardianCode: `GRD-${id}`,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      user: { fullName: `Guardian ${id}`, email: null },
      districtBase: 'Gasabo',
      coverageDistricts: [],
      createdAt: '2024-01-01T00:00:00Z',
    })),
    meta: { page: 1, limit: 100, total: ids.length, hasMore },
  };
}

describe('fetchFullGuardianRoster', () => {
  it('returns all items when hasMore=false on the first page', async () => {
    mockApiGet.mockResolvedValue(makeRosterPage(['g-1', 'g-2'], false));
    const items = await fetchFullGuardianRoster();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('g-1');
  });

  it('accumulates items across multiple pages until hasMore=false', async () => {
    mockApiGet
      .mockResolvedValueOnce(makeRosterPage(['g-1'], true))
      .mockResolvedValueOnce(makeRosterPage(['g-2'], true))
      .mockResolvedValueOnce(makeRosterPage(['g-3'], false));
    const items = await fetchFullGuardianRoster();
    expect(items).toHaveLength(3);
    expect(mockApiGet).toHaveBeenCalledTimes(3);
  });

  it('stops at maxPages even when hasMore remains true', async () => {
    // Every page reports hasMore=true — should stop at maxPages
    mockApiGet.mockResolvedValue(makeRosterPage(['g-x'], true));
    const items = await fetchFullGuardianRoster(3);
    expect(mockApiGet).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(3); // 1 item/page × 3 pages
  });

  it('defaults maxPages to 5', async () => {
    mockApiGet.mockResolvedValue(makeRosterPage(['g-x'], true));
    await fetchFullGuardianRoster(); // no explicit maxPages
    expect(mockApiGet).toHaveBeenCalledTimes(5);
  });

  it('returns empty array when first page has no items', async () => {
    mockApiGet.mockResolvedValue(makeRosterPage([], false));
    const items = await fetchFullGuardianRoster();
    expect(items).toHaveLength(0);
  });
});
