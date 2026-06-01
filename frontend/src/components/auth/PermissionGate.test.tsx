import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { PermissionGate } from './PermissionGate';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
const mockUseAuth = vi.mocked(useAuth);

describe('PermissionGate', () => {
  it('renders children when user has the required permission', () => {
    mockUseAuth.mockReturnValue({ permissions: ['admin:guardians:read'] } as unknown as ReturnType<typeof useAuth>);
    render(
      <PermissionGate permission="admin:guardians:read">
        <span>Protected content</span>
      </PermissionGate>,
    );
    expect(screen.getByText('Protected content')).toBeTruthy();
  });

  it('renders nothing when user lacks the required permission', () => {
    mockUseAuth.mockReturnValue({ permissions: [] } as unknown as ReturnType<typeof useAuth>);
    render(
      <PermissionGate permission="admin:guardians:read">
        <span>Protected content</span>
      </PermissionGate>,
    );
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('renders fallback when user lacks the required permission', () => {
    mockUseAuth.mockReturnValue({ permissions: [] } as unknown as ReturnType<typeof useAuth>);
    render(
      <PermissionGate permission="admin:guardians:read" fallback={<span>No access</span>}>
        <span>Protected content</span>
      </PermissionGate>,
    );
    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('No access')).toBeTruthy();
  });
});
