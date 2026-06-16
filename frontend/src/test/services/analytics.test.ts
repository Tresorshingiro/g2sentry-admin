import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ apiGet: vi.fn() }));
vi.mock('@/services/api/guardians', () => ({
  fetchGuardianRoster: vi.fn().mockResolvedValue({ items: [] }),
}));

import { apiGet } from '@/lib/api-client';
import type { RawJobFactsDaily, RawGuardianPerfDaily } from '@/services/api/analytics';
import {
  fetchAnalyticsSummary,
  fetchDistrictAssignments,
  fetchGuardianPerfDaily,
  fetchJobFactsDaily,
  fetchJobTypes,
  fetchResponseTimeTrend,
  fetchWeeklyAssignments,
} from '@/services/api/analytics';

const mockApiGet = vi.mocked(apiGet);

beforeEach(() => vi.clearAllMocks());

// Fixed period: Feb 2024 (leap year, clean date arithmetic)
const FEB_START = new Date('2024-02-01');
const FEB_END   = new Date('2024-02-29');

function makeJobRow(overrides: Partial<RawJobFactsDaily> = {}): RawJobFactsDaily {
  return {
    date: '2024-02-05',
    district: 'Gasabo',
    jobType: 'PATROL',
    hourOfDay: 8,
    jobCount: 1,
    completedCount: 1,
    cancelledCount: 0,
    avgResponseMinutes: 10,
    totalRevenue: 10_000,
    ...overrides,
  };
}

// ─── fetchJobFactsDaily ───────────────────────────────────────────────────────

describe('fetchJobFactsDaily', () => {
  it('trims ISO timestamps to YYYY-MM-DD', async () => {
    mockApiGet.mockResolvedValue([makeJobRow({ date: '2024-02-05T00:00:00.000Z' })]);
    const rows = await fetchJobFactsDaily();
    expect(rows[0].date).toBe('2024-02-05');
  });

  it('preserves already-short dates unchanged', async () => {
    mockApiGet.mockResolvedValue([makeJobRow({ date: '2024-02-05' })]);
    const rows = await fetchJobFactsDaily();
    expect(rows[0].date).toBe('2024-02-05');
  });

  it('returns empty array when response is not an array', async () => {
    mockApiGet.mockResolvedValue({ items: [] });
    const rows = await fetchJobFactsDaily();
    expect(rows).toHaveLength(0);
  });
});

// ─── fetchGuardianPerfDaily ───────────────────────────────────────────────────

describe('fetchGuardianPerfDaily', () => {
  it('trims ISO timestamps to YYYY-MM-DD', async () => {
    const raw: RawGuardianPerfDaily = {
      date: '2024-02-10T00:00:00.000Z',
      guardianId: 'g-1',
      jobsAssigned: 3,
      jobsCompleted: 2,
      noShowCount: 0,
      completionRate: '0.67',
      avgResponseMinutes: '8',
      avgRating: '4.5',
    };
    mockApiGet.mockResolvedValue([raw]);
    const rows = await fetchGuardianPerfDaily();
    expect(rows[0].date).toBe('2024-02-10');
  });

  it('returns empty array for non-array response', async () => {
    mockApiGet.mockResolvedValue(null);
    const rows = await fetchGuardianPerfDaily();
    expect(rows).toHaveLength(0);
  });
});

// ─── fetchAnalyticsSummary ────────────────────────────────────────────────────

describe('fetchAnalyticsSummary — totals', () => {
  it('sums jobCounts only within the current period', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobCount: 4 }),
      makeJobRow({ date: '2024-02-20', jobCount: 2 }),
      makeJobRow({ date: '2023-12-01', jobCount: 99 }), // outside both periods — ignored
    ]);
    const { totalAssignments } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(totalAssignments).toBe(6);
  });

  it('calculates +100% change when current is double the previous', async () => {
    // current period (Feb): 6 jobs; comparison period (Jan 3–31): 3 jobs → +100%
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobCount: 6 }),
      makeJobRow({ date: '2024-01-15', jobCount: 3 }),
    ]);
    const { totalAssignmentsChangePct } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(totalAssignmentsChangePct).toBe(100);
  });

  it('returns 0 changePct when comparison period had no jobs', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobCount: 5 }),
    ]);
    const { totalAssignmentsChangePct } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(totalAssignmentsChangePct).toBe(0);
  });

  it('returns all zeros for empty data', async () => {
    mockApiGet.mockResolvedValue([]);
    const s = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(s.totalAssignments).toBe(0);
    expect(s.completionRatePct).toBe(0);
    expect(s.avgResponseMinutes).toBe(0);
  });
});

