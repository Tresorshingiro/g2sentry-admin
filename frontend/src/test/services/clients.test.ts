import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn() }));
vi.mock('@/services/api/settings', () => ({ fetchDistricts: vi.fn() }));

import { apiGet } from '@/lib/api-client';
import { fetchDistricts } from '@/services/api/settings';
import { fetchClients } from '@/services/api/clients';

const mockApiGet = vi.mocked(apiGet);
const mockFetchDistricts = vi.mocked(fetchDistricts);

function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'org-1',
    legalName: 'ACME Security Ltd',
    tradingName: null,
    tinNumber: '123456789',
    orgType: 'PRIVATE',
    verificationStatus: 'VERIFIED' as const,
    createdAt: '2024-01-01T00:00:00Z',
    activeJobCount: 2,
    outstandingBalance: 50_000,
    locations: [] as { district: string; isPrimary: boolean }[],
    ...overrides,
  };
}

function makeOrgList(orgs: ReturnType<typeof makeOrg>[]) {
  return { items: orgs, meta: { total: orgs.length, page: 1, limit: 100, hasMore: false } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchDistricts.mockResolvedValue(['Gasabo', 'Kicukiro', 'Nyarugenge']);
});

// ─── derivePrimaryDistrict (tested via fetchClients) ──────────────────────────

describe('derivePrimaryDistrict', () => {
  it('returns district from the isPrimary location', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ locations: [
        { district: 'Kicukiro', isPrimary: false },
        { district: 'Gasabo',   isPrimary: true },
      ]}),
    ]));
    const { items } = await fetchClients();
    expect(items[0].primaryDistrict).toBe('Gasabo');
  });

  it('falls back to the first location when none is primary', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ locations: [
        { district: 'Huye',    isPrimary: false },
        { district: 'Musanze', isPrimary: false },
      ]}),
    ]));
    const { items } = await fetchClients();
    expect(items[0].primaryDistrict).toBe('Huye');
  });

  it('returns null when locations array is empty', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([makeOrg({ locations: [] })]));
    const { items } = await fetchClients();
    expect(items[0].primaryDistrict).toBeNull();
  });

  it('returns null when locations is absent from the response', async () => {
    const { locations: _drop, ...orgNoLocs } = makeOrg();
    mockApiGet.mockResolvedValue(makeOrgList([orgNoLocs as ReturnType<typeof makeOrg>]));
    const { items } = await fetchClients();
    expect(items[0].primaryDistrict).toBeNull();
  });
});

// ─── statusCounts ─────────────────────────────────────────────────────────────

describe('statusCounts', () => {
  it('counts each verification status correctly', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ id: '1', verificationStatus: 'VERIFIED'  as const }),
      makeOrg({ id: '2', verificationStatus: 'VERIFIED'  as const }),
      makeOrg({ id: '3', verificationStatus: 'PENDING'   as const }),
      makeOrg({ id: '4', verificationStatus: 'REJECTED'  as const }),
    ]));
    const { statusCounts } = await fetchClients();
    expect(statusCounts).toEqual({ VERIFIED: 2, PENDING: 1, REJECTED: 1 });
  });

  it('returns empty object when there are no orgs', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([]));
    const { statusCounts } = await fetchClients();
    expect(statusCounts).toEqual({});
  });
});

// ─── client-side filters ──────────────────────────────────────────────────────

describe('filtering by district', () => {
  beforeEach(() => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ id: '1', orgType: 'PRIVATE', locations: [{ district: 'Gasabo',  isPrimary: true }] }),
      makeOrg({ id: '2', orgType: 'NGO',     locations: [{ district: 'Huye',    isPrimary: true }] }),
      makeOrg({ id: '3', orgType: 'PRIVATE', locations: [{ district: 'Gasabo',  isPrimary: true }] }),
    ]));
  });

  it('returns only orgs in the requested district', async () => {
    const { items } = await fetchClients(1, 20, undefined, 'Gasabo');
    expect(items).toHaveLength(2);
    expect(items.every(i => i.primaryDistrict === 'Gasabo')).toBe(true);
  });

  it('updates meta.total to reflect filtered count', async () => {
    const { meta } = await fetchClients(1, 20, undefined, 'Gasabo');
    expect(meta.total).toBe(2);
  });

  it('returns empty items for a district with no orgs', async () => {
    const { items } = await fetchClients(1, 20, undefined, 'Rubavu');
    expect(items).toHaveLength(0);
  });
});

