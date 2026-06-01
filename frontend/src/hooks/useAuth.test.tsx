import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';

vi.mock('@/lib/api-client', () => ({
  TOKEN_KEY: 'g2sentry_token',
  REFRESH_KEY: 'g2sentry_refresh_token',
  apiPost: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
  apiGet: vi.fn().mockResolvedValue({
    id: '1',
    phone: '+250780000000',
    email: 'admin@g2sentry.rw',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    activeRole: 'SUPER_ADMIN',
  }),
}));

function TestConsumer() {
  const { isAuthenticated, user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="name">{user?.name ?? 'none'}</span>
      <button
        type="button"
        onClick={() => login('+250780000000', 'password')}
      >
        login
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('useAuth', () => {
  it('starts unauthenticated', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('auth').textContent).toBe('false');
    expect(screen.getByTestId('name').textContent).toBe('none');
  });

  it('becomes authenticated after login', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('login').click();
    });
    expect(screen.getByTestId('auth').textContent).toBe('true');
    expect(screen.getByTestId('name').textContent).toBe('admin@g2sentry.rw');
  });

  it('clears state after logout', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('login').click();
    });
    await act(async () => {
      screen.getByText('logout').click();
    });
    expect(screen.getByTestId('auth').textContent).toBe('false');
  });
});
