import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn() }));

import { apiGet } from '@/lib/api-client';
import { fetchReplacementRequests } from '@/services/api/assignments';

const mockApiGet = vi.mocked(apiGet);

beforeEach(() => vi.clearAllMocks());

const req = {
  id: 'a-1',
  replacementReason: 'Guardian no-show',
  replacementRequestedAt: '2024-02-01T00:00:00Z',
  status: 'PENDING',
};

describe('fetchReplacementRequests', () => {
  it('returns a plain array response as-is', async () => {
    mockApiGet.mockResolvedValue([req]);
    const result = await fetchReplacementRequests();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a-1');
  });

  it('unwraps items from a paginated response object', async () => {
    mockApiGet.mockResolvedValue({ items: [req], meta: { total: 1 } });
    const result = await fetchReplacementRequests();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a-1');
  });

  it('returns empty array when paginated response has no items field', async () => {
    mockApiGet.mockResolvedValue({ meta: { total: 0 } });
    const result = await fetchReplacementRequests();
    expect(result).toHaveLength(0);
  });

  it('returns empty array for an empty array response', async () => {
    mockApiGet.mockResolvedValue([]);
    const result = await fetchReplacementRequests();
    expect(result).toHaveLength(0);
  });

  it('preserves all fields on each request item', async () => {
    mockApiGet.mockResolvedValue([req]);
    const [item] = await fetchReplacementRequests();
    expect(item.replacementReason).toBe('Guardian no-show');
    expect(item.replacementRequestedAt).toBe('2024-02-01T00:00:00Z');
    expect(item.status).toBe('PENDING');
  });
});
