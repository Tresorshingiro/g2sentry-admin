import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AssignmentDetailPage } from '@/pages/AssignmentDetailPage';
import { AssignmentsPage } from '@/pages/AssignmentsPage';
import { BillingPage } from '@/pages/BillingPage';
import { InvoiceDetailPage } from '@/pages/InvoiceDetailPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { GuardianDetailPage } from '@/pages/GuardianDetailPage';
import { GuardianEditPage } from '@/pages/GuardianEditPage';
import { GuardianOnboardingPage } from '@/pages/GuardianOnboardingPage';
import { GuardianRegisterPage } from '@/pages/GuardianRegisterPage';
import { GuardiansPage } from '@/pages/GuardiansPage';
import { LiveMapPage } from '@/pages/LiveMapPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import { ClientDetailPage } from '@/pages/ClientDetailPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { VerificationsPage } from '@/pages/VerificationsPage';
import { IncidentsPage } from '@/pages/IncidentsPage';

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
        path="/guardians/:id/onboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GuardianOnboardingPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/guardians/:id/edit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GuardianEditPage />
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
        path="/billing/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <InvoiceDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AuditLogPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClientsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/clients/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClientDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/verifications"
        element={
          <ProtectedRoute>
            <AppLayout>
              <VerificationsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProfilePage />
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

      <Route
        path="/incidents"
        element={
          <ProtectedRoute>
            <AppLayout>
              <IncidentsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />


      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