describe('filtering by orgType', () => {
  beforeEach(() => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ id: '1', orgType: 'PRIVATE' }),
      makeOrg({ id: '2', orgType: 'NGO'     }),
      makeOrg({ id: '3', orgType: 'NGO'     }),
    ]));
  });

  it('returns only orgs of the requested type', async () => {
    const { items } = await fetchClients(1, 20, undefined, undefined, 'NGO');
    expect(items).toHaveLength(2);
    expect(items.every(i => i.orgType === 'NGO')).toBe(true);
  });
});

// ─── pagination ───────────────────────────────────────────────────────────────

describe('pagination', () => {
  beforeEach(() => {
    mockApiGet.mockResolvedValue(makeOrgList(
      Array.from({ length: 5 }, (_, i) => makeOrg({ id: String(i) })),
    ));
  });

  it('returns the correct slice for page 1', async () => {
    const { items, meta } = await fetchClients(1, 2);
    expect(items).toHaveLength(2);
    expect(meta.hasMore).toBe(true);
  });

  it('returns a partial last page', async () => {
    const { items, meta } = await fetchClients(3, 2);
    expect(items).toHaveLength(1);
    expect(meta.hasMore).toBe(false);
  });

  it('returns empty items beyond the last page', async () => {
    const { items } = await fetchClients(10, 20);
    expect(items).toHaveLength(0);
  });
});

// ─── availableDistricts ───────────────────────────────────────────────────────

describe('availableDistricts', () => {
  it('uses the list from fetchDistricts when available', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([]));
    mockFetchDistricts.mockResolvedValue(['Gasabo', 'Kicukiro']);
    const { availableDistricts } = await fetchClients();
    expect(availableDistricts).toEqual(['Gasabo', 'Kicukiro']);
  });

  it('falls back to districts derived from org locations when fetchDistricts fails', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ id: '1', locations: [{ district: 'Huye',    isPrimary: true }] }),
      makeOrg({ id: '2', locations: [{ district: 'Musanze', isPrimary: true }] }),
      makeOrg({ id: '3', locations: [{ district: 'Huye',    isPrimary: true }] }),
    ]));
    mockFetchDistricts.mockRejectedValue(new Error('network error'));
    const { availableDistricts } = await fetchClients();
    expect(availableDistricts).toEqual(['Huye', 'Musanze']); // deduped + sorted
  });
});

// ─── availableOrgTypes ────────────────────────────────────────────────────────

describe('availableOrgTypes', () => {
  it('returns deduplicated sorted org types', async () => {
    mockApiGet.mockResolvedValue(makeOrgList([
      makeOrg({ id: '1', orgType: 'NGO'     }),
      makeOrg({ id: '2', orgType: 'PRIVATE' }),
      makeOrg({ id: '3', orgType: 'NGO'     }),
    ]));
    const { availableOrgTypes } = await fetchClients();
    expect(availableOrgTypes).toEqual(['NGO', 'PRIVATE']);
  });
});

// ─── defaults ────────────────────────────────────────────────────────────────

describe('field defaults', () => {
  it('defaults missing activeJobCount and outstandingBalance to 0', async () => {
    const { activeJobCount: _a, outstandingBalance: _b, ...bare } = makeOrg();
    mockApiGet.mockResolvedValue(makeOrgList([bare as ReturnType<typeof makeOrg>]));
    const { items } = await fetchClients();
    expect(items[0].activeJobCount).toBe(0);
    expect(items[0].outstandingBalance).toBe(0);
  });
});
