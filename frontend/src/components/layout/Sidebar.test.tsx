import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from './Sidebar';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

function makeAuth(permissions: string[]): ReturnType<typeof useAuth> {
  return {
    user: { id: '1', name: 'Test User', role: 'OPS_ADMIN', permissions },
    isAuthenticated: true,
    isLoading: false,
    permissions,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  mockUseAuth.mockReturnValue(makeAuth([]));
});

describe('Sidebar', () => {
  it('always shows Live Map and Settings regardless of permissions', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Live Map')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('hides permission-gated items when user has no matching permissions', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('All Guardians')).toBeNull();
    expect(screen.queryByText('Billing')).toBeNull();
    expect(screen.queryByText('Audit Log')).toBeNull();
  });

  it('hides entire section when all items in group require missing permissions', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText('Verifications')).toBeNull();
    expect(screen.queryByText('Guardians')).toBeNull();
  });

  it('shows items when user has matching permissions', () => {
    mockUseAuth.mockReturnValue(makeAuth(['admin:guardians:read', 'admin:invoices:read']));
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText('All Guardians')).toBeTruthy();
    expect(screen.getByText('Billing')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('shows all items when user has all permissions', () => {
    mockUseAuth.mockReturnValue(makeAuth([
      'admin:analytics:read',
      'admin:verification:read',
      'admin:guardians:read',
      'jobs:read',
      'admin:clients:read',
      'admin:invoices:read',
      'admin:audit:read',
    ]));
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Verifications/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /All Guardians/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Jobs/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Clients/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Billing/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Analytics/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Audit Log/i })).toBeTruthy();
  });
});
