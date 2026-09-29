# IT Workflow Management System

Two separate applications in one repository:

| Folder | What it is | Runs on |
| --- | --- | --- |
| `server/` | Backend API (Node.js, Express, MongoDB) | `http://localhost:4000` |
| `client/` | Frontend UI (React, Vite) | `http://localhost:5173` |

Each has its own `package.json` and runs in its own terminal.

---

## Requirements

**Node.js 20 LTS or 22 LTS** (recommended). Minimum 18.18.

Check with:

```bash
node -v
```

You also need a MongoDB database — either a local MongoDB or a free
[MongoDB Atlas](https://www.mongodb.com/atlas/register) cluster. The
connection string goes in `server/.env` as `MONGODB_URI`, and it must end
with the database name:

```
mongodb+srv://user:pass@cluster0.example.mongodb.net/it_workflow_management
```

Both local and Atlas formats are shown in `server/.env.example`.

---

## Terminal 1 — Backend

```bash
cd server
npm install
```

Copy the environment file and set your database connection string and two
JWT secrets:

```bash
cp .env.example .env
```

Open `server/.env` and set at least these three:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster0.example.mongodb.net/it_workflow_management
JWT_ACCESS_SECRET=some-long-random-string-at-least-32-characters
JWT_REFRESH_SECRET=a-different-long-random-string
```

Every variable is listed and explained in `server/.env.example`. If you skip
this step the server will not connect to a database or will refuse to start.

### Run the seed

**Run the seed before starting the backend.** It creates the roles, users,
published SOP and demo projects that the application needs. The backend will
start without it, but the app will have no users to log in with and the
frontend will show empty screens.

```bash
npm run seed
```

You should see:

```
roles: 4
users: 7
SOP template "IT Project Delivery SOP" published as v1 (5 stages)
projects: 3 (with auto-generated workflow stages)
```

> The seed clears the collections it owns before rebuilding them, so do not
> run it against a database that holds data you need to keep.

### Start the backend

```bash
npm run dev
```

The API is now running on `http://localhost:4000`. Leave this terminal open.

---

## Terminal 2 — Frontend

In a second terminal:

```bash
cd client
npm install
```

```bash
cp .env.example .env
```

The default in `client/.env` already points at `http://localhost:4000/api`,
which is where the backend runs, so no change is needed for local use.

### Start the frontend

```bash
npm run dev
```

Open **<http://localhost:5173>** in your browser.

If port 5173 is already in use, Vite moves to 5174 and prints the new address.
Use whichever one it shows.

---

## Demo accounts

The seed creates one user for each of the four roles:

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | `superadmin@example.com` | `SuperAdmin@123` |
| Admin | `admin@example.com` | `Admin@123` |
| IT Team Member | `itmember@example.com` | `ITMember@123` |
| Client / Operations | `client@example.com` | `Client@123` |

Sign in as any of them to see the app from that role's point of view. The
Client account is the quickest way to check access control: it can only see
its own projects and only the workflow stages marked client-visible.

---

## If something goes wrong

**Login says the account does not exist** — the seed was not run. Go to
`server/` and run `npm run seed`.

**Frontend shows CORS errors** — `CLIENT_URL` in `server/.env` must match the
address the frontend is running on, including the port.

**Frontend calls `/api/api/...`** — `VITE_API_URL` in `client/.env` has the
`/api` prefix twice. It should read `http://localhost:4000/api`.

---

More detail: [`server/README.md`](server/README.md) for the API reference, and
[`client/README.md`](client/README.md) for the UI.
