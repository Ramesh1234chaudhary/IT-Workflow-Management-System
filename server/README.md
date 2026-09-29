# IT Workflow Management — API

Express + MongoDB backend for the IT Workflow Management System. Written in
TypeScript with `strict` mode enabled.

## Stack

Node.js, Express, MongoDB via Mongoose, JWT, httpOnly refresh cookies, Joi
validation, Helmet, Multer, express-rate-limit, TypeScript (strict).

## Requirements

- Node.js 18.18 or newer (20+ recommended)
- A running MongoDB instance, local or remote

## Setup

```bash
npm install
cp .env.example .env
```

MongoDB defaults to `mongodb://127.0.0.1:27017/it_workflow_management`.

## Run

```bash
npm run seed     # permissions, roles, users, SOP v1, demo projects
npm run dev      # API on http://localhost:4000
```

The API is served under `/api`; `GET /api` returns an endpoint index. The UI runs
separately on port 5173 — see `../client/README.md`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Watch mode via `tsx` |
| `npm start` | Run the server without watching |
| `npm run seed` | Reset demo data (destructive) |
| `npm run verify` | 92-check end-to-end suite against a running API |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

Copy `.env.example` to `.env`. Every variable is listed in `.env.example`; the
table below documents what each one does.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Runtime mode. `production` enables the strict config guard. |
| `PORT` | `4000` | API port. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/it_workflow_management` | MongoDB connection string. **Include the database name** — see below. |
| `JWT_ACCESS_SECRET` | dev fallback | Access token signing secret. Required, min 32 chars, in production. |
| `JWT_REFRESH_SECRET` | dev fallback | Refresh token signing secret. Must differ from the access secret. |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime for the signed JWT. |
| `ACCESS_TOKEN_EXPIRES_MINUTES` | `15` | Access token lifetime in minutes, used for the client cache. |
| `REFRESH_TOKEN_TTL` | `7d` | Refresh token lifetime for the signed JWT. |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Refresh token lifetime in days, stored on the token record. |
| `CLIENT_URL` | `http://localhost:5173` | Comma-separated allowed browser origins. |
| `REFRESH_COOKIE_NAME` | `wf_refresh_token` | Name of the httpOnly refresh cookie. |
| `REFRESH_COOKIE_PATH` | `/api/auth` | Cookie path, scoped to the auth routes. |
| `REFRESH_COOKIE_SAMESITE` | `lax` dev / `none` prod | `none` when the API and SPA are on different sites. |
| `REFRESH_COOKIE_SECURE` | `true` in production | Requires HTTPS. |
| `COOKIE_DOMAIN` | unset | Explicit cookie domain when the API sits behind a proxy. |
| `BCRYPT_SALT_ROUNDS` | `10` | Password hashing cost. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Auth rate-limit window. |
| `AUTH_RATE_LIMIT_MAX` | `20` | Max auth attempts per window per IP. |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` | Global API rate-limit window. |
| `API_RATE_LIMIT_MAX` | `500` | Max API requests per window per IP. |
| `TRUST_PROXY` | `true` in production | Trust `X-Forwarded-For` so `req.ip` is the real client. |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded documents. |
| `MAX_UPLOAD_SIZE_MB` | `10` | Per-file upload ceiling. |
| `OPENPROJECT_BASE_URL` | unset | Phase 2 integration: OpenProject instance URL. |
| `OPENPROJECT_API_TOKEN` | unset | Phase 2 integration: OpenProject API token. |
| `TIMESHEET_BASE_URL` | unset | Phase 2 integration: Timesheet service URL. |
| `TIMESHEET_API_TOKEN` | unset | Phase 2 integration: Timesheet API token. |
| `INTEGRATIONS_ENABLED` | `false` | Master switch for the Phase 2 integrations. |

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` fall back to fixed throwaway values
in development so a fresh clone runs with `npm install && npm run dev` and no
`.env` at all. In production the process exits if they are missing, too short, or
identical.

### Database choice

MongoDB via Mongoose, reached over a replica-set connection string
(`mongodb+srv://…` for Atlas, or a local `mongodb://127.0.0.1:27017/…`).

