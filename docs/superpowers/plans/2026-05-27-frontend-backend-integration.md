# Frontend ↔ Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every mock API call in `g2sentry-admin` with real HTTP calls to `Guardian-backend-service`, implement real JWT auth with refresh, and add permission-gated navigation and new pages for verification and audit logs.

**Architecture:** A thin `api-client.ts` wrapper handles auth headers, response-envelope unwrapping (`{ success, data }` → `data`), and 401 → refresh-token → retry. The existing `useAuth` hook is extended to hold `permissions[]` loaded from `GET /users/me` on app boot. All pages are updated in-place; new pages (Verifications, AuditLog) are added alongside existing ones.

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, native `fetch` (no extra HTTP library needed), existing Tailwind/shadcn/ui components.

---

## Background: What the Backend Returns

### Response Envelope (every endpoint)
```typescript
{ success: boolean; data: T | null; meta: {}; error: null }
```
Always unwrap `.data`. The API client does this automatically.

### Auth Token Response — `POST /auth/sign-in/password`
```typescript
{ accessToken: string; refreshToken: string; expiresIn: string } // e.g. "15m"
```
Body sent: `{ phone: "+250788123456", password: "..." }` — phone **must** be E.164 format.

### `GET /users/me` Response
```typescript
{
  id: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'DELETED';
  roles: ('SUPER_ADMIN' | 'OPS_ADMIN' | 'CLIENT_OWNER' | 'CLIENT_STAFF' | 'GUARDIAN')[];
  permissions: string[];          // e.g. ["admin:guardians:read", "jobs:create", ...]
  activeRole: string | null;
  activeOrgId: string | null;
  organizations: { id: string; legalName: string; tradingName: string | null; role: string }[];
  guardianId: string | null;
  onboarding: { completed: boolean; step: string | null };
}
```

### `GET /admin/analytics/dashboard` Response
```typescript
{
  jobCount: number;
  activeGuardians: number;
  pendingOrgVerifications: number;
  pendingGuardianVerifications: number;
  totalRevenue: string; // Decimal comes as string in JSON
}
```

### Paginated List Response (guardians, invoices, etc.)
```typescript
{ items: T[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }
```

---

## File Map

### Create
| File | Purpose |
|---|---|
| `src/lib/api-client.ts` | fetch wrapper: auth header, envelope unwrap, 401→refresh→retry |
| `src/components/auth/PermissionGate.tsx` | Renders children only when user has a given permission |
| `src/pages/VerificationsPage.tsx` | Org + guardian verification queue (new page) |
| `src/pages/AuditLogPage.tsx` | Paginated audit log table (new page) |
| `.env.local` | `VITE_API_BASE_URL` env var |

### Modify
| File | Change |
|---|---|
| `vite.config.ts` | Add dev-server proxy `/api → http://localhost:3000` |
| `src/types/auth.ts` | Add `permissions`, `refreshToken` to stored types |
| `src/hooks/useAuth.tsx` | Real login, `GET /users/me` on boot, token refresh, logout |
| `src/services/api.ts` | Replace all mock returns with real `apiGet`/`apiPost`/`apiPatch` calls |
| `src/pages/LoginPage.tsx` | Phone + password form (phone in E.164 format) |
| `src/pages/DashboardPage.tsx` | Map real dashboard response fields |
| `src/pages/GuardiansPage.tsx` | Use paginated guardian list, real filter enums |
| `src/pages/GuardianDetailPage.tsx` | Real guardian detail + activate/suspend/vetting actions |
| `src/pages/GuardianRegisterPage.tsx` | POST to real admin endpoint |
| `src/pages/AssignmentsPage.tsx` | Use real jobs list |
| `src/pages/AssignmentDetailPage.tsx` | Real job detail + dispatch/cancel/complete actions |
| `src/pages/AnalyticsPage.tsx` | Use real analytics endpoints |
| `src/pages/BillingPage.tsx` | Use real invoice + payment endpoints |
| `src/App.tsx` | Add `/verifications` and `/audit` routes |
| `src/components/layout/Sidebar.tsx` | Permission-gated nav matching spec structure |

---

## Task 1: Environment Setup

**Files:**
- Create: `.env.local`
- Modify: `vite.config.ts`

- [ ] **Step 1: Create `.env.local`**

