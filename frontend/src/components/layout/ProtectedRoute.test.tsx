import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('@/lib/api-client', () => ({
  TOKEN_KEY: 'g2sentry_token',
  REFRESH_KEY: 'g2sentry_refresh',
  apiPost: vi.fn(),
  apiGet: vi.fn().mockResolvedValue({
    id: '1',
    phone: '+250780000000',
    email: 'admin@g2sentry.rw',
    roles: ['SUPER_ADMIN'],
    permissions: [],
    activeRole: 'SUPER_ADMIN',
  }),
}));

beforeEach(() => localStorage.clear());

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login Page')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('renders children when authenticated', async () => {
    localStorage.setItem('g2sentry_token', 'mock-token');
    localStorage.setItem(
      'g2sentry_user',
      JSON.stringify({
        id: '1',
        name: 'Admin',
        role: 'SUPER_ADMIN',
        permissions: [],
      }),
    );
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Dashboard</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });
});
