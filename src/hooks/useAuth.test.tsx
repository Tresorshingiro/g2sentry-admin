import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';

function TestConsumer() {
  const { isAuthenticated, user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="name">{user?.name ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          login('tok', { id: '1', name: 'Admin', role: 'SUPER_ADMIN' })
        }
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
    expect(screen.getByTestId('name').textContent).toBe('Admin');
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
