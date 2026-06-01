import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { apiPost } from '@/lib/api-client';
import { LoginPage } from './LoginPage';

vi.mock('@/lib/api-client', () => ({
  TOKEN_KEY: 'g2sentry_token',
  REFRESH_KEY: 'g2sentry_refresh',
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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(apiPost).mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  });
});

describe('LoginPage', () => {
  it('renders phone number and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/phone number/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('shows error message on failed login', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new Error('Invalid credentials'));
    renderLogin();
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+250788000000' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('navigates to dashboard on successful login', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+250788123456' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });
});
