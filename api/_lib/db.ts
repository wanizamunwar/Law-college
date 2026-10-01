/**
 * Postgres access for the API functions.
 *
 * Every query goes through Neon's HTTP driver, so there is no connection to
 * hold open and no TCP socket to exhaust on a serverless instance.
 */

import { neon } from '@neondatabase/serverless'
import { HttpError } from './http.ts'
import type {
  Application,
  CollegeProfile,
  DocumentMeta,
  DocumentSet,
  Gender,
  Program,
  Student,
} from './types.ts'
import type { Role, StaffUser } from './types.ts'

type Sql = ReturnType<typeof neon>
type Row = Record<string, unknown>

let client: Sql | null = null

export function sql(): Sql {
  if (client) return client

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // A configuration fault, not a bug: say so plainly instead of letting the
    // caller report a generic failure.
    throw new HttpError(
      503,
      'The database is not configured. Set DATABASE_URL in the environment — see .env.example.',
    )
  }

  client = neon(connectionString)
  return client
}

/**
 * Runs a statement and always hands back an array of row objects.
 *
 * The driver's own overloads return a different shape depending on the
 * statement, so every call in the API goes through this instead.
 */
export async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  const result: unknown = await sql().query(text, params as never[])
  return Array.isArray(result) ? (result as Row[]) : []
}

/* ------------------------------------------------------------------ Rows --- */

/** Keeps the SELECT lists next to the mappers that read them. */
const COLUMNS = {
  program: 'id, name, code, duration, description, admission_open, created_at, updated_at',
  application: `
    id, application_no, status, review_note,
    full_name, father_name, cnic, date_of_birth, gender, phone, email,
    previous_qualification, institution, passing_year, marks_percentage,
    program_id, session, address, documents, created_at, updated_at
  `,
  student: `
    id, student_no, application_id, name, father_name, phone, email, cnic,
    program_id, admission_date, status, created_at, updated_at
  `,
  user: 'id, username, display_name, role, active, created_at, updated_at',
} as const

export const selectPrograms = `select ${COLUMNS.program} from programs order by lower(name)`
export const selectApplications = `select ${COLUMNS.application} from applications order by created_at desc`
export const selectStudents = `select ${COLUMNS.student} from students order by lower(name)`

/* ----------------------------------------------------------------- Mappers --- */

/**
 * Reads a `timestamptz` column.
 *
 * A few statements select a subset of columns, so an absent value is expected
 * rather than exceptional — it must never throw and take a request with it.
 */
export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString()
  }
  if (typeof value === 'number') return new Date(value).toISOString()
  return new Date(0).toISOString()
}

/**
 * Formats a `date` column as YYYY-MM-DD.
 *
 * A `date` has no timezone, and the driver hands it back as a JS Date at *local*
 * midnight — so `toISOString()` would shift it a day backwards for anywhere east
 * of UTC (an applicant in Asia/Karachi would see their date of birth as the day
 * before). Local calendar getters are the only correct reading.
 */
