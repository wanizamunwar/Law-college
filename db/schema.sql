-- Law College Management System — PostgreSQL schema
-- Target: Neon (serverless Postgres).
--
-- Run once with:  npm run db:migrate
-- Safe to re-run — every statement is guarded.

-- ---------------------------------------------------------------- users ----

CREATE TABLE IF NOT EXISTS staff_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  -- admin     : manages staff accounts and everything else
  -- registrar : full read/write on all records
  -- viewer    : read-only
  role          text NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin', 'registrar', 'viewer')),
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------- programs ----

CREATE TABLE IF NOT EXISTS programs (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  code           text NOT NULL UNIQUE,
  duration       text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  admission_open boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programs_name_idx ON programs (lower(name));

-- ---------------------------------------------------------- applications ----

CREATE TABLE IF NOT EXISTS applications (
  id                    text PRIMARY KEY,
  -- Human-facing reference, e.g. LCM-2026-0001
  application_no        text NOT NULL UNIQUE,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note           text,

  -- Personal information
  full_name             text NOT NULL DEFAULT '',
  father_name           text NOT NULL DEFAULT '',
  cnic                  text NOT NULL DEFAULT '',
  date_of_birth         date,
  gender                text NOT NULL DEFAULT '' CHECK (gender IN ('male', 'female', 'other', '')),
  phone                 text NOT NULL DEFAULT '',
  email                 text NOT NULL DEFAULT '',

  -- Academic information
  previous_qualification text NOT NULL DEFAULT '',
  institution           text NOT NULL DEFAULT '',
  passing_year          text NOT NULL DEFAULT '',
  marks_percentage      text NOT NULL DEFAULT '',

  -- Programme selection
  program_id            text REFERENCES programs (id) ON DELETE SET NULL,
  session               text NOT NULL DEFAULT '',

  -- Address block is read and written as a unit, so it stays together.
  address               jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Document *metadata* only; the bytes live in application_documents.
  documents             jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applications_status_idx  ON applications (status);
CREATE INDEX IF NOT EXISTS applications_no_idx      ON applications (application_no);
CREATE INDEX IF NOT EXISTS applications_created_idx ON applications (created_at DESC);
CREATE INDEX IF NOT EXISTS applications_name_idx    ON applications (lower(full_name));
CREATE INDEX IF NOT EXISTS applications_program_idx ON applications (program_id);

-- -------------------------------------------------------------- students ----

CREATE TABLE IF NOT EXISTS students (
  id             text PRIMARY KEY,
  -- Human-facing reference, e.g. STU-2026-0001
  student_no     text NOT NULL UNIQUE,
  -- Set when the student was enrolled from an approved application. The
  -- application is kept, so the link uses ON DELETE SET NULL.
  application_id text REFERENCES applications (id) ON DELETE SET NULL,
  name           text NOT NULL,
  father_name    text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  cnic           text NOT NULL DEFAULT '',
  program_id     text REFERENCES programs (id) ON DELETE SET NULL,
  admission_date date,
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive', 'graduated', 'on-leave')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS students_no_idx      ON students (student_no);
CREATE INDEX IF NOT EXISTS students_name_idx    ON students (lower(name));
CREATE INDEX IF NOT EXISTS students_program_idx ON students (program_id);
CREATE INDEX IF NOT EXISTS students_status_idx  ON students (status);

-- One enrolment per application. Enforcing this in the database means a
-- double-click on "Enrol" cannot create two student records.
CREATE UNIQUE INDEX IF NOT EXISTS students_application_uniq
  ON students (application_id)
  WHERE application_id IS NOT NULL;

-- ------------------------------------------------------------- documents ----

CREATE TABLE IF NOT EXISTS application_documents (
  id             text PRIMARY KEY,
  application_id text NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  label          text NOT NULL
                   CHECK (label IN ('photograph', 'cnic', 'academicCertificate', 'marksSheet')),
  file_name      text NOT NULL,
  mime_type      text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes     integer NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  content        bytea NOT NULL,
  uploaded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_application_idx
  ON application_documents (application_id);

-- -------------------------------------------------------------- settings ----

CREATE TABLE IF NOT EXISTS settings (
  id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  college       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- sequences ----

-- Backs the human-readable IDs. The upsert in the API increments and returns
-- the value in one round trip, so two concurrent submissions cannot collide.
CREATE TABLE IF NOT EXISTS id_sequences (
  prefix     text NOT NULL,
  year       text NOT NULL,
  next_value integer NOT NULL DEFAULT 1,
  PRIMARY KEY (prefix, year)
);