describe('fetchAnalyticsSummary — completion rate', () => {
  it('calculates completionRatePct correctly', async () => {
    // 5 completed / 6 total = 83%
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobCount: 6, completedCount: 5 }),
    ]);
    const { completionRatePct } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(completionRatePct).toBe(83);
  });

  it('returns 0% completion when no jobs', async () => {
    mockApiGet.mockResolvedValue([]);
    const { completionRatePct } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(completionRatePct).toBe(0);
  });
});

describe('fetchAnalyticsSummary — response time', () => {
  it('averages avgResponseMinutes across non-null rows', async () => {
    // simple average of row values (not weighted by jobCount)
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', avgResponseMinutes: 12 }),
      makeJobRow({ date: '2024-02-20', avgResponseMinutes: 8  }),
    ]);
    const { avgResponseMinutes } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(avgResponseMinutes).toBe(10); // (12+8)/2
  });

  it('returns "No change vs last month" when response time is identical', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', avgResponseMinutes: 10 }),
      makeJobRow({ date: '2024-01-15', avgResponseMinutes: 10 }),
    ]);
    const { avgResponseChangeLabel } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(avgResponseChangeLabel).toBe('No change vs last month');
  });

  it('returns "+X min vs last month" when current is slower', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', avgResponseMinutes: 15 }),
      makeJobRow({ date: '2024-01-15', avgResponseMinutes: 10 }),
    ]);
    const { avgResponseChangeLabel } = await fetchAnalyticsSummary(FEB_START, FEB_END);
    expect(avgResponseChangeLabel).toBe('+5 min vs last month');
  });
});

// ─── fetchWeeklyAssignments ───────────────────────────────────────────────────

describe('fetchWeeklyAssignments', () => {
  it('groups jobs by week of month for the current period', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobCount: 3 }), // Wk 1 (day 5 → ceil(5/7)=1)
      makeJobRow({ date: '2024-02-14', jobCount: 2 }), // Wk 2 (day 14 → ceil(14/7)=2)
    ]);
    const result = await fetchWeeklyAssignments(FEB_START, FEB_END);
    const wk1 = result.find(r => r.week === 'Wk 1');
    const wk2 = result.find(r => r.week === 'Wk 2');
    expect(wk1?.current).toBe(3);
    expect(wk2?.current).toBe(2);
  });

  it('fills in previous period counts for the same week', async () => {
    // Wk 2 appears in both Feb (current) and Jan (comparison)
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-14', jobCount: 2 }), // Feb Wk 2
      makeJobRow({ date: '2024-01-10', jobCount: 4 }), // Jan Wk 2 (day 10 → ceil(10/7)=2)
    ]);
    const result = await fetchWeeklyAssignments(FEB_START, FEB_END);
    const wk2 = result.find(r => r.week === 'Wk 2');
    expect(wk2?.current).toBe(2);
    expect(wk2?.previous).toBe(4);
  });

  it('defaults previous to 0 for weeks with no comparison data', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobCount: 3 }),
    ]);
    const result = await fetchWeeklyAssignments(FEB_START, FEB_END);
    expect(result[0].previous).toBe(0);
  });

  it('returns empty array for empty data', async () => {
    mockApiGet.mockResolvedValue([]);
    const result = await fetchWeeklyAssignments(FEB_START, FEB_END);
    expect(result).toHaveLength(0);
  });
});

// ─── fetchJobTypes ────────────────────────────────────────────────────────────

describe('fetchJobTypes', () => {
  it('returns percentage breakdown by job type', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobType: 'PATROL', jobCount: 3 }),
      makeJobRow({ date: '2024-02-10', jobType: 'ESCORT', jobCount: 1 }),
    ]);
    const result = await fetchJobTypes(FEB_START, FEB_END);
    const patrol = result.find(r => r.label === 'Patrol');
    expect(patrol?.value).toBe(75); // 3/4 = 75%
  });

  it('sorts by count descending (highest first)', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobType: 'ESCORT', jobCount: 1 }),
      makeJobRow({ date: '2024-02-10', jobType: 'PATROL', jobCount: 3 }),
    ]);
    const result = await fetchJobTypes(FEB_START, FEB_END);
    expect(result[0].label).toBe('Patrol');
  });

  it('excludes rows outside the period', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobType: 'PATROL', jobCount: 2 }),
      makeJobRow({ date: '2023-12-01', jobType: 'ESCORT', jobCount: 10 }), // outside
    ]);
    const result = await fetchJobTypes(FEB_START, FEB_END);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Patrol');
  });

  it('uses human-readable label for known job types', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', jobType: 'EVENT_SECURITY', jobCount: 1 }),
    ]);
    const result = await fetchJobTypes(FEB_START, FEB_END);
    expect(result[0].label).toBe('Event Security');
  });

  it('returns empty array when total is 0', async () => {
    mockApiGet.mockResolvedValue([]);
    expect(await fetchJobTypes(FEB_START, FEB_END)).toHaveLength(0);
  });
});

