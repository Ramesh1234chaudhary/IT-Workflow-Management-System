# IT Workflow Management — Web Client

React single-page UI for the IT Workflow Management System. Written in
TypeScript with `strict` mode enabled.

## Stack

React 18, Vite, Redux Toolkit (`createAsyncThunk` + `createSelector`), React
Router v6, Material UI, Formik + Yup, Axios, notistack, TypeScript (strict).

## Requirements

- Node.js 18.18 or newer (20+ recommended)
- The API running — see `../server/README.md`

## Setup

```bash
npm install
cp .env.example .env
```

## Run

```bash
npm run dev      # UI on http://localhost:5173
```

Run the API in a second terminal (`../server`, `npm run dev`). Both must be
running together — there is no root-level task runner.

> If port 5173 is occupied Vite moves to the next free port (5174, 5175 …) and
> prints the new address in the terminal. Use the address it prints, not 5173.
> The API accepts any loopback origin in development, so the shifted port works
> without further configuration.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then produce the production bundle in `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src` (flat config, `eslint.config.js`) |
| `npm run preview` | Serve the production build on port 5173 |

Current status: typecheck and build report **0 errors**; `npm run lint` reports
**0 errors** with a handful of intentional `react-hooks/set-state-in-effect`
warnings on dialog components that reset their fields when a modal opens.

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL, **including** the `/api` prefix (default `http://localhost:4000/api`) |
| `VITE_APP_NAME` | Title shown in the app bar |

`VITE_` variables are baked in at **build** time, not read at runtime. Changing
one on a hosted platform requires a redeploy — updating the dashboard alone will
not rebuild the bundle.

Endpoint paths in `src/api/api.ts` are relative to this base URL, so
`'/auth/login'` resolves to `http://localhost:4000/api/auth/login`. Do not add
an `/api` prefix again in the endpoint map.

## Session handling

- The access token (15 min) is held **in memory only** and is never written to
  `localStorage`.
- The refresh token is an httpOnly cookie that JavaScript cannot read.
- On a page load the app calls `POST /auth/refresh` to obtain a fresh access token.
- The Axios response interceptor performs a **single-flight** refresh: parallel
  401s share one refresh call, and the original request is replayed exactly once.
  A failed refresh signs the user out.
- Auth-free paths (`/auth/login`, `/auth/refresh`, `/auth/logout`,
  `/auth/change-password`) skip both the `Authorization` header and the retry
  guard so they cannot recurse.

## Permissions

The UI never compares role names. `usePermission('sop', 'publish')` and the
`can(module, action)` helper check the permission array the API returns with the
user, and permissions are re-hydrated from the database on login and refresh.

## Demo accounts

The sign-in screen lists these accounts and fills the form on click.

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `superadmin@example.com` | `SuperAdmin@123` |
| Admin | `admin@example.com` | `Admin@123` |
| IT Team Member | `itmember@example.com` | `ITMember@123` |
| Client / Operations | `client@example.com` | `Client@123` |

## Layout

```
src/
  api/            httpClient (interceptors) and endpoint map
  app/            Redux store and typed hooks
  components/     shared UI, PermissionGate, RoleGuard, dialogs
  features/       one slice per domain
  hooks/          usePermission, useAuth, useDebounce
  pages/          one file per route
  types/          wire types shared with the API
  utils/          constants, formatters, memoised selectors
```

## Deployment

- `npm run build` emits a static bundle in `dist/`. Host it on any static
  provider and point a SPA-capable host at the output so client-side routes
  fall back to `index.html`.
- When the client and API are on different sites, set `REFRESH_COOKIE_SAMESITE=none`
  and `REFRESH_COOKIE_SECURE=true` on the API and add the deployed client origin
  to its `CLIENT_URL`.
