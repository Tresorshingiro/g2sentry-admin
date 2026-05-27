import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AssignmentDetailPage } from '@/pages/AssignmentDetailPage';
import { AssignmentsPage } from '@/pages/AssignmentsPage';
import { BillingPage } from '@/pages/BillingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GuardianDetailPage } from '@/pages/GuardianDetailPage';
import { GuardianRegisterPage } from '@/pages/GuardianRegisterPage';
import { GuardiansPage } from '@/pages/GuardiansPage';
import { LiveMapPage } from '@/pages/LiveMapPage';
import { LoginPage } from '@/pages/LoginPage';
import { SettingsPage } from '@/pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LiveMapPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/assignments"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AssignmentsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/assignments/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AssignmentDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/guardians"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GuardiansPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/guardians/new"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GuardianRegisterPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/guardians/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GuardianDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AnalyticsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BillingPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
