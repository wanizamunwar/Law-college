# Law College Management System

A professional administration portal for a law college. Covers admissions, the
student register, programmes, the institutional profile and its location.

Built with React, TypeScript and Vite, backed by PostgreSQL on
[Neon](https://neon.tech) through serverless API functions. Records, uploaded
documents and staff accounts live in the database, so the portal works from any
device and survives clearing browser data.

## Setup

### 1. Create the database

Sign up for Neon and create a project. Neon gives you a pooled connection string
immediately — copy it from **Connection Details** and keep it handy.

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Fill in `DATABASE_URL` with the string Neon gave you, and set `SESSION_SECRET` to
a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`DATABASE_URL` must never be exposed to the browser. Only `SESSION_SECRET` and
`DATABASE_URL` are read, and both stay in the serverless functions — never prefix
them with `VITE_`.

### 3. Create the tables

```bash
npm install
npm run db:migrate
```

This applies `db/schema.sql` and creates the first administrator. Every statement
is guarded, so re-running it is safe.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:5173 and sign in as `admin`. `npm run db:migrate` prints the
password it created — copy it out then, because only its hash is stored. If
`ADMIN_PASSWORD` was set in `.env.local` the password is that value instead.
**Change this password immediately** from **Settings → My Account**.

The dev server mounts the same API handler that Vercel runs, so `npm run dev`
talks to the real database without the Vercel CLI. Edits under `api/` are picked
up on the next request, so changing a route does not need a restart.

`npm run preview` mounts that handler too. Without it `vite preview` serves only
`dist/`, every `/api` request returns a bare 404, and the sign-in form fails with
`Request failed (404).` — the API produces a JSON error body, so a 404 with no
message means nothing is serving the routes.

### Other scripts

```bash
npm run build              # type-check and build for production
npm run preview            # serve the production build locally, API included
npm run db:migrate         # apply schema.sql and seed the first administrator
npm run db:reset-password  # set a new password for an existing staff account
```

### Forgotten password

`npm run db:migrate` never touches an account that already exists, so it cannot
recover a lost password. Use the reset script instead:

```bash
npm run db:reset-password                          # admin, or ADMIN_USERNAME
npm run db:reset-password -- --username registrar1 # any other account
```

The password comes from the `ADMIN_PASSWORD` environment variable — set it in
`.env.local`, or for a single run:

```bash
ADMIN_PASSWORD="the-new-password" npm run db:reset-password   # macOS / Linux
$env:ADMIN_PASSWORD = "the-new-password"; npm run db:reset-password  # PowerShell
```

With neither set, a strong password is generated and printed once.

It is deliberately not accepted as a command-line flag, because a flag is kept
in shell history and is readable by every other process on the machine. The
value is hashed with the same scrypt scheme as every other credential, written
to that one account only, and read back and verified before the script reports
success. No account is created or deleted, no role or access level changes, and
the schema is untouched.

Signing in still needs `DATABASE_URL`, so run this on a machine that has it —
the same one as `npm run db:migrate`.

## Pages

| Page                   | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| **Login**              | Credential sign-in for a staff account.                            |
| **Dashboard**          | Student, application and programme counts, plus recent submissions. |
| **Admissions**         | Application register with search, filters, and approve/reject.      |
| **Application form**   | Four-section guided form with validation and document uploads.      |
| **Students**           | The official student register with full CRUD.                        |
| **Programs**           | Programme management — add, edit, delete. Not hard-coded.            |
| **College Information** | Institution profile, logo and office hours.                          |
| **College Location**   | Address, coordinates, embedded map and directions.                   |
| **Settings**           | Your account, staff access, backup and database management.          |

## Staff accounts and roles

Every person who signs in has a database-backed account. The first one is created
by `npm run db:migrate`; administrators add and change the rest from
**Settings → Staff**.

| Role          | Access                                                                |
| ------------- | --------------------------------------------------------------------- |
| `admin`       | Everything, including staff accounts and clearing the database.        |
| `registrar`   | Full read/write on all academic records.                              |
| `viewer`      | Read-only. Mutating controls are hidden rather than shown and failing. |

Passwords are stored as scrypt hashes — nobody, including an administrator, can
read one back. There is no default password in this repository: the first
account gets a generated one, and a lost credential is replaced with
`npm run db:reset-password`. Sessions are HMAC-signed tokens that expire after
eight hours, and the account is re-checked on every request, so deactivating
someone takes effect immediately rather than when their token lapses.

The last active administrator cannot be deleted, demoted or disabled, and nobody
can delete the account they are signed in with.

## How it works

**Programs are not hard-coded.** Start with an empty programme list and add your
own from the Programs page. An application cannot be submitted until at least one
programme exists.

**Application IDs** are generated by the database in the format `LCM-2026-0001`,
and student IDs as `STU-2026-0001`. The counter lives in Postgres, so two
submissions at the same moment cannot collide and numbering resumes after a
deletion.

**Approving an application does not create a student automatically.** Once
approved, the application row gains an enrol action that generates the student
record with the applicant's details pre-filled. This keeps the decision and the
enrolment as two explicit, auditable steps, and a unique index makes a
double-click unable to enrol the same applicant twice.

**Documents** — photograph, CNIC copy, academic certificate and marks sheet. The
photograph is required; the rest are optional. File bytes are stored in a
`bytea` column and served back through the API, so they open and download for
real. The limit is 3 MB per file, which keeps requests inside Vercel's 4.5 MB
body ceiling.

**Validation** covers CNIC format, Pakistani mobile numbers, email, postal code,
percentage range, passing year limits, a 16-year minimum age, and coordinate
ranges. Errors appear inline beneath each field and are summarised at the top of
the form on a failed submit.

## Moving data in

**Settings → Data** covers everything:

- **Import from this browser** — one-time migration of records left by the
  earlier localStorage version, including documents from IndexedDB. Matching is
  by ID, so re-running updates rather than duplicates, and the browser copy is
  cleared once the import succeeds.
- **Export / import backup** — JSON of programmes, applications, students and the
  college profile. Uploaded files are not included in the export.
- **Load sample data** — a demonstration set for reviewing the tables, filters
  and dashboard. Merged with existing records, not a replacement.
- **Clear all data** — administrator only. Removes all academic records and
  documents; staff accounts are kept.

## Project structure

```
api/                      One file per Vercel route; each re-exports the handler
├── health.ts             -> /api/health
├── auth/login.ts         -> /api/auth/login
├── applications/[id]/status.ts  -> /api/applications/:id/status
└── _lib/                 db, auth, routing, route handlers
server/handler.ts         The API handler itself, shared by dev and Vercel
db/schema.sql             Authoritative table definitions
scripts/                  Migration, password reset, hashing and env loading
src/
├── components/
│   ├── applications/   Application detail view
│   ├── layout/         Sidebar, top bar, app shell
│   └── ui/             Button, form, card, modal, toast, upload primitives
├── lib/                API client, validation, formatting, demo data
├── pages/              One file per route
├── store/              Central state and all write operations
├── styles/index.css    Design tokens and all component styles
└── types/              Domain types
```

Write operations live in `src/store/StoreContext.tsx`; pages read state and call
actions. Field rules sit beside the form that uses them, not in a separate
schema.

## Deploying to Vercel

Push the repository and import it into Vercel — the framework preset is detected
automatically. Then add two environment variables under **Settings →
Environment Variables** for each environment:

| Variable          | Value                                     |
| ----------------- | ----------------------------------------- |
| `DATABASE_URL`    | The Neon connection string                |
| `SESSION_SECRET`  | The same value used locally, 32+ chars    |

`SESSION_SECRET` signs the session tokens. The API refuses to start without it
under Vercel, where there is no `.env.local` to fall back to. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Run `npm run db:migrate` once from a machine with the same `DATABASE_URL` before
your first deploy, or paste `db/schema.sql` into the Neon SQL editor.

`vercel.json` routes everything except `/api/*` to the SPA, so client-side routes
such as `/admissions` survive a page reload.

### How the API routes are laid out

Vercel maps **one file per route** out of `api/`, by path:

```
api/health.ts                    ->  /api/health
api/auth/login.ts                ->  /api/auth/login
api/applications/[id]/status.ts  ->  /api/applications/:id/status
```

Each file is three lines and re-exports the single handler in `server/handler.ts`.
Vercel decides which file a URL belongs to; the handler then matches the method,
so a request that reaches the wrong file still gets the API's JSON 404 rather
than the platform's bare one. Adding a route means adding a file.

**There is no `api/[...path].ts` catch-all, deliberately.** A catch-all in the
`api/` directory matches only a *single* path segment on Vercel, so every
multi-segment route — `POST /api/auth/login` included — returns a bare 404 and
the sign-in form fails with `Request failed (404).` The same catch-all works
perfectly under the Vite dev server, which is why the breakage was invisible
until the first deployment. The handler lives in `server/` instead, outside the
directory Vercel scans for functions.

If you ever see a bodiless 404 from `/api/...`, compare it against
`npm run preview` and `/api/health` — `Request failed (404).` with no server
message means the platform answered, not the API.

Deploying from the command line:

```bash
npm install --global vercel
vercel login
vercel link
vercel env add DATABASE_URL production   # paste the Neon connection string
vercel env add SESSION_SECRET production # paste the generated secret
vercel --prod
```

If you have not yet imported your existing records, run **Settings → Data →
"Import from this browser"** once, from a browser that still holds them — the
import is a one-way copy into Postgres, after which the app no longer reads
browser storage.

## Design

A restrained institutional palette — ink navy, parchment, brass — with serif
display headings. No gradients, glassmorphism or neon. Small corner radii, thin
borders, subtle shadows, one accent colour reserved for the primary action.

Responsive down to mobile, where the sidebar collapses to a drawer and tables
scroll horizontally. Application records have a print stylesheet.
`prefers-reduced-motion` is respected.

## Browser support

Current Chrome, Edge, Firefox and Safari. Document upload needs `File` and
`fetch` with a `Blob` body, which all current browsers support.