MongoDB fits this problem because the domain is document-shaped — SOP templates
with nested stage definitions, workflow stages with their own history, and an
audit log that is written and read far more often than it is queried relationally.
Stage generation on project creation is a bulk insert, and the client filter
rewrites nested response documents, both of which map directly onto documents.

**Always put the database name in the URI.** A connection string that ends at the
host — `mongodb+srv://user:pass@cluster0.example.mongodb.net/` — leaves the
database unset, and the driver then silently uses the default database `test`.
On a shared Atlas cluster that is another tenant's database, and `npm run seed`
clears collections by name, so it will wipe their data. Use an explicit name:

```
mongodb+srv://user:pass@cluster0.example.mongodb.net/it_workflow_management
```

### CORS

`CLIENT_URL` is the authoritative allow-list. Outside production the API also
accepts any loopback origin (`localhost`, `127.0.0.1`, `[::1]`) on any port,
because Vite silently shifts to 5174, 5175 and so on when 5173 is occupied —
without this the browser reports a CORS failure that looks like an outage.
Production honours `CLIENT_URL` only.

## Endpoints

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
CRUD   /api/users
PATCH  /api/users/:id/deactivate
POST   /api/users/:id/reassign
CRUD   /api/roles
GET    /api/roles/permissions
CRUD   /api/sop
POST   /api/sop/:id/publish
PATCH  /api/sop/:id/stages/reorder
CRUD   /api/projects
GET    /api/projects/:projectId/stages
PATCH  /api/projects/:projectId/stages/:stageId/status
GET    /api/workflow/board
GET    /api/audit
GET    /api/reports/*
```

## Security model

**Authorisation is database driven.** Roles hold `module:action` permission keys;
`/api/roles/permissions` returns the full catalogue of 41 permissions. Hiding an
element in the browser is never treated as a control.

**Tokens.** The access token (15 min) is returned in the response body and held
in memory by the client. The refresh token is an httpOnly cookie that JavaScript
cannot read. Refresh tokens rotate on every use, and reuse of an already-rotated
token revokes the whole token family.

**Client data filtering is server side.** `filterClientData` strips internal-only
stages, documents, remarks, blockers and the `clientVisible` flag from every
response sent to a client-scoped account, and the `/api/audit` router rejects
those accounts outright with `403`.

**Status changes are always manual.** Only
`PATCH /api/projects/:id/stages/:stageId/status` moves a stage. Uploading a
document or adding a remark never changes status. The API enforces the
conditional fields (`blocked` requires a blocker, `on hold` a reason, `completed`
a completion date), and transitions respect stage dependencies.

**Audit trail.** The collection is append-only; the router exposes no write
endpoint. Entries record the actor, entity, action, old and new values, and IP.

**Input safety.** Every request is validated against a Joi whitelist before it
reaches a query. Mongo filters are built through `safeFilter`, which escapes
user-supplied values before treating them as patterns, so operator injection such
as `?name[$ne]=x` is rejected rather than executed.

## Verification

```bash
npm run dev        # the suite calls a running API
npm run verify
```

`scripts/verify.js` runs 92 end-to-end checks covering authentication,
refresh-token rotation and reuse detection, RBAC, client-data filtering, SOP
versioning, stage generation, status dependencies and history, documents, user
deactivation and reassignment, reports, and NoSQL-injection protection.

The suite mutates data, so it re-seeds the database before running and is safe to
repeat. Set `SKIP_RESET=true` to skip the reseed. Current status: **92 passed,
0 failed**.

## Layout

```
src/
  config/         env, db, logger, jwt
  controllers/    request handlers, one per resource
  middlewares/    auth, rbac, client filtering, validation, errors, uploads
  models/         Mongoose schemas
  routes/         Express routers
  services/       business logic, audit, integrations
  types/          domain and model interfaces
  utils/          constants, ApiError, serializers, sanitisation
seed/seed.ts      deterministic demo data
scripts/verify.js 92-check end-to-end suite
```

## Deployment

- The API is stateless apart from MongoDB, so it scales horizontally. Refresh
  tokens live in the database, so a restart does not sign anyone out.
- Set `REFRESH_COOKIE_SAMESITE=none` and `REFRESH_COOKIE_SECURE=true` when the
  client and API are on different sites, and add the client origin to `CLIENT_URL`.
- Serve the API over HTTPS; `secure` cookies require it.
