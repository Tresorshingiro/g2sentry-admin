import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { LoginPage } from './LoginPage';

vi.mock('@/services/api', () => ({
  login: vi.fn().mockResolvedValue({
    token: 'mock-token',
    user: { id: '1', name: 'Admin', role: 'SUPER_ADMIN' },
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

beforeEach(() => localStorage.clear());

describe('LoginPage', () => {
  it('shows validation errors when submitting empty form', async () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeTruthy();
      expect(screen.getByText('Password is required')).toBeTruthy();
    });
  });

  it('shows error for invalid email format', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Enter a valid email')).toBeTruthy();
    });
  });

  it('navigates to dashboard on successful login', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'admin@g2sentry.rw' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });
});