// ─── fetchDistrictAssignments ─────────────────────────────────────────────────

describe('fetchDistrictAssignments', () => {
  it('aggregates job counts from multiple rows for the same district', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', district: 'Gasabo', jobCount: 5 }),
      makeJobRow({ date: '2024-02-10', district: 'Gasabo', jobCount: 3 }),
      makeJobRow({ date: '2024-02-15', district: 'Huye',   jobCount: 4 }),
    ]);
    const result = await fetchDistrictAssignments(FEB_START, FEB_END);
    const gasabo = result.find(r => r.district === 'Gasabo');
    expect(gasabo?.count).toBe(8);
  });

  it('sorts by count descending', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', district: 'Huye',   jobCount: 2 }),
      makeJobRow({ date: '2024-02-10', district: 'Gasabo', jobCount: 8 }),
    ]);
    const result = await fetchDistrictAssignments(FEB_START, FEB_END);
    expect(result[0].district).toBe('Gasabo');
  });

  it('limits result to top 8 districts', async () => {
    const districts = ['A','B','C','D','E','F','G','H','I','J'];
    mockApiGet.mockResolvedValue(
      districts.map((d, i) => makeJobRow({ date: '2024-02-05', district: d, jobCount: 10 - i })),
    );
    const result = await fetchDistrictAssignments(FEB_START, FEB_END);
    expect(result).toHaveLength(8);
  });

  it('excludes rows with no district value', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', district: '',      jobCount: 5 }),
      makeJobRow({ date: '2024-02-05', district: 'Huye',  jobCount: 2 }),
    ]);
    const result = await fetchDistrictAssignments(FEB_START, FEB_END);
    expect(result.every(r => r.district !== '')).toBe(true);
  });
});

// ─── fetchResponseTimeTrend ───────────────────────────────────────────────────

describe('fetchResponseTimeTrend', () => {
  it('computes weighted average response time per month', async () => {
    // Jan: (10*4 + 20*2) / (4+2) = 80/6 → Math.round = 13
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-01-10', avgResponseMinutes: 10, jobCount: 4 }),
      makeJobRow({ date: '2024-01-20', avgResponseMinutes: 20, jobCount: 2 }),
    ]);
    const result = await fetchResponseTimeTrend();
    expect(result).toHaveLength(1);
    expect(result[0].minutes).toBe(13);
  });

  it('produces one entry per calendar month', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-01-10', avgResponseMinutes: 8,  jobCount: 1 }),
      makeJobRow({ date: '2024-02-15', avgResponseMinutes: 10, jobCount: 1 }),
      makeJobRow({ date: '2024-03-05', avgResponseMinutes: 12, jobCount: 1 }),
    ]);
    const result = await fetchResponseTimeTrend();
    expect(result).toHaveLength(3);
  });

  it('sorts results chronologically', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-03-05', avgResponseMinutes: 12, jobCount: 1 }),
      makeJobRow({ date: '2024-01-10', avgResponseMinutes: 8,  jobCount: 1 }),
      makeJobRow({ date: '2024-02-15', avgResponseMinutes: 10, jobCount: 1 }),
    ]);
    const result = await fetchResponseTimeTrend();
    expect(result[0].minutes).toBe(8);  // Jan
    expect(result[1].minutes).toBe(10); // Feb
    expect(result[2].minutes).toBe(12); // Mar
  });

  it('skips rows with null avgResponseMinutes', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', avgResponseMinutes: null, jobCount: 3 }),
      makeJobRow({ date: '2024-02-10', avgResponseMinutes: 15,   jobCount: 2 }),
    ]);
    const result = await fetchResponseTimeTrend();
    expect(result).toHaveLength(1);
    expect(result[0].minutes).toBe(15);
  });

  it('skips rows with jobCount of 0', async () => {
    mockApiGet.mockResolvedValue([
      makeJobRow({ date: '2024-02-05', avgResponseMinutes: 10, jobCount: 0 }),
    ]);
    const result = await fetchResponseTimeTrend();
    expect(result).toHaveLength(0);
  });
});