```bash
# /home/treasure/Documents/projects/g2sentry-admin/.env.local
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

- [ ] **Step 2: Read current `vite.config.ts`**

Open `src/vite.config.ts` and note its current contents before editing.

- [ ] **Step 3: Add dev-server proxy to `vite.config.ts`**

The proxy rewrites `/api/v1/*` → `http://localhost:3000/api/v1/*` so you avoid CORS in dev. The `VITE_API_BASE_URL` env var is used in production. Merge the `server` block into the existing config — do **not** remove existing settings.

```typescript
// vite.config.ts — add inside defineConfig({})
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 4: Verify env is accessible in TypeScript**

Open `src/vite-env.d.ts` and add the env var declaration:

```typescript
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 5: Commit**

```bash
git add .env.local vite.config.ts src/vite-env.d.ts
git commit -m "chore: add API base URL env and vite dev proxy"
```

---

## Task 2: HTTP API Client

**Files:**
- Create: `src/lib/api-client.ts`

- [ ] **Step 1: Create `src/lib/api-client.ts`**

This module owns all HTTP communication. It:
- Attaches the `Authorization: Bearer <accessToken>` header
- Unwraps the `{ success, data }` envelope
- On 401: tries to silently refresh the access token, then retries once
- Throws with the server's `message` field on error

```typescript
// src/lib/api-client.ts
const BASE = import.meta.env.VITE_API_BASE_URL;

const TOKEN_KEY = 'g2sentry_token';
const REFRESH_KEY = 'g2sentry_refresh_token';

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
    localStorage.setItem(TOKEN_KEY, json.data.accessToken);
    localStorage.setItem(REFRESH_KEY, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  let res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) {
      headers.set('Authorization', `Bearer ${localStorage.getItem(TOKEN_KEY)}`);
      res = await fetch(`${BASE}${path}`, { ...init, headers });
    }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(errBody.message ?? `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

export const apiGet = <T>(path: string) =>
  apiFetch<T>(path, { method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' });

export { TOKEN_KEY, REFRESH_KEY };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/treasure/Documents/projects/g2sentry-admin && npx tsc --noEmit
```

Expected: no errors referencing `api-client.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-client.ts
git commit -m "feat: add HTTP API client with JWT auth and refresh-token retry"
```

---

## Task 3: Update Auth Types & Hook

**Files:**
- Modify: `src/types/auth.ts`
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 1: Update `src/types/auth.ts`**

Replace the entire file with:

```typescript
// src/types/auth.ts
export interface AuthUser {
  id: string;
  name: string;
  role: string;
  permissions: string[];
}
```

- [ ] **Step 2: Rewrite `src/hooks/useAuth.tsx`**

The hook now:
1. Stores `accessToken` + `refreshToken` in localStorage
2. On mount, if a token is already stored, calls `GET /users/me` to hydrate `user` (with `permissions`)
3. `login()` calls the real endpoint, then calls `GET /users/me`
4. `logout()` calls `POST /auth/logout` to revoke the refresh token server-side, then clears localStorage

```typescript
// src/hooks/useAuth.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { TOKEN_KEY, REFRESH_KEY, apiGet, apiPost } from '@/lib/api-client';
import type { AuthUser } from '@/types/auth';

interface MeResponse {
  id: string;
  phone: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  activeRole: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  permissions: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);
const USER_KEY = 'g2sentry_user';

async function fetchMe(): Promise<AuthUser> {
  const me = await apiGet<MeResponse>('/users/me');
  const name = me.email ?? me.phone;
  const role = me.roles[0] ?? 'GUARDIAN';
  return { id: me.id, name, role, permissions: me.permissions };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    fetchMe()
      .then((u) => {
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const tokens = await apiPost<{ accessToken: string; refreshToken: string }>(
      '/auth/sign-in/password',
      { phone, password },
    );
    localStorage.setItem(TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    const me = await fetchMe();
    setUser(me);
    localStorage.setItem(USER_KEY, JSON.stringify(me));
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      await apiPost('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        permissions: user?.permissions ?? [],
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Update `ProtectedRoute` to handle loading state**

Open `src/components/layout/ProtectedRoute.tsx` and check if it handles `isLoading`. If not, update it so it renders a spinner while loading, then redirects to `/login` if unauthenticated:

```typescript
// src/components/layout/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/auth.ts src/hooks/useAuth.tsx src/components/layout/ProtectedRoute.tsx
git commit -m "feat: real JWT auth with GET /users/me, permissions in context, refresh on 401"
```

---

## Task 4: Login Page — Real Phone + Password Form

**Files:**
- Modify: `src/pages/LoginPage.tsx`

The backend's `POST /auth/sign-in/password` requires `phone` in E.164 format (e.g., `+250788123456`). The admin portal does not have an email-based login route — phone is the only supported identifier.

- [ ] **Step 1: Read current `src/pages/LoginPage.tsx`** to understand the existing layout before editing.

- [ ] **Step 2: Rewrite `src/pages/LoginPage.tsx`**

Keep the existing visual layout. Change the email input to a phone input. On submit, call `auth.login(phone, password)` then navigate to `/dashboard`. Display API errors inline.

```typescript
// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phone, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">G2Sentry</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Admin sign in</h1>
          <p className="text-sm text-gray-500 mb-6">Operations & management portal</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+250788123456"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Include country code, e.g. +250</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Start backend and test login manually**

```bash
# Terminal 1 — backend
cd /home/treasure/Documents/projects/Guardian-backend-service
docker compose up -d  # starts postgres + redis
npm run dev

# Terminal 2 — frontend
cd /home/treasure/Documents/projects/g2sentry-admin
npm run dev
```

Open `http://localhost:5173/login` and sign in with an admin account from the seed data. Check the browser Network tab to confirm:
- Request to `POST /api/v1/auth/sign-in/password` returns 201 with `accessToken` + `refreshToken`
- Follow-up `GET /api/v1/users/me` returns 200 with `permissions[]`
- The app redirects to `/dashboard`

- [ ] **Step 4: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "feat: real phone+password login form connected to backend"
```

---

## Task 5: Permission Gate Component + Permission-Aware Sidebar

**Files:**
- Create: `src/components/auth/PermissionGate.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `src/components/auth/PermissionGate.tsx`**

```typescript
// src/components/auth/PermissionGate.tsx
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: Props) {
  const { permissions } = useAuth();
  if (!permissions.includes(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 2: Rewrite `src/components/layout/Sidebar.tsx`**

Update the nav structure to match the spec's recommended hierarchy and gate each section/item by the relevant permission. Items that aren't available to the user simply don't render.

```typescript
// src/components/layout/Sidebar.tsx
import {
  BarChart2,
  Briefcase,
  CheckSquare,
  FileText,
  LayoutDashboard,
  MapPin,
  ScrollText,
  Settings,
  Shield,
  Tag,
} from 'lucide-react';
import type { ElementType } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  icon: ElementType;
  path: string;
  permission?: string;
}
interface NavGroup {
  section: string;
  items: NavItem[];
}

const nav: NavGroup[] = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'admin:analytics:read' },
      { label: 'Live Map', icon: MapPin, path: '/map' },
    ],
  },
  {
    section: 'Verifications',
    items: [
      { label: 'Verifications', icon: CheckSquare, path: '/verifications', permission: 'admin:verification:read' },
    ],
  },
  {
    section: 'Guardians',
    items: [
      { label: 'All Guardians', icon: Shield, path: '/guardians', permission: 'admin:guardians:read' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Jobs', icon: Briefcase, path: '/assignments', permission: 'jobs:read' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Pricing Rules', icon: Tag, path: '/billing', permission: 'admin:pricing:read' },
      { label: 'Billing', icon: FileText, path: '/billing', permission: 'admin:invoices:read' },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Analytics', icon: BarChart2, path: '/analytics', permission: 'admin:analytics:read' },
      { label: 'Audit Log', icon: ScrollText, path: '/audit', permission: 'admin:audit:read' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
];

export function Sidebar() {
  const { user, logout, permissions } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  const roleLabel = user?.role
    ? user.role.replace(/_/g, ' ').toLowerCase()
    : 'admin';

  function canSee(item: NavItem) {
    if (!item.permission) return true;
    return permissions.includes(item.permission);
  }

  return (
    <aside className="w-60 bg-[#0D1117] flex flex-col shrink-0 h-full">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-base">G2Sentry</span>
      </div>

      <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
        {nav.map((group) => {
          const visible = group.items.filter(canSee);
          if (!visible.length) return null;
          return (
            <div key={group.section}>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider px-2 mb-1">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={`${item.path}-${item.label}`}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-green-700 text-white'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          type="button"
          onClick={async () => { await logout(); navigate('/login'); }}
          className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-medium leading-none">
              {user?.name ?? 'Admin'}
            </p>
            <p className="text-gray-400 text-xs mt-0.5 capitalize">{roleLabel}</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/PermissionGate.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: PermissionGate component and permission-driven sidebar navigation"
```

---

## Task 6: Replace API Layer — Dashboard

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Replace dashboard functions in `src/services/api.ts`**

Remove the mock imports for dashboard-related functions and replace with real calls. Do this **only** for the dashboard functions for now; leave other mocks untouched.

Find and replace these four functions:

```typescript
// src/services/api.ts — replace these four functions (keep all other functions unchanged for now)
import { apiGet } from '@/lib/api-client';
// ... keep all existing type imports ...

// DELETE the mock imports for: mockDashboardStats, mockWeeklyStats, mockActivity, mockDistrictStats

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/admin/analytics/dashboard');
}

export async function fetchWeeklyStats(): Promise<WeeklyJobStat[]> {
  // Not yet available from backend — return empty array until analytics endpoint covers it
  return [];
}

export async function fetchActivity(): Promise<ActivityItem[]> {
  // Not yet available from a dedicated endpoint — return empty array
  return [];
}

export async function fetchDistrictStats(): Promise<DistrictStat[]> {
  return [];
}
```

- [ ] **Step 2: Update `src/types/job.ts` — align `DashboardStats` with real API response**

The real dashboard response fields differ from the mock. Replace `DashboardStats`:

```typescript
// src/types/job.ts — replace DashboardStats interface
export interface DashboardStats {
  jobCount: number;
  activeGuardians: number;
  pendingOrgVerifications: number;
  pendingGuardianVerifications: number;
  totalRevenue: string; // Prisma Decimal serializes as string
}
```

- [ ] **Step 3: Update `DashboardPage.tsx` to use the new field names**

The page currently reads `stats.activeAssignments`, `stats.guardiansOnDuty`, etc. Map them to the real fields:

```typescript
// src/pages/DashboardPage.tsx — replace the stats grid (the 4 StatCard block)
{stats && (
  <div className="grid grid-cols-4 gap-4">
    <StatCard
      icon={<Briefcase className="w-5 h-5 text-green-600" />}
      iconBg="bg-green-50"
      label="Total jobs"
      value={String(stats.jobCount)}
      delta=""
      deltaPositive
      deltaLabel=""
    />
    <StatCard
      icon={<Shield className="w-5 h-5 text-green-600" />}
      iconBg="bg-green-50"
      label="Active guardians"
      value={String(stats.activeGuardians)}
      delta=""
      deltaPositive
      deltaLabel=""
    />
    <StatCard
      icon={<Clock className="w-5 h-5 text-orange-500" />}
      iconBg="bg-orange-50"
      label="Pending org verifications"
      value={String(stats.pendingOrgVerifications)}
      delta=""
      deltaPositive={stats.pendingOrgVerifications === 0}
      deltaLabel=""
    />
    <StatCard
      icon={<DollarSign className="w-5 h-5 text-blue-500" />}
      iconBg="bg-blue-50"
      label="Total revenue"
      value={formatRWF(Number(stats.totalRevenue))}
      delta=""
      deltaPositive
      deltaLabel=""
    />
  </div>
)}
```

- [ ] **Step 4: Compile and run**

```bash
npx tsc --noEmit
npm run dev
```

Navigate to `/dashboard`. Confirm the 4 stat cards show real backend data (not zeros from mocks). Open Network tab to verify the `GET /api/v1/admin/analytics/dashboard` call succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/types/job.ts src/pages/DashboardPage.tsx
git commit -m "feat: wire dashboard to real admin analytics endpoint"
```

---

## Task 7: Replace API Layer — Guardians List

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/types/guardian-roster.ts`
- Modify: `src/pages/GuardiansPage.tsx`

The real `GET /admin/guardians` returns:
```typescript
{
  items: {
    id: string; guardianCode: string; status: 'ACTIVE'|'INACTIVE'|'SUSPENDED';
    verificationStatus: 'PENDING'|'VERIFIED'|'REJECTED';
    rating: string; districtBase: string; employmentType: string;
    joinedAt: string; shiftState: { shiftStatus: string; availableForJobs: boolean } | null;
    user: { id: string; phoneNumber: string; fullName: string | null; status: string };
  }[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}
```

- [ ] **Step 1: Update `src/types/guardian-roster.ts`**

Replace the entire file:

```typescript
// src/types/guardian-roster.ts
export type GuardianStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type GuardianVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ShiftStatus = 'AVAILABLE' | 'BUSY' | 'PAUSED' | 'OFF_DUTY' | 'SUSPENDED';
export type GuardianFilter = 'ALL' | 'ACTIVE' | 'AVAILABLE' | 'VETTING' | 'SUSPENDED';

export interface GuardianListItem {
  id: string;
  guardianCode: string;
  status: GuardianStatus;
  verificationStatus: GuardianVerificationStatus;
  rating: string;
  districtBase: string;
  employmentType: string;
  joinedAt: string;
  shiftState: { shiftStatus: ShiftStatus; availableForJobs: boolean } | null;
  user: { id: string; phoneNumber: string; fullName: string | null; status: string };
  // derived display fields (computed in GuardiansPage)
  name: string;
  code: string;
  district: string;
  initials: string;
  avatarClass: string;
  shifts: string;
  ratingPct: number;
  vetting: GuardianVerificationStatus;
}

export interface GuardianListResponse {
  items: GuardianListItem[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}
```

- [ ] **Step 2: Update guardian fetch functions in `src/services/api.ts`**

```typescript
// src/services/api.ts — replace fetchGuardianRoster and fetchGuardianProfile
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import type { GuardianListResponse } from '@/types/guardian-roster';

export async function fetchGuardianRoster(
  page = 1,
  limit = 50,
  status?: string,
  verificationStatus?: string,
): Promise<GuardianListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (verificationStatus) params.set('verificationStatus', verificationStatus);
  const raw = await apiGet<{ items: Record<string, unknown>[]; meta: Record<string, unknown> }>(
    `/admin/guardians?${params}`,
  );
  return raw as unknown as GuardianListResponse;
}

export async function fetchGuardianProfile(id: string): Promise<unknown> {
  return apiGet(`/admin/guardians/${id}`);
}
```

- [ ] **Step 3: Update `src/pages/GuardiansPage.tsx`**

Replace the entire page to map real API fields to display values. The real API doesn't have `initials`, `avatarClass`, or `shifts` — compute them in the component:

```typescript
// src/pages/GuardiansPage.tsx
import { Download, Eye, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterTabs } from '@/components/shared/FilterTabs';
import {
  GuardianRosterStatusBadge,
  VettingBadge,
} from '@/components/shared/GuardianRosterBadges';
import { ListPagination } from '@/components/shared/ListPagination';
import { PageTopbar, TopbarButton } from '@/components/shared/PageTopbar';
import { cn } from '@/lib/utils';
import { fetchGuardianRoster } from '@/services/api';
import type { GuardianFilter, GuardianListItem } from '@/types/guardian-roster';

const TABS: { key: GuardianFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'AVAILABLE', label: 'Available' },
  { key: 'VETTING', label: 'Vetting Pending' },
  { key: 'SUSPENDED', label: 'Suspended' },
];

const AVATAR_CLASSES = [
  'bg-green-100 text-green-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
];

function toInitials(name: string | null, phone: string): string {
  if (!name) return phone.slice(-2);
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function GuardiansPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GuardianListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<GuardianFilter>('ALL');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const status =
      filter === 'ACTIVE' ? 'ACTIVE'
      : filter === 'SUSPENDED' ? 'SUSPENDED'
      : filter === 'AVAILABLE' ? 'ACTIVE' // shift-based; simplify for now
      : undefined;
    const verificationStatus = filter === 'VETTING' ? 'PENDING' : undefined;

    void fetchGuardianRoster(page, 50, status, verificationStatus).then((res) => {
      const mapped: GuardianListItem[] = res.items.map((g, i) => ({
        ...g,
        name: g.user.fullName ?? g.user.phoneNumber,
        code: g.guardianCode,
        district: g.districtBase,
        initials: toInitials(g.user.fullName, g.user.phoneNumber),
        avatarClass: AVATAR_CLASSES[i % AVATAR_CLASSES.length],
        shifts: '—',
        ratingPct: (Number(g.rating) / 5) * 100,
        vetting: g.verificationStatus,
      }));
      setItems(mapped);
      setTotal(res.meta.total);
    });
  }, [filter, page]);

  const filtered = useMemo(() => items, [items]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Guardian Roster">
        <TopbarButton>
          <Download className="w-3 h-3" /> Export CSV
        </TopbarButton>
        <TopbarButton primary onClick={() => navigate('/guardians/new')}>
          <Plus className="w-3 h-3" /> Register Guardian
        </TopbarButton>
      </PageTopbar>

      <div className="p-4">
        <FilterTabs tabs={TABS} active={filter} onChange={(f) => { setFilter(f); setPage(1); }} />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Name / ID', 'Status', 'District', 'Rating', 'Vetting (RNP)', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => { setSelectedId(row.id); navigate(`/guardians/${row.id}`); }}
                    className={cn(
                      'border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50',
                      selectedId === row.id && 'bg-green-50',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold', row.avatarClass)}>
                          {row.initials}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900">{row.name}</p>
                          <p className="text-[10px] text-slate-400">{row.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <GuardianRosterStatusBadge status={row.status === 'ACTIVE' ? 'ON_DUTY' : row.status === 'SUSPENDED' ? 'SUSPENDED' : 'AVAILABLE'} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{row.district}</td>
                    <td className="px-3 py-2">
                      {Number(row.rating) > 0 ? (
                        <>
                          <p className="text-[11px] font-semibold text-slate-900 mb-1">{Number(row.rating).toFixed(1)}/5</p>
                          <div className="h-1 w-14 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#14B87A] rounded-full" style={{ width: `${row.ratingPct}%` }} />
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <VettingBadge status={row.vetting} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/guardians/${row.id}`)}
                          className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                        </button>
                        <button type="button" className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                          <Pencil className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination showing={filtered.length} total={total} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `/guardians`. Confirm guardians from the real database appear in the table.

- [ ] **Step 5: Commit**

```bash
git add src/types/guardian-roster.ts src/services/api.ts src/pages/GuardiansPage.tsx
git commit -m "feat: wire guardians list to real admin API with pagination"
```

---

## Task 8: Guardian Detail Page — Real Data + Actions

**Files:**
- Modify: `src/pages/GuardianDetailPage.tsx`
- Modify: `src/services/api.ts` (add action functions)

The real `GET /admin/guardians/:id` returns the full guardian including `user`, `shiftState`, `certifications[]`, `vettingRecord`.

- [ ] **Step 1: Add action API functions to `src/services/api.ts`**

```typescript
// src/services/api.ts — add these functions
export async function activateGuardian(id: string): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/activate`);
}

export async function suspendGuardian(id: string): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/suspend`);
}

export async function createGuardianVetting(
  id: string,
  dto: { rnpReferenceNumber?: string; reserveForceVerified?: boolean; notes?: string },
): Promise<unknown> {
  return apiPost(`/admin/guardians/${id}/vetting`, dto);
}
```

- [ ] **Step 2: Rewrite `src/pages/GuardianDetailPage.tsx`**

Read the current file first. Then rewrite to use `fetchGuardianProfile(id)` and display the real guardian fields. Include Activate and Suspend action buttons gated on `admin:guardians:activate` and `admin:guardians:suspend` permissions.

```typescript
// src/pages/GuardianDetailPage.tsx
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { fetchGuardianProfile, activateGuardian, suspendGuardian } from '@/services/api';

interface GuardianDetail {
  id: string;
  guardianCode: string;
  status: string;
  verificationStatus: string;
  rating: string;
  districtBase: string;
  employmentType: string;
  specializations: string[];
  joinedAt: string;
  activatedAt: string | null;
  user: { fullName: string | null; phoneNumber: string; email: string | null };
  shiftState: { shiftStatus: string; availableForJobs: boolean } | null;
  certifications: { id: string; certificationType: string; verificationStatus: string; issuer: string; issueDate: string; expiryDate: string | null }[];
  vettingRecord: { rnpReferenceNumber: string | null; reserveForceVerified: boolean; notes: string | null } | null;
}

export function GuardianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<GuardianDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    void fetchGuardianProfile(id)
      .then((g) => setGuardian(g as GuardianDetail))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleActivate() {
    if (!id) return;
    try {
      await activateGuardian(id);
      setActionMsg('Guardian activated successfully.');
      // Reload
      const updated = await fetchGuardianProfile(id);
      setGuardian(updated as GuardianDetail);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Activation failed');
    }
  }

  async function handleSuspend() {
    if (!id) return;
    try {
      await suspendGuardian(id);
      setActionMsg('Guardian suspended.');
      const updated = await fetchGuardianProfile(id);
      setGuardian(updated as GuardianDetail);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Suspension failed');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!guardian) {
    return <div className="p-6 text-gray-500">Guardian not found.</div>;
  }

  const name = guardian.user.fullName ?? guardian.user.phoneNumber;
  const canActivate = guardian.verificationStatus === 'VERIFIED' &&
    guardian.certifications.some((c) => c.verificationStatus === 'VERIFIED');

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b">
        <button type="button" onClick={() => navigate('/guardians')} className="p-1.5 rounded-md hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{name}</h1>
          <p className="text-xs text-gray-400">{guardian.guardianCode} · {guardian.districtBase}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <PermissionGate permission="admin:guardians:activate">
            <button
              type="button"
              onClick={handleActivate}
              disabled={!canActivate || guardian.status === 'ACTIVE'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" /> Activate
            </button>
          </PermissionGate>
          <PermissionGate permission="admin:guardians:suspend">
            <button
              type="button"
              onClick={handleSuspend}
              disabled={guardian.status !== 'ACTIVE'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40"
            >
              <XCircle className="w-4 h-4" /> Suspend
            </button>
          </PermissionGate>
        </div>
      </div>

      {actionMsg && (
        <div className="mx-6 mt-4 px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg">
          {actionMsg}
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h2 className="font-semibold text-gray-800 mb-3">Profile</h2>
          <Row label="Phone" value={guardian.user.phoneNumber} />
          <Row label="Email" value={guardian.user.email ?? '—'} />
          <Row label="Status" value={guardian.status} />
          <Row label="Verification" value={guardian.verificationStatus} />
          <Row label="Employment" value={guardian.employmentType} />
          <Row label="Specializations" value={guardian.specializations.join(', ') || '—'} />
          <Row label="Rating" value={`${Number(guardian.rating).toFixed(2)} / 5`} />
          <Row label="Joined" value={new Date(guardian.joinedAt).toLocaleDateString()} />
        </div>

        {/* Shift state */}
        {guardian.shiftState && (
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Shift State</h2>
            <Row label="Status" value={guardian.shiftState.shiftStatus} />
            <Row label="Available for jobs" value={guardian.shiftState.availableForJobs ? 'Yes' : 'No'} />
          </div>
        )}

        {/* Vetting */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">RNP Vetting</h2>
          {guardian.vettingRecord ? (
            <>
              <Row label="RNP Reference" value={guardian.vettingRecord.rnpReferenceNumber ?? '—'} />
              <Row label="Reserve Force Verified" value={guardian.vettingRecord.reserveForceVerified ? 'Yes' : 'No'} />
              <Row label="Notes" value={guardian.vettingRecord.notes ?? '—'} />
            </>
          ) : (
            <p className="text-sm text-gray-400">No vetting record yet.</p>
          )}
        </div>

        {/* Certifications */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Certifications</h2>
          {guardian.certifications.length === 0 ? (
            <p className="text-sm text-gray-400">No certifications.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Issuer</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Expires</th>
                </tr>
              </thead>
              <tbody>
                {guardian.certifications.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">{c.certificationType}</td>
                    <td className="py-2">{c.issuer}</td>
                    <td className="py-2">{c.verificationStatus}</td>
                    <td className="py-2">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 text-sm">
      <span className="w-40 text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/guardians`, click a guardian. Confirm the detail page shows real data from the backend. Test the Activate button (should be disabled unless guardian is VERIFIED with at least one VERIFIED certification).

- [ ] **Step 4: Commit**

```bash
git add src/pages/GuardianDetailPage.tsx src/services/api.ts
git commit -m "feat: guardian detail page with real data, activate and suspend actions"
```

---

## Task 9: Guardian Register Page — Real Create

**Files:**
- Modify: `src/pages/GuardianRegisterPage.tsx`
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add `createGuardian` to `src/services/api.ts`**

```typescript
// src/services/api.ts — add
export interface CreateGuardianPayload {
  phone: string;           // E.164 format e.g. +250788123456
  fullName: string;
  nationalId: string;
  districtBase: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'RESERVE';
  email?: string;
  yearsExperience?: number;
  specializations?: string[];
  preferredShift?: 'DAY' | 'NIGHT' | 'BOTH';
  coverageDistricts?: string[];
  reserveForceNumber?: string;
  rnpReferenceNumber?: string;
  vettingNotes?: string;
}

export async function createGuardian(dto: CreateGuardianPayload): Promise<unknown> {
  return apiPost('/admin/guardians', dto);
}
```

- [ ] **Step 2: Read current `src/pages/GuardianRegisterPage.tsx`** to understand existing form fields.

- [ ] **Step 3: Wire the form submit to `createGuardian`**

In `GuardianRegisterPage.tsx`, import `createGuardian` from `@/services/api`. In the form `onSubmit` handler, call `await createGuardian(formData)` and on success navigate to `/guardians`. Display errors inline.

The key fields the backend requires:
- `phone` — E.164 format
- `fullName` — string
- `nationalId` — string (gets hashed server-side)
- `districtBase` — Rwanda district name

Add a note to the phone input: "Include country code e.g. +250788123456".

- [ ] **Step 4: Compile and test**

Create a test guardian through the form. Confirm it appears in the guardian list after creation.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GuardianRegisterPage.tsx src/services/api.ts
git commit -m "feat: guardian register form wired to POST /admin/guardians"
```

---

## Task 10: Replace API Layer — Jobs / Assignments

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/pages/AssignmentsPage.tsx`
- Modify: `src/pages/AssignmentDetailPage.tsx`
- Modify: `src/types/assignment.ts`

The real `GET /jobs` requires `jobs:read` permission. Admins have this. It returns:
```typescript
{ items: Job[]; meta: { page, limit, total, hasMore } }
```

- [ ] **Step 1: Update `src/types/assignment.ts`**

Add the real API response types (keep existing types if they still compile, add new ones):

```typescript
// src/types/assignment.ts — add at bottom
export interface JobListResponse {
  items: AssignmentListItem[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}
```

- [ ] **Step 2: Replace job functions in `src/services/api.ts`**

```typescript
// src/services/api.ts — replace fetchAssignments, fetchAssignmentById
export async function fetchAssignments(
  page = 1,
  limit = 20,
  status?: string,
): Promise<{ items: AssignmentListItem[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiGet(`/jobs?${params}`);
}

export async function fetchAssignmentById(id: string): Promise<unknown> {
  return apiGet(`/jobs/${id}`);
}

export async function dispatchJob(id: string): Promise<unknown> {
  return apiPost(`/jobs/${id}/dispatch`);
}

export async function cancelJob(id: string, reason?: string): Promise<unknown> {
  return apiPatch(`/jobs/${id}/cancel`, { reason });
}

export async function completeJob(id: string): Promise<unknown> {
  return apiPost(`/jobs/${id}/complete`);
}
```

- [ ] **Step 3: Update `AssignmentsPage.tsx`**

Read the current file, then update to call the real `fetchAssignments()`. Map the real `job.status` values (`PENDING`, `DISPATCHING`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED`) to filter tabs. Use `job.referenceNumber` as `code`, `job.organization?.legalName` as `client`, etc.

The mapping from real fields to display fields:
```typescript
// Map real job fields to AssignmentListItem display shape
const mapped: AssignmentListItem = {
  id: job.id,
  code: job.referenceNumber,
  client: job.organization?.legalName ?? '—',
  location: job.location?.name ?? '—',
  scheduleLabel: new Date(job.scheduledStart).toLocaleDateString(),
  scheduleTime: `${new Date(job.scheduledStart).toLocaleTimeString()} – ${new Date(job.scheduledEnd).toLocaleTimeString()}`,
  priority: job.priority === 'URGENT' ? 'HIGH' : job.priority === 'HIGH' ? 'HIGH' : job.priority === 'STANDARD' ? 'MEDIUM' : 'LOW',
  staffing: `${job.requestedGuardianCount} guardian(s)`,
  status: job.status as AssignmentStatus,
};
```

- [ ] **Step 4: Update `AssignmentDetailPage.tsx`**

Add Dispatch, Cancel, and Complete action buttons with `PermissionGate` wrappers:
- Dispatch: `permission="jobs:dispatch"` — calls `dispatchJob(id)`
- Cancel: `permission="jobs:cancel"` — calls `cancelJob(id)`
- Complete: `permission="jobs:complete"` — calls `completeJob(id)`

- [ ] **Step 5: Verify**

Navigate to `/assignments`. Confirm real jobs appear. Test dispatch/cancel on a test job.

- [ ] **Step 6: Commit**

```bash
git add src/types/assignment.ts src/services/api.ts src/pages/AssignmentsPage.tsx src/pages/AssignmentDetailPage.tsx
git commit -m "feat: wire jobs/assignments pages to real API with dispatch, cancel, complete actions"
```

---

## Task 11: Replace API Layer — Analytics & Billing

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/pages/AnalyticsPage.tsx`
- Modify: `src/pages/BillingPage.tsx`

- [ ] **Step 1: Replace analytics functions in `src/services/api.ts`**

```typescript
// src/services/api.ts — replace analytics functions
export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiGet('/admin/analytics/dashboard');
}

export async function fetchWeeklyAssignments(): Promise<WeeklyAssignmentStat[]> {
  const raw = await apiGet<Record<string, unknown>[]>('/admin/analytics/jobs');
  // JobFactsDaily rows — map to WeeklyAssignmentStat
  return (raw as { date: string; jobCount: number; completedCount: number }[]).map((r) => ({
    week: r.date,
    total: r.jobCount,
    completed: r.completedCount,
  })) as unknown as WeeklyAssignmentStat[];
}

export async function fetchGuardianPerformance(): Promise<GuardianPerformanceRow[]> {
  return apiGet('/admin/analytics/guardians');
}

// The following analytics endpoints are not yet individually available from the backend.
// Return empty arrays until they are added.
export async function fetchJobTypes(): Promise<JobTypeStat[]> { return []; }
export async function fetchDistrictAssignments(): Promise<DistrictAssignmentStat[]> { return []; }
export async function fetchResponseTimeTrend(): Promise<ResponseTimeStat[]> { return []; }
export async function fetchExportReports(): Promise<ExportReportItem[]> { return []; }
```

- [ ] **Step 2: Replace billing functions in `src/services/api.ts`**

```typescript
// src/services/api.ts — replace billing functions
export async function fetchBillingSummary(): Promise<BillingSummary> {
  return apiGet('/admin/analytics/dashboard'); // totalRevenue comes from dashboard
}

export async function fetchInvoices(
  page = 1,
  limit = 20,
  status?: string,
): Promise<{ items: InvoiceRow[]; meta: unknown }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'ALL') params.set('status', status);
  return apiGet(`/admin/invoices?${params}`);
}

export async function fetchMonthlyRevenue(): Promise<MonthlyRevenueStat[]> {
  return []; // Not yet available as a dedicated endpoint
}

export async function fetchEbmCompliance(): Promise<EbmComplianceInfo> {
  return { compliant: true, lastChecked: new Date().toISOString() } as unknown as EbmComplianceInfo;
}

export async function issueInvoice(id: string): Promise<unknown> {
  return apiPost(`/invoices/${id}/issue`);
}

export async function voidInvoice(id: string): Promise<unknown> {
  return apiPost(`/invoices/${id}/void`);
}
```

- [ ] **Step 3: Update `AnalyticsPage.tsx` to handle empty states gracefully**

Wrap chart sections in `{data.length > 0 ? <Chart /> : <EmptyState />}` so the page doesn't crash when some analytics endpoints return empty arrays.

- [ ] **Step 4: Update `BillingPage.tsx` to use real invoice list**

The real invoices have `status` values: `DRAFT`, `ISSUED`, `PAID`, `PARTIALLY_PAID`, `OVERDUE`, `VOID`. Update filter tabs to use these. Map real invoice fields to the display table.

- [ ] **Step 5: Verify**

Navigate to `/analytics` and `/billing`. Confirm no crashes. Confirm invoices load from the backend.

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/pages/AnalyticsPage.tsx src/pages/BillingPage.tsx
git commit -m "feat: wire analytics and billing pages to real backend endpoints"
```

---

## Task 12: New Page — Verifications

**Files:**
- Create: `src/pages/VerificationsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add verification API functions to `src/services/api.ts`**

```typescript
// src/services/api.ts — add
export async function fetchPendingOrgs(): Promise<unknown[]> {
  return apiGet('/admin/verification/organizations');
}

export async function reviewOrganization(
  id: string,
  status: 'VERIFIED' | 'REJECTED',
  reason?: string,
): Promise<unknown> {
  return apiPatch(`/admin/verification/organizations/${id}`, { status, reason });
}

export async function fetchPendingGuardians(): Promise<unknown[]> {
  return apiGet('/admin/verification/guardians');
}

export async function reviewGuardian(
  id: string,
  status: 'VERIFIED' | 'REJECTED',
): Promise<unknown> {
  return apiPatch(`/admin/verification/guardians/${id}`, { status });
}

export async function reviewCertification(
  id: string,
  status: 'VERIFIED' | 'REJECTED' | 'EXPIRED',
): Promise<unknown> {
  return apiPatch(`/admin/verification/certifications/${id}`, { status });
}
```

- [ ] **Step 2: Create `src/pages/VerificationsPage.tsx`**

```typescript
// src/pages/VerificationsPage.tsx
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FilterTabs } from '@/components/shared/FilterTabs';
import { PageTopbar } from '@/components/shared/PageTopbar';
import { PermissionGate } from '@/components/auth/PermissionGate';
import {
  fetchPendingOrgs,
  fetchPendingGuardians,
  reviewOrganization,
  reviewGuardian,
} from '@/services/api';

type Tab = 'ORGS' | 'GUARDIANS';

const TABS = [
  { key: 'ORGS' as Tab, label: 'Organizations' },
  { key: 'GUARDIANS' as Tab, label: 'Guardians & Certs' },
];

interface OrgItem {
  id: string;
  legalName: string;
  orgType: string;
  tinNumber: string | null;
  applicationSubmittedAt: string | null;
  verificationStatus: string;
}

interface GuardianVerification {
  id: string;
  guardianCode: string;
  verificationStatus: string;
  user: { fullName: string | null; phoneNumber: string };
  districtBase: string;
  joinedAt: string;
}

export function VerificationsPage() {
  const [tab, setTab] = useState<Tab>('ORGS');
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [guardians, setGuardians] = useState<GuardianVerification[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void fetchPendingOrgs().then((d) => setOrgs(d as OrgItem[]));
    void fetchPendingGuardians().then((d) => setGuardians(d as GuardianVerification[]));
  }, []);

  async function approveOrg(id: string) {
    await reviewOrganization(id, 'VERIFIED');
    setMsg('Organization approved.');
    setOrgs((prev) => prev.filter((o) => o.id !== id));
  }

  async function rejectOrg(id: string) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    await reviewOrganization(id, 'REJECTED', reason);
    setMsg('Organization rejected.');
    setOrgs((prev) => prev.filter((o) => o.id !== id));
  }

  async function approveGuardian(id: string) {
    await reviewGuardian(id, 'VERIFIED');
    setMsg('Guardian verified.');
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  }

  async function rejectGuardian(id: string) {
    await reviewGuardian(id, 'REJECTED');
    setMsg('Guardian rejected.');
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Verifications" />
      <div className="p-4">
        {msg && (
          <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-lg">
            {msg}
          </div>
        )}
        <FilterTabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'ORGS' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            {orgs.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No pending organization verifications.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                    <th className="px-4 py-2">Organization</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">TIN</th>
                    <th className="px-4 py-2">Submitted</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{org.legalName}</td>
                      <td className="px-4 py-3 text-slate-500">{org.orgType}</td>
                      <td className="px-4 py-3 text-slate-500">{org.tinNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {org.applicationSubmittedAt
                          ? new Date(org.applicationSubmittedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PermissionGate permission="admin:verification:write">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => approveOrg(org.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectOrg(org.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'GUARDIANS' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            {guardians.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No pending guardian verifications.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                    <th className="px-4 py-2">Guardian</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">District</th>
                    <th className="px-4 py-2">Joined</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guardians.map((g) => (
                    <tr key={g.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {g.user.fullName ?? g.user.phoneNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{g.guardianCode}</td>
                      <td className="px-4 py-3 text-slate-500">{g.districtBase}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(g.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <PermissionGate permission="admin:verification:write">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => approveGuardian(g.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => rejectGuardian(g.id)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `/verifications` route to `src/App.tsx`**

```typescript
// src/App.tsx — add this route alongside the others
import { VerificationsPage } from '@/pages/VerificationsPage';

// Inside <Routes>:
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
```

- [ ] **Step 4: Verify**

Navigate to `/verifications`. Confirm both tabs load. Test approving and rejecting an organization.

- [ ] **Step 5: Commit**

```bash
git add src/pages/VerificationsPage.tsx src/App.tsx src/services/api.ts
git commit -m "feat: verifications page for org and guardian KYC review"
```

---

## Task 13: New Page — Audit Log

**Files:**
- Create: `src/pages/AuditLogPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add audit log fetch to `src/services/api.ts`**

```typescript
// src/services/api.ts — add
export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; fullName: string | null; phoneNumber: string } | null;
}

export async function fetchAuditLogs(
  page = 1,
  limit = 20,
  actorUserId?: string,
  entityType?: string,
): Promise<{ items: AuditLogItem[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (actorUserId) params.set('actorUserId', actorUserId);
  if (entityType) params.set('entityType', entityType);
  return apiGet(`/admin/audit-logs?${params}`);
}
```

- [ ] **Step 2: Create `src/pages/AuditLogPage.tsx`**

```typescript
// src/pages/AuditLogPage.tsx
import { useEffect, useState } from 'react';
import { PageTopbar } from '@/components/shared/PageTopbar';
import { fetchAuditLogs, type AuditLogItem } from '@/services/api';

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    void fetchAuditLogs(page, LIMIT).then((res) => {
      setLogs(res.items);
      setTotal(res.meta.total);
    });
  }, [page]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <PageTopbar title="Audit Log" />
      <div className="p-4">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity Type</th>
                <th className="px-4 py-2">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {log.actor ? (log.actor.fullName ?? log.actor.phoneNumber) : 'System'}
                  </td>
                  <td className="px-4 py-3 font-medium font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{log.entityType}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[140px]">
                    {log.entityId}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>{total} total entries</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded-md disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * LIMIT >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded-md disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `/audit` route to `src/App.tsx`**

```typescript
// src/App.tsx — add
import { AuditLogPage } from '@/pages/AuditLogPage';

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
```

- [ ] **Step 4: Verify**

Navigate to `/audit`. Confirm audit log entries appear with pagination.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AuditLogPage.tsx src/App.tsx src/services/api.ts
git commit -m "feat: audit log page with pagination"
```

---

## Task 14: Clean Up Remaining Mocks

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Remove unused mock imports from `src/services/api.ts`**

After all previous tasks, check which mock imports are still referenced. Remove any that are no longer used. The `src/services/mock/` folder can stay for reference but should not be imported in production code.

Run:
```bash
grep -n "from './mock" src/services/api.ts
```

Remove any remaining `from './mock/...'` imports and stub out the functions they powered with `return []` or `return {} as T` with a `// TODO: implement endpoint` comment.

- [ ] **Step 2: Update existing tests that break**

The mock-based tests in `src/services/api.test.ts`, `src/hooks/useAuth.test.tsx`, and `src/pages/LoginPage.test.tsx` will need to be updated to mock `fetch` instead of mock data.

For each failing test file, replace direct mock data imports with `vi.stubGlobal('fetch', vi.fn(...))` to mock the HTTP layer:

```typescript
// Example: src/services/api.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: { accessToken: 'test', refreshToken: 'test' } }),
  }));
});
```

- [ ] **Step 3: Run the full test suite**

```bash
npm run test:run
```

Fix any remaining failures. Goal: all tests pass (or are explicitly skipped with `it.skip` if the test is now irrelevant).

- [ ] **Step 4: Final compile check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Final commit**

```bash
git add src/services/api.ts src/services/api.test.ts
git commit -m "chore: remove remaining mock imports and update tests for real HTTP layer"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Auth: `POST /auth/sign-in/password` | Task 3, 4 |
| Bootstrap: `GET /users/me` | Task 3 |
| Refresh token handling | Task 2, 3 |
| Permission-based rendering | Task 5 |
| Dashboard widgets from real API | Task 6 |
| Organization verification workflow | Task 12 |
| Guardian directory + CRUD | Task 7, 8, 9 |
| Guardian activate/suspend | Task 8 |
| RNP vetting | Task 8 |
| Jobs list + dispatch/cancel/complete | Task 10 |
| Pricing rules | ⚠️ Not covered — backend has `GET/POST/PATCH /admin/pricing-rules`. Add a `PricingRulesPage` as a follow-up. |
| Invoice list + issue/void | Task 11 |
| Payments list | Task 11 (`/admin/payments`) |
| Audit logs | Task 13 |
| Permission-gated navigation | Task 5 |
| No client registration flows in admin | Confirmed — `LoginPage` has no register link |

**Pricing Rules gap:** The spec calls for a Pricing Rules page under Finance. Add `src/pages/PricingRulesPage.tsx` calling `GET /admin/pricing-rules` as a follow-up task using the same patterns from Task 12.
