# G2Sentry Admin

Admin dashboard for G2Sentry — a security-guard operations platform serving Rwanda. Built with React, TypeScript, and Tailwind CSS.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript 6 |
| Build tool | Vite 8 |
| Routing | React Router DOM 6 |
| Styling | Tailwind CSS 3 |
| Charts | ECharts via echarts-for-react |
| Maps | ArcGIS Core 5 |
| PDF export | jsPDF + jspdf-autotable |
| Icons | Lucide React |
| Testing | Vitest + Testing Library |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Backend API running (see `guardian-backend-service`)

### Install

```bash
npm install
```

### Environment

Create a `.env.local` file in this directory:

```env
VITE_API_BASE_URL=/api/v1
```

The dev server proxies `/api` requests to the backend. Update the target in `vite.config.ts` to match your backend host:

```ts
proxy: {
  '/api': {
    target: 'http://localhost:3000', // your backend address
    changeOrigin: true,
  },
},
```

### Run

```bash
npm run dev        # development server with HMR
npm run build      # production build (tsc + vite)
npm run preview    # preview the production build locally
npm run test       # run tests in watch mode
npm run test:run   # run tests once (CI)
npm run lint       # ESLint
```

---

## Project Structure

```
src/
├── components/
│   ├── auth/          # PermissionGate (role-based rendering)
│   ├── layout/        # AppLayout, Navbar, Sidebar, ProtectedRoute
│   ├── shared/        # StatCard, ContentCard, FilterTabs, ListPagination, ...
│   └── ui/            # Base primitives: Button, Input, Label, Badge
├── hooks/
│   ├── useAuth.tsx    # Auth context: login, logout, token refresh
│   └── useAutoRefresh.ts
├── lib/
│   ├── api-client.ts  # Fetch wrapper with JWT injection and auto-refresh
│   └── utils.ts       # cn(), formatRWF(), formatDelta()
├── pages/             # One file per route (23 pages)
├── services/
│   ├── api/           # Domain-split API layer (see below)
│   └── mock/          # Mock data for settings and dev fallbacks
└── types/             # TypeScript interfaces for all data shapes
```

### API Service Layer

`services/api/` is split by domain — each file owns one area of the backend:

| File | Responsibility |
|---|---|
| `auth.ts` | Login, profile fetch, password change |
| `dashboard.ts` | KPI stats, weekly chart, activity feed, district breakdown |
| `map.ts` | Live guardian positions, site locations, live job counts |
| `analytics.ts` | Period summaries, guardian performance, job types, response trend |
| `assignments.ts` | Job listing, detail, dispatch/complete/cancel |
| `guardians.ts` | Roster, profile, create, update, certifications, document upload |
| `billing.ts` | Invoices, revenue chart, EBM compliance, issue/void |
| `clients.ts` | Organization listing, detail, admin lookup |
| `verifications.ts` | Org and guardian verification approval/rejection |
| `notifications.ts` | Notification feed, mark read |
| `incidents.ts` | Field incident listing |
| `audit.ts` | Audit log |
| `settings.ts` | App settings (currently mock) |

All modules re-export through `services/api/index.ts`, so imports remain `@/services/api`.

---

## Pages

| Route | Page |
|---|---|
| `/login` | Phone + password authentication |
| `/dashboard` | KPIs, weekly bar chart, activity feed, district stats |
| `/map` | Live map — guardian positions and client sites (ArcGIS) |
| `/assignments` | Job list with status filters, search, export |
| `/assignments/:id` | Job detail: personnel, timeline, dispatch/complete/cancel |
| `/guardians` | Guardian roster with filters, search, delete |
| `/guardians/new` | Register a new guardian |
| `/guardians/:id` | Guardian profile: certs, recent jobs, metrics |
| `/guardians/:id/edit` | Edit guardian profile |
| `/guardians/:id/onboard` | Guided onboarding flow |
| `/analytics` | Period-based analytics: job types, districts, response trend, PDF export |
| `/billing` | Invoice management, revenue chart, EBM compliance |
| `/billing/:id` | Invoice detail with payments and EBM receipt |
| `/clients` | Client organization list with filters |
| `/clients/:id` | Client detail: contacts, jobs, invoices, locations |
| `/verifications` | Pending org and guardian verification queue |
| `/incidents` | Field incident list with severity/type filters |
| `/audit` | Admin audit log |
| `/notifications` | User notification center |
| `/profile` | Current user info, password change |
| `/settings` | Application settings |

---

## Auth

- JWT stored in `localStorage` (`g2sentry_token`, `g2sentry_refresh_token`)
- 401 responses automatically trigger a token refresh and retry the original request
- All routes except `/login` are protected via `ProtectedRoute`
- Permission-gated UI via `PermissionGate` using the `permissions[]` array on the user profile

---

## Currency & Locale

All monetary values are Rwandan Francs (RWF). Use `formatRWF(amount)` from `lib/utils.ts` which abbreviates to `M` (millions) or `k` (thousands) with locale-appropriate separators.