export function dateOnly(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${month}-${day}`
  }
  return String(value).slice(0, 10)
}

/**
 * Normalises a value for a `date` column.
 *
 * `dateOnly` reads a date out of a row, and the driver hands those back as JS
 * Date objects — so a value merged from an existing row is not a string and
 * `String(value).slice(0, 10)` would yield "Wed Oct 01" rather than a date.
 * Anything that cannot be read as a real calendar date becomes null: a `date`
 * column takes null, and silently dropping an unreadable date beats failing the
 * whole save. User-supplied dates are validated before they get here, so this
 * only ever has to cope with values the database itself produced.
 */
export function toDateColumn(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  // Read a Date with local getters, for the same reason `dateOnly` does.
  if (value instanceof Date) return dateOnly(value) || null

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (trimmed === '') return null

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [year, month, day] = trimmed.slice(0, 10).split('-').map(Number)

    // JavaScript rolls 31 February over to 2 March; Postgres rejects it. Check
    // the round trip so an impossible date is caught before it reaches the wire.
    const probe = new Date(Date.UTC(year, month - 1, day))
    const real =
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day

    return real ? trimmed.slice(0, 10) : null
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : dateOnly(parsed) || null
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function mapProgram(row: Row): Program {
  return {
    id: text(row.id),
    name: text(row.name),
    code: text(row.code),
    duration: text(row.duration),
    description: text(row.description),
    admissionOpen: Boolean(row.admission_open),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

function mapDocuments(value: unknown): DocumentSet {
  const source = record(value)
  const pick = (key: keyof DocumentSet): DocumentMeta | null =>
    record(source[key]) ? (source[key] as unknown as DocumentMeta) : null

  return {
    photograph: pick('photograph'),
    cnic: pick('cnic'),
    academicCertificate: pick('academicCertificate'),
    marksSheet: pick('marksSheet'),
  }
}

export function mapApplication(row: Row): Application {
  const address = record(row.address)

  return {
    id: text(row.id),
    applicationNo: text(row.application_no),
    status: text(row.status) as Application['status'],
    reviewNote: row.review_note ? text(row.review_note) : undefined,
    personal: {
      fullName: text(row.full_name),
      fatherName: text(row.father_name),
      cnic: text(row.cnic),
      dateOfBirth: dateOnly(row.date_of_birth),
      gender: text(row.gender) as Gender | '',
      phone: text(row.phone),
      email: text(row.email),
    },
    academic: {
      previousQualification: text(row.previous_qualification),
      institution: text(row.institution),
      passingYear: text(row.passing_year),
      marksPercentage: text(row.marks_percentage),
    },
    program: {
      programId: text(row.program_id),
      session: text(row.session),
    },
    address: {
      currentAddress: text(address.currentAddress),
      permanentAddress: text(address.permanentAddress),
      city: text(address.city),
      district: text(address.district),
      province: text(address.province),
      postalCode: text(address.postalCode),
    },
    documents: mapDocuments(row.documents),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

export function mapStudent(row: Row): Student {
  return {
    id: text(row.id),
    studentNo: text(row.student_no),
    applicationId: row.application_id ? text(row.application_id) : null,
    name: text(row.name),
    fatherName: text(row.father_name),
    phone: text(row.phone),
    email: text(row.email),
    cnic: text(row.cnic),
    programId: text(row.program_id),
    admissionDate: dateOnly(row.admission_date),
    status: text(row.status) as Student['status'],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

export function mapUser(row: Row): StaffUser {
  return {
    id: text(row.id),
    username: text(row.username),
    displayName: text(row.display_name),
    role: text(row.role) as Role,
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
  }
}

/* ----------------------------------------------------------------- Reads --- */

export async function listPrograms(): Promise<Program[]> {
  const rows = await query(selectPrograms)
  return rows.map((row) => mapProgram(row as Row))
}

export async function listApplications(): Promise<Application[]> {
  const rows = await query(selectApplications)
  return rows.map((row) => mapApplication(row as Row))
}

export async function listStudents(): Promise<Student[]> {
  const rows = await query(selectStudents)
  return rows.map((row) => mapStudent(row as Row))
}

export async function loadCollege(): Promise<CollegeProfile | null> {
  const rows = await query('select college from settings where id = 1')
  const college = rows[0]?.college
  return college ? (college as CollegeProfile) : null
}

export async function saveCollege(college: CollegeProfile): Promise<CollegeProfile> {
  const rows = await query(
    `insert into settings (id, college, updated_at)
     values (1, $1, now())
     on conflict (id) do update set college = excluded.college, updated_at = now()
     returning college`,
    [JSON.stringify(college)],
  )
  return (rows[0]?.college as CollegeProfile) ?? college
}

/* ------------------------------------------------------------ Sequences --- */

/**
 * Increments the counter for a prefix/year and returns the new value.
 *
 * The upsert is one statement, so two admissions submitted in the same
 * moment still receive different numbers.
 */
export async function nextSequenceValue(prefix: string, year: string): Promise<number> {
  const rows = await query(
    `insert into id_sequences (prefix, year, next_value)
     values ($1, $2, 1)
     on conflict (prefix, year) do update set next_value = id_sequences.next_value + 1
     returning next_value`,
    [prefix, year],
  )
  return Number(rows[0].next_value)
}

export function formatSequentialId(prefix: string, year: string, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(4, '0')}`
}

export function currentSessionYear(): string {
  return String(new Date().getFullYear())
}
