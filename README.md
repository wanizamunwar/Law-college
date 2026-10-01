# Law College Management System

A professional administration portal for a law college. Covers admissions, the
student register, programmes, the institutional profile and its location.

Built with React, TypeScript and Vite. Runs entirely in the browser — no server,
no API keys, no external services required.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with:

| Username | Password   |
| -------- | ---------- |
| `admin`  | `admin123` |

Change the password from **Settings → Security** after your first sign-in.

### Other scripts

```bash
npm run build      # type-check and build for production
npm run preview    # serve the production build locally
```

## Pages

| Page                 | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| **Login**            | Credential sign-in for the registrar account.                      |
| **Dashboard**         | Student, application and programme counts, plus recent submissions. |
| **Admissions**        | Application register with search, filters, and approve/reject.      |
| **Application form**  | Four-section guided form with validation and document uploads.     |
| **Students**          | The official student register with full CRUD.                        |
| **Programs**          | Programme management — add, edit, delete. Not hard-coded.            |
| **College Information** | Institution profile, logo and office hours.                       |
| **College Location**  | Address, coordinates, embedded map and directions.                   |
| **Settings**          | Administrator profile, password, backup and local data management.  |

## How it works

**Programs are not hard-coded.** Start with an empty programme list and add your
own from the Programs page. An application cannot be submitted until at least one
programme exists.

**Application IDs** are generated on submit in the format `LCM-2026-0001`, and
student IDs as `STU-2026-0001`. Numbering is sequential and resumes automatically
after deleting a record.

**Approving an application does not create a student automatically.** Once
approved, the application row gains an enrol action that generates the student
record with the applicant's details pre-filled. This keeps the decision and the
enrolment as two explicit, auditable steps.

**Documents** — photograph, CNIC copy, academic certificate and marks sheet. The
photograph is required; the rest are optional. Files are stored as blobs in
IndexedDB, so they open and download for real rather than as placeholders.

**Validation** covers CNIC format, Pakistani mobile numbers, email, postal code,
percentage range, marks sheet year limits, a 16-year minimum age, and coordinate
ranges. Errors appear inline beneath each field and are summarised at the top of
the form on a failed submit.

## Storage

Records live in `localStorage`; documents live in `IndexedDB`. Everything is local
to the browser — clearing site data removes all records.

**Settings → Data & Storage** offers a JSON export and import (merged by ID, so
re-importing will not duplicate records), a sample-data loader for reviewing the
interface with realistic content, and a full reset.

## Sample data

New installs start empty by design. To review the tables, filters and dashboard
with content, use **Settings → Data & Storage → Load sample data**, which
installs four programmes, eight applications across all three statuses, and three
enrolled students.

## Project structure

```
src/
├── components/
│   ├── applications/   Application detail view
│   ├── layout/         Sidebar, top bar, app shell
│   └── ui/             Button, form, card, modal, toast, upload primitives
├── lib/                Storage, validation, repository, formatting, demo data
├── pages/              One file per route
├── store/              Central state and all write operations
├── styles/index.css    Design tokens and all component styles
└── types/              Domain types
```

Write operations live in `src/store/StoreContext.tsx`; pages read state and call
actions. Field rules sit beside the form that uses them, not in a separate schema.

## Design

A restrained institutional palette — ink navy, parchment, brass — with serif
display headings. No gradients, glassmorphism or neon. Small corner radii, thin
borders, subtle shadows, one accent colour reserved for the primary action.

Responsive down to mobile, where the sidebar collapses to a drawer and tables
scroll horizontally. Application records have a print stylesheet. `prefers-reduced-motion`
is respected.

## Browser support

Current Chrome, Edge, Firefox and Safari. Requires IndexedDB for document uploads;
when unavailable, the record still saves and the file is reported as unavailable.