/**
 * API route handlers.
 *
 * Every mutating route is declared with the access level it needs:
 *
 *   public     no session required
 *   signed-in  any active staff account
 *   write      registrar or admin
 *   admin      admin only (staff management)
 */

import {
  badRequest,
  conflict,
  HttpError,
  notFound,
  requireFields,
  sendBuffer,
  sendJson,
  asBoolean,
  asString,
} from './http'
import type { Handler } from './http'
import {
  currentSessionYear,
  dateOnly,
  iso,
  listApplications,
  listPrograms,
  listStudents,
  loadCollege,
  mapApplication,
  mapProgram,
  mapStudent,
  mapUser,
  query,
  saveCollege,
  toDateColumn,
} from './db'
import {
  findUserByUsername,
  hashPassword,
  issueToken,
  listUsers,
  verifyPassword,
} from './auth'
import { DEFAULT_COLLEGE } from './defaults'
import type {
  Application,
  ApplicationStatus,
  CollegeProfile,
  DocumentMeta,
  ImportPayload,
  Program,
  Role,
  SessionUser,
  StaffUser,
  Student,
} from './types'

/** Keeps Vercel's request body within its 4.5 MB ceiling. */
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024

const DOCUMENT_LABELS: DocumentMeta['label'][] = [
  'photograph',
  'cnic',
  'academicCertificate',
  'marksSheet',
]

/* --------------------------------------------------------------- helpers --- */

function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'registrar' || value === 'viewer'
}

/**
 * Merges an incoming patch over the stored row.
 *
 * A PATCH only carries what changed, so a partial update must not blank out
 * the columns it leaves out.
 */
function buildUpdate(id: string, existing: Record<string, unknown>, patch: Record<string, unknown>) {
  const pick = (key: string, column: string) =>
    Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : existing[column]

  return {
    id,
    name: asString(pick('name', 'name')),
    code: asString(pick('code', 'code')).toUpperCase(),
    duration: asString(pick('duration', 'duration')),
    description: asString(pick('description', 'description')),
    admissionOpen: asBoolean(pick('admissionOpen', 'admission_open'), Boolean(existing.admission_open)),
  }
}

/**
 * Flattens an application into its columns.
 *
 * Every text column below is `NOT NULL`, so a field missing from a partial
 * update or a legacy import has to become `''` rather than `null` — the browser
 * data being imported is often incomplete. Only the columns that are genuinely
 * nullable (a date, a programme reference) may be `null`.
 */
function applicationColumns(source: {
  personal: Application['personal']
  academic: Application['academic']
  program: Application['program']
  address: Application['address']
}) {
  return {
    full_name: asString(source.personal.fullName),
    father_name: asString(source.personal.fatherName),
    cnic: asString(source.personal.cnic),
    date_of_birth: toDateColumn(source.personal.dateOfBirth),
    gender: asString(source.personal.gender),
    phone: asString(source.personal.phone),
    email: asString(source.personal.email),
    previous_qualification: asString(source.academic.previousQualification),
    institution: asString(source.academic.institution),
    passing_year: asString(source.academic.passingYear),
    marks_percentage: asString(source.academic.marksPercentage),
    program_id: asString(source.program.programId) || null,
    session: asString(source.program.session),
    address: JSON.stringify(source.address ?? {}),
  }
}

/** Same rule as `applicationColumns`: `''` for `NOT NULL` text, `null` only where allowed. */
function studentFields(source: {
  name: string
  fatherName: string
  phone: string
  email: string
  cnic: string
  programId: string
  admissionDate: string | null
  status: Student['status']
}) {
  return {
    name: asString(source.name),
    father_name: asString(source.fatherName),
    phone: asString(source.phone),
    email: asString(source.email),
    cnic: asString(source.cnic),
    program_id: asString(source.programId) || null,
    admission_date: toDateColumn(source.admissionDate),
    status: isStudentStatus(source.status) ? source.status : 'active',
  }
}

function isStudentStatus(value: unknown): value is Student['status'] {
  return value === 'active' || value === 'inactive' || value === 'graduated' || value === 'on-leave'
}

/**
 * Validates a date the user typed.
 *
 * `toDateColumn` quietly turns an unreadable date into null, which is right for
 * a value merged out of an existing row but wrong for input — silently clearing
 * a date of birth or an admission date loses data the user can see they entered.
 * So anything supplied is checked here and rejected with a message. An empty
 * value is not an error; it becomes null, because a `date` column rejects ''.
 */
function requireDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || asString(value).trim() === '') return null

  const parsed = toDateColumn(value)
  if (parsed === null) throw badRequest(`${label} is not a valid date.`)
  return parsed
}

function requireStudentStatus(value: unknown): Student['status'] {
  if (value === undefined || value === null || value === '') return 'active'
  if (!isStudentStatus(value)) {
    throw badRequest('Status must be active, inactive, graduated or on leave.')
  }
  return value
}

function fetchOne(table: string, columns: string, id: string) {
  return query(`select ${columns} from ${table} where id = $1`, [id])
}

function randomId(): string {
  return globalThis.crypto.randomUUID()
}

/* ----------------------------------------------------------------- routes --- */

export const routes: Array<{
  method: string
  path: string[]
  access: 'public' | 'signed-in' | 'write' | 'admin'
  handler: Handler
}> = [
  /* ------------------------------ health ------------------------------ */
  {
    method: 'GET',
    path: ['health'],
    access: 'public',
    handler: async ({ res }) => {
      const rows = await query('select 1 as ok')
      sendJson(res, 200, { ok: rows[0]?.ok === 1, database: 'connected' })
    },
  },

  /* ------------------------------- auth ------------------------------- */
  {
    method: 'POST',
    path: ['auth', 'login'],
    access: 'public',
    handler: async ({ res, json }) => {
      const body = await json<{ username?: string; password?: string }>()
      const username = asString(body.username).trim()
      const password = asString(body.password)

      if (!username || !password) {
        throw badRequest('Enter both your username and password.')
      }

      const row = await findUserByUsername(username)

      // Same message whether the account is missing or the password is wrong,
      // so the form cannot be used to discover valid usernames.
      const invalid = () => new HttpError(401, 'Incorrect username or password.')

      if (!row) {
        // Spend comparable time so a missing account is not detectable by timing.
        await verifyPassword(password, `scrypt$${'A'.repeat(22)}$${'A'.repeat(86)}`)
        throw invalid()
      }

      if (!(await verifyPassword(password, String(row.password_hash)))) throw invalid()
      if (!row.active) throw new HttpError(403, 'This account has been deactivated.')

      const user: SessionUser = {
        id: String(row.id),
        username: String(row.username),
        displayName: String(row.display_name),
        role: row.role as Role,
        active: true,
        createdAt: new Date(String(row.created_at)).toISOString(),
      }

      await query('update staff_users set updated_at = now() where id = $1', [user.id])

      sendJson(res, 200, {
        token: issueToken(user),
        user: describeUser(user),
      })
    },
  },

  {
    method: 'POST',
    path: ['auth', 'logout'],
    access: 'public',
    handler: async ({ res }) => {
      // Tokens are stateless; the browser discards it. This endpoint exists so
      // the client has one place to call and can be extended later.
      sendJson(res, 200, { ok: true })
    },
  },

  {
    method: 'GET',
    path: ['me'],
    access: 'signed-in',
    handler: async ({ res, user }) => {
      sendJson(res, 200, { user: describeUser(user as SessionUser) })
    },
  },

  {
    /**
     * Change your own password.
     *
     * Separate from `PATCH /users/:id`, which is admin-only: a registrar or
     * viewer must still be able to rotate their own credential without an
     * administrator. The current password is required so a borrowed session
     * cannot be escalated into a permanent account.
     */
    method: 'POST',
    path: ['auth', 'password'],
    access: 'signed-in',
    handler: async ({ res, user, json }) => {
      const session = user as SessionUser
      const body = await json<{ currentPassword?: string; newPassword?: string }>()

      const currentPassword = asString(body.currentPassword)
      const newPassword = asString(body.newPassword)

      if (!currentPassword || !newPassword) {
        throw badRequest('Enter your current password and a new one.')
      }
      if (newPassword.length < 8) {
        throw badRequest('The new password must be at least 8 characters.')
      }
      if (newPassword === currentPassword) {
        throw badRequest('The new password must be different from the current one.')
      }

      const row = await findUserByUsername(session.username)
      if (!row || String(row.id) !== session.id) {
        throw notFound('That account no longer exists.')
      }
      // Deliberately a 403, not a 401: the client clears its stored token on
      // 401, and a mistyped current password must not sign the user out.
      if (!(await verifyPassword(currentPassword, String(row.password_hash)))) {
        throw new HttpError(403, 'Your current password is incorrect.')
      }

      await query('update staff_users set password_hash = $2, updated_at = now() where id = $1', [
        session.id,
        await hashPassword(newPassword),
      ])

      sendJson(res, 200, { ok: true })
    },
  },

  /* ---------------------------- bootstrap ----------------------------- */
  {
    method: 'GET',
    path: ['bootstrap'],
    access: 'signed-in',
    handler: async ({ res, user }) => {
      const [settings, programs, applications, students] = await Promise.all([
        loadCollege(),
        listPrograms(),
        listApplications(),
        listStudents(),
      ])

      sendJson(res, 200, {
        user: describeUser(user as SessionUser),
        settings: { college: { ...DEFAULT_COLLEGE, ...(settings ?? {}) } },
        programs,
        applications,
        students,
      })
    },
  },

  /* ----------------------------- programs ----------------------------- */
  {
    method: 'POST',
    path: ['programs'],
    access: 'write',
    handler: async ({ res, json }) => {
      const body = await json<Partial<Program>>()
      requireFields(body as Record<string, unknown>, ['name', 'code'])

      const program: Program = {
        id: randomId(),
        name: asString(body.name).trim(),
        code: asString(body.code).trim().toUpperCase(),
        duration: asString(body.duration),
        description: asString(body.description),
        admissionOpen: asBoolean(body.admissionOpen, true),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const rows = await query(
        `insert into programs (id, name, code, duration, description, admission_open)
         values ($1, $2, $3, $4, $5, $6)
         returning id, name, code, duration, description, admission_open, created_at, updated_at`,
        [
          program.id,
          program.name,
          program.code,
          program.duration,
          program.description,
          program.admissionOpen,
        ],
      )

      sendJson(res, 201, mapProgram(rows[0]))
    },
  },

  {
    method: 'PATCH',
    path: ['programs', ':id'],
    access: 'write',
    handler: async ({ res, params, json }) => {
      const [existing] = await fetchOne(
        'programs',
        'id, name, code, duration, description, admission_open',
        params[0],
      )
      if (!existing) throw notFound('That programme no longer exists.')

      const patch = await json<Partial<Program>>()
      const next = buildUpdate(params[0], existing, patch as Record<string, unknown>)

      const rows = await query(
        `update programs
         set name = $2, code = $3, duration = $4, description = $5,
             admission_open = $6, updated_at = now()
         where id = $1
         returning id, name, code, duration, description, admission_open, created_at, updated_at`,
        [next.id, next.name, next.code, next.duration, next.description, next.admissionOpen],
      )

      sendJson(res, 200, mapProgram(rows[0]))
    },
  },

  {
    method: 'DELETE',
    path: ['programs', ':id'],
    access: 'write',
    handler: async ({ res, params }) => {
      // Applications and students reference programmes; the column is
      // ON DELETE SET NULL so their history survives.
      const rows = await query('delete from programs where id = $1 returning id', [params[0]])
      if (rows.length === 0) throw notFound('That programme no longer exists.')
      sendJson(res, 200, { ok: true, deleted: rows.length })
    },
  },

  /* --------------------------- applications --------------------------- */
  {
    method: 'POST',
    path: ['applications'],
    access: 'write',
    handler: async ({ res, json }) => {
      const body = await json<Partial<Application>>()

      if (!body.personal?.fullName) throw badRequest('The applicant needs a full name.')
      if (!body.program?.programId) throw badRequest('Select a programme for this application.')

      const year = currentSessionYear()

      // The sequence increment and the insert are one statement, so two
      // admissions submitted at the same instant cannot share a number.
      const rows = await query(
        `with seq as (
           insert into id_sequences (prefix, year, next_value)
           values ('LCM', $1, 1)
           on conflict (prefix, year) do update set next_value = id_sequences.next_value + 1
           returning next_value
         )
         insert into applications (
           id, application_no, status, full_name, father_name, cnic, date_of_birth,
           gender, phone, email, previous_qualification, institution, passing_year,
           marks_percentage, program_id, session, address, documents
         )
         select $2, $3 || '-' || $1 || '-' || lpad(next_value::text, 4, '0'), 'pending',
                $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
         from seq
         returning *`,
        [
          year,
          randomId(),
          'LCM',
          body.personal.fullName,
          body.personal.fatherName ?? '',
          body.personal.cnic ?? '',
          requireDate(body.personal.dateOfBirth, 'The date of birth'),
          body.personal.gender ?? '',
          body.personal.phone ?? '',
          body.personal.email ?? '',
          body.academic?.previousQualification ?? '',
          body.academic?.institution ?? '',
          body.academic?.passingYear ?? '',
          body.academic?.marksPercentage ?? '',
          body.program.programId,
          body.program.session ?? '',
          JSON.stringify(body.address ?? {}),
          JSON.stringify(body.documents ?? {}),
        ],
      )

      sendJson(res, 201, mapApplication(rows[0]))
    },
  },

  {
    method: 'PATCH',
    path: ['applications', ':id'],
    access: 'write',
    handler: async ({ res, params, json }) => {
      const [existing] = await fetchOne(
        'applications',
        'id, full_name, father_name, cnic, date_of_birth, gender, phone, email, previous_qualification, institution, passing_year, marks_percentage, program_id, session, address, review_note',
        params[0],
      )
      if (!existing) throw notFound('That application no longer exists.')

      const patch = await json<Partial<Application>>()

      // A PATCH only carries what changed, so each block is merged onto what is
      // already stored. The status and document columns are left untouched.
      const current = mapApplication(existing)

      // A date the caller is not sending stays as the stored one — validated by
      // `mapApplication`, so it is already a clean YYYY-MM-DD or empty.
      if (Object.prototype.hasOwnProperty.call(patch.personal ?? {}, 'dateOfBirth')) {
        requireDate(patch.personal?.dateOfBirth, 'The date of birth')
      }

      const merged = {
        personal: { ...current.personal, ...(patch.personal ?? {}) },
        academic: { ...current.academic, ...(patch.academic ?? {}) },
        program: { ...current.program, ...(patch.program ?? {}) },
        address: { ...current.address, ...(patch.address ?? {}) },
      }
      const columns = applicationColumns(merged)

      const documents = Object.prototype.hasOwnProperty.call(patch, 'documents')
        ? JSON.stringify(patch.documents ?? {})
        : null

      const rows = await query(
        `update applications set
           full_name = $2, father_name = $3, cnic = $4, date_of_birth = $5,
           gender = $6, phone = $7, email = $8, previous_qualification = $9,
           institution = $10, passing_year = $11, marks_percentage = $12,
           program_id = $13, session = $14, address = $15,
           documents = coalesce($16, documents),
           updated_at = now()
         where id = $1
         returning *`,
        [
          params[0],
          columns.full_name,
          columns.father_name,
          columns.cnic,
          columns.date_of_birth,
          columns.gender,
          columns.phone,
          columns.email,
          columns.previous_qualification,
          columns.institution,
          columns.passing_year,
          columns.marks_percentage,
          columns.program_id,
          columns.session,
          columns.address,
          documents,
        ],
      )

      sendJson(res, 200, mapApplication(rows[0]))
    },
  },

  {
    method: 'PATCH',
    path: ['applications', ':id', 'status'],
    access: 'write',
    handler: async ({ res, params, json }) => {
      const body = await json<{ status?: ApplicationStatus; note?: string }>()
      const status = body.status

      if (status !== 'pending' && status !== 'approved' && status !== 'rejected') {
        throw badRequest('Status must be pending, approved or rejected.')
      }

      const rows = await query(
        `update applications
         set status = $2, review_note = coalesce($3, review_note), updated_at = now()
         where id = $1
         returning *`,
        [params[0], status, body.note ?? null],
      )

      if (rows.length === 0) throw notFound('That application no longer exists.')
      sendJson(res, 200, mapApplication(rows[0]))
    },
  },

  {
    method: 'DELETE',
    path: ['applications', ':id'],
    access: 'write',
    handler: async ({ res, params }) => {
      // application_documents cascades, so the uploads go with it.
      const rows = await query('delete from applications where id = $1 returning id', [params[0]])
      if (rows.length === 0) throw notFound('That application no longer exists.')
      sendJson(res, 200, { ok: true, deleted: rows.length })
    },
  },

  /* ----------------------------- students ----------------------------- */
  {
    method: 'POST',
    path: ['students'],
    access: 'write',
    handler: async ({ res, json }) => {
      const body = await json<Partial<Student>>()

      if (!body.name) throw badRequest("Enter the student's name.")
      if (!body.programId) throw badRequest('Select a programme for this student.')

      const year = currentSessionYear()
      const fields = studentFields({
        name: asString(body.name).trim(),
        fatherName: asString(body.fatherName),
        phone: asString(body.phone),
        email: asString(body.email),
        cnic: asString(body.cnic),
        programId: asString(body.programId),
        admissionDate: requireDate(body.admissionDate, 'The admission date'),
        status: requireStudentStatus(body.status),
      })

      const rows = await query(
        `with seq as (
           insert into id_sequences (prefix, year, next_value)
           values ('STU', $1, 1)
           on conflict (prefix, year) do update set next_value = id_sequences.next_value + 1
           returning next_value
         )
         insert into students (
           id, student_no, application_id, name, father_name, phone, email, cnic,
           program_id, admission_date, status
         )
         select $2, $3 || '-' || $1 || '-' || lpad(next_value::text, 4, '0'), $4,
                $5, $6, $7, $8, $9, $10, $11, $12
         from seq
         returning *`,
        [
          year,
          randomId(),
          'STU',
          body.applicationId ?? null,
          fields.name,
          fields.father_name,
          fields.phone,
          fields.email,
          fields.cnic,
          fields.program_id,
          fields.admission_date,
          fields.status,
        ],
      )

      sendJson(res, 201, mapStudent(rows[0]))
    },
  },

  {
    method: 'POST',
    path: ['students', 'promote'],
    access: 'write',
    handler: async ({ res, json }) => {
      const body = await json<{ applicationId?: string }>()
      const applicationId = asString(body.applicationId)
      if (!applicationId) throw badRequest('An application is required.')

      const applications = await fetchOne('applications', '*', applicationId)
      const application = applications[0]
      if (!application) throw notFound('That application no longer exists.')

      if (application.status !== 'approved') {
        throw badRequest('Only approved applications can be enrolled.')
      }

      const existing = await query('select student_no from students where application_id = $1', [
        applicationId,
      ])
      if (existing.length > 0) {
        throw conflict(
          `${String(application.full_name)} is already enrolled as ${existing[0].student_no}.`,
        )
      }

      const mapped = mapApplication(application)
      const year = currentSessionYear()

      const rows = await query(
        `with seq as (
           insert into id_sequences (prefix, year, next_value)
           values ('STU', $1, 1)
           on conflict (prefix, year) do update set next_value = id_sequences.next_value + 1
           returning next_value
         )
         insert into students (
           id, student_no, application_id, name, father_name, phone, email, cnic,
           program_id, admission_date, status
         )
         select $2, $3 || '-' || $1 || '-' || lpad(next_value::text, 4, '0'), $4,
                $5, $6, $7, $8, $9, $10, $11, $12
         from seq
         returning *`,
        [
          year,
          randomId(),
          'STU',
          applicationId,
          mapped.personal.fullName,
          mapped.personal.fatherName,
          mapped.personal.phone,
          mapped.personal.email,
          mapped.personal.cnic,
          mapped.program.programId,
          mapped.createdAt.slice(0, 10),
          'active',
        ],
      )

      sendJson(res, 201, mapStudent(rows[0]))
    },
  },

  {
    method: 'PATCH',
    path: ['students', ':id'],
    access: 'write',
    handler: async ({ res, params, json }) => {
      const [existing] = await fetchOne(
        'students',
        'id, name, father_name, phone, email, cnic, program_id, admission_date, status',
        params[0],
      )
      if (!existing) throw notFound('That student record no longer exists.')

      const patch = await json<Partial<Student>>()
      const source = patch as Record<string, unknown>
      const pick = (key: string, column: string) =>
        Object.prototype.hasOwnProperty.call(source, key) ? source[key] : existing[column]

      // Only what the caller sent is validated; a date or status already in the
      // database is trusted, so an untouched field can never fail the save.
      const admissionDate = Object.prototype.hasOwnProperty.call(source, 'admissionDate')
        ? requireDate(source.admissionDate, 'The admission date')
        : dateOnly(existing.admission_date)

      const status = Object.prototype.hasOwnProperty.call(source, 'status')
        ? requireStudentStatus(source.status)
        : isStudentStatus(existing.status)
          ? existing.status
          : 'active'

      const fields = studentFields({
        name: asString(pick('name', 'name')),
        fatherName: asString(pick('fatherName', 'father_name')),
        phone: asString(pick('phone', 'phone')),
        email: asString(pick('email', 'email')),
        cnic: asString(pick('cnic', 'cnic')),
        programId: asString(pick('programId', 'program_id')),
        admissionDate,
        status,
      })

      const rows = await query(
        `update students set
           name = $2, father_name = $3, phone = $4, email = $5, cnic = $6,
           program_id = $7, admission_date = $8, status = $9, updated_at = now()
         where id = $1
         returning *`,
        [
          params[0],
          fields.name,
          fields.father_name,
          fields.phone,
          fields.email,
          fields.cnic,
          fields.program_id,
          fields.admission_date,
          fields.status,
        ],
      )

      sendJson(res, 200, mapStudent(rows[0]))
    },
  },

  {
    method: 'DELETE',
    path: ['students', ':id'],
    access: 'write',
    handler: async ({ res, params }) => {
      const rows = await query('delete from students where id = $1 returning id', [params[0]])
      if (rows.length === 0) throw notFound('That student record no longer exists.')
      sendJson(res, 200, { ok: true, deleted: rows.length })
    },
  },

  /* ----------------------------- settings ----------------------------- */
  {
    method: 'PUT',
    path: ['settings'],
    access: 'write',
    handler: async ({ res, json }) => {
      const body = await json<{ college?: Partial<CollegeProfile> }>()
      const college = await loadCollege()
      const merged = { ...DEFAULT_COLLEGE, ...(college ?? {}), ...(body.college ?? {}) }
      sendJson(res, 200, { college: await saveCollege(merged as CollegeProfile) })
    },
  },

  /* ----------------------------- documents ---------------------------- */
  {
    method: 'POST',
    path: ['documents'],
    access: 'write',
    handler: async ({ res, body, param }) => {
      const applicationId = param('applicationId')
      const id = param('id')
      const label = param('label')
      const fileName = param('fileName')
      const mimeType = param('mimeType') || 'application/octet-stream'

      if (!DOCUMENT_LABELS.includes(label as DocumentMeta['label'])) {
        throw badRequest('Unknown document type.')
      }

      const content = await body(MAX_DOCUMENT_BYTES)
      if (content.length === 0) throw badRequest('The uploaded file was empty.')
      if (content.length > MAX_DOCUMENT_BYTES) {
        throw new HttpError(413, 'Each document must be 3 MB or smaller.')
      }

      const meta: DocumentMeta = {
        id,
        label: label as DocumentMeta['label'],
        fileName,
        mimeType,
        size: content.length,
        uploadedAt: new Date().toISOString(),
      }

      // One file per label. The client mints a fresh id every time a file is
      // picked, so clearing by id alone would orphan the previous upload —
      // clear every row for this application and label, this id included.
      await query(
        'delete from application_documents where application_id = $1 and label = $2',
        [applicationId, label],
      )

      const rows = await query(
        `insert into application_documents
           (id, application_id, label, file_name, mime_type, size_bytes, content)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning uploaded_at`,
        [id, applicationId, label, fileName, mimeType, content.length, content],
      )

      sendJson(res, 201, { meta: { ...meta, uploadedAt: iso(rows[0].uploaded_at) } })
    },
  },

  {
    method: 'GET',
    path: ['documents', ':id'],
    access: 'signed-in',
    handler: async ({ res, params }) => {
      const rows = await query(
        'select content, mime_type, file_name from application_documents where id = $1',
        [params[0]],
      )

      if (rows.length === 0) throw notFound('That document is no longer stored.')

      const content = rows[0].content

      sendBuffer(
        res,
        200,
        // `bytea` comes back as a Buffer on Node, or as \\x-prefixed text on
        // some drivers — accept both rather than serving corrupted bytes.
        Buffer.isBuffer(content)
          ? content
          : Buffer.from(String(content).replace(/^\\x/, ''), 'hex'),
        String(rows[0].mime_type || 'application/octet-stream'),
        String(rows[0].file_name),
      )
    },
  },

  {
    method: 'DELETE',
    path: ['documents', ':id'],
    access: 'write',
    handler: async ({ res, params }) => {
      const rows = await query('delete from application_documents where id = $1 returning id', [
        params[0],
      ])
      if (rows.length === 0) throw notFound('That document is no longer stored.')
      sendJson(res, 200, { ok: true, deleted: rows.length })
    },
  },

  /* --------------------------- staff users --------------------------- */
  {
    method: 'GET',
    path: ['users'],
    access: 'admin',
    handler: async ({ res }) => {
      sendJson(res, 200, { users: await listUsers() })
    },
  },

  {
    method: 'POST',
    path: ['users'],
    access: 'admin',
    handler: async ({ res, json }) => {
      const body = await json<{
        username?: string
        displayName?: string
        password?: string
        role?: string
      }>()

      const username = asString(body.username).trim()
      const password = asString(body.password)

      if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
        throw badRequest('Use 3–24 letters, numbers, dots, dashes or underscores for the username.')
      }
      if (password.length < 8) throw badRequest('The password must be at least 8 characters.')
      if (!isRole(body.role)) throw badRequest('Role must be admin, registrar or viewer.')

      if (await findUserByUsername(username)) {
        throw conflict('That username is already taken.')
      }

      const rows = await query(
        `insert into staff_users (username, display_name, role, password_hash)
         values ($1, $2, $3, $4)
         returning id, username, display_name, role, active, created_at`,
        [username, asString(body.displayName).trim() || username, body.role, await hashPassword(password)],
      )

      sendJson(res, 201, mapUser(rows[0]))
    },
  },

  {
    method: 'PATCH',
    path: ['users', ':id'],
    access: 'admin',
    handler: async ({ res, params, json }) => {
      const body = await json<{
        displayName?: string
        role?: string
        password?: string
        active?: boolean
      }>()

      const [existing] = await fetchOne(
        'staff_users',
        'id, username, display_name, role, active',
        params[0],
      )
      if (!existing) throw notFound('That account no longer exists.')

      const role = body.role === undefined ? String(existing.role) : String(body.role)
      if (!isRole(role)) throw badRequest('Role must be admin, registrar or viewer.')

      const active = body.active === undefined ? Boolean(existing.active) : body.active

      // Never let the last administrator lock everyone out.
      if (String(existing.role) === 'admin' && (role !== 'admin' || !active)) {
        const remaining = await query(
          `select count(*)::int as count from staff_users
           where role = 'admin' and active = true and id <> $1`,
          [params[0]],
        )
        if (Number(remaining[0].count) === 0) {
          throw conflict('This is the last active administrator — promote someone else first.')
        }
      }

      const password = asString(body.password)
      const passwordHash = password ? await hashPassword(password) : null

      if (password && password.length < 8) {
        throw badRequest('The password must be at least 8 characters.')
      }

      const rows = await query(
        `update staff_users set
           display_name = $2, role = $3, active = $4,
           password_hash = coalesce($5, password_hash),
           updated_at = now()
         where id = $1
         returning id, username, display_name, role, active, created_at`,
        [
          params[0],
          body.displayName === undefined ? existing.display_name : asString(body.displayName).trim(),
          role,
          active,
          passwordHash,
        ],
      )

      sendJson(res, 200, mapUser(rows[0]))
    },
  },

  {
    method: 'DELETE',
    path: ['users', ':id'],
    access: 'admin',
    handler: async ({ res, params, user }) => {
      if (params[0] === (user as SessionUser).id) {
        throw badRequest('You cannot delete the account you are signed in with.')
      }

      const rows = await query(
        `delete from staff_users where id = $1 returning id, role`,
        [params[0]],
      )
      if (rows.length === 0) throw notFound('That account no longer exists.')

      if (rows[0].role === 'admin') {
        const remaining = await query(
          `select count(*)::int as count from staff_users
           where role = 'admin' and active = true`,
        )
        if (Number(remaining[0].count) === 0) {
          throw conflict('This is the last administrator — the account was not removed.')
        }
      }

      sendJson(res, 200, { ok: true })
    },
  },

  /* ----------------------- import / one-time reset ---------------------- */
  {
    method: 'POST',
    path: ['import'],
    access: 'write',
    handler: async ({ res, json }) => {
      const payload = await json<ImportPayload>()

      const programs = Array.isArray(payload.programs) ? payload.programs : []
      const applications = Array.isArray(payload.applications) ? payload.applications : []
      const students = Array.isArray(payload.students) ? payload.students : []

      if (programs.length + applications.length + students.length === 0) {
        throw badRequest('No valid records were found in this file.')
      }

      // Upserts rather than inserts, so re-importing the same backup updates
      // in place instead of duplicating rows.
      for (const program of programs) {
        if (!program?.id || !program.name || !program.code) continue
        await query(
          `insert into programs (id, name, code, duration, description, admission_open, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, coalesce($7, now()), coalesce($8, now()))
           on conflict (id) do update set
             name = excluded.name, code = excluded.code, duration = excluded.duration,
             description = excluded.description, admission_open = excluded.admission_open,
             updated_at = now()`,
          [
            program.id,
            program.name,
            String(program.code).toUpperCase(),
            program.duration ?? '',
            program.description ?? '',
            program.admissionOpen ?? true,
            program.createdAt ?? null,
            program.updatedAt ?? null,
          ],
        )
      }

      for (const application of applications) {
        if (!application?.id || !application.applicationNo || !application.personal) continue
        const columns = applicationColumns({
          personal: application.personal,
          academic: application.academic ?? ({} as Application['academic']),
          program: application.program ?? ({} as Application['program']),
          address: application.address ?? ({} as Application['address']),
        })

        await query(
          `insert into applications (
             id, application_no, status, full_name, father_name, cnic, date_of_birth,
             gender, phone, email, previous_qualification, institution, passing_year,
             marks_percentage, program_id, session, address, documents, review_note,
             created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                   $16, $17, $18, $19, coalesce($20, now()), coalesce($21, now()))
           on conflict (id) do update set
             status = excluded.status, full_name = excluded.full_name,
             father_name = excluded.father_name, cnic = excluded.cnic,
             date_of_birth = excluded.date_of_birth, gender = excluded.gender,
             phone = excluded.phone, email = excluded.email,
             previous_qualification = excluded.previous_qualification,
             institution = excluded.institution, passing_year = excluded.passing_year,
             marks_percentage = excluded.marks_percentage,
             session = excluded.session, address = excluded.address,
             documents = excluded.documents, updated_at = now()`,
          [
            application.id,
            application.applicationNo,
            application.status ?? 'pending',
            columns.full_name,
            columns.father_name,
            columns.cnic,
            columns.date_of_birth,
            columns.gender,
            columns.phone,
            columns.email,
            columns.previous_qualification,
            columns.institution,
            columns.passing_year,
            columns.marks_percentage,
            application.program?.programId || null,
            columns.session,
            columns.address,
            JSON.stringify(application.documents ?? {}),
            application.reviewNote ?? null,
            application.createdAt ?? null,
            application.updatedAt ?? null,
          ],
        )
      }

      for (const student of students) {
        if (!student?.id || !student.studentNo || !student.name) continue
        const fields = studentFields({
          name: student.name,
          fatherName: student.fatherName ?? '',
          phone: student.phone ?? '',
          email: student.email ?? '',
          cnic: student.cnic ?? '',
          programId: student.programId ?? '',
          admissionDate: student.admissionDate ?? '',
          status: student.status ?? 'active',
        })

        await query(
          `insert into students (
             id, student_no, application_id, name, father_name, phone, email, cnic,
             program_id, admission_date, status, created_at, updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                   coalesce($12, now()), coalesce($13, now()))
           on conflict (id) do update set
             name = excluded.name, father_name = excluded.father_name,
             phone = excluded.phone, email = excluded.email, cnic = excluded.cnic,
             admission_date = excluded.admission_date, status = excluded.status,
             updated_at = now()`,
          [
            student.id,
            student.studentNo,
            student.applicationId ?? null,
            fields.name,
            fields.father_name,
            fields.phone,
            fields.email,
            fields.cnic,
            fields.program_id,
            fields.admission_date,
            fields.status,
            student.createdAt ?? null,
            student.updatedAt ?? null,
          ],
        )
      }

      if (payload.settings?.college) {
        const college = await loadCollege()
        await saveCollege({ ...DEFAULT_COLLEGE, ...(college ?? {}), ...payload.settings.college })
      }

      sendJson(res, 200, {
        ok: true,
        counts: {
          programs: programs.length,
          applications: applications.length,
          students: students.length,
        },
      })
    },
  },

  {
    method: 'POST',
    path: ['reset'],
    access: 'admin',
    handler: async ({ res }) => {
      await query(
        'truncate applications, application_documents, students, programs cascade',
      )
      await query('delete from id_sequences')
      sendJson(res, 200, { ok: true })
    },
  },
]

/* ---------------------------------------------------------------- extras --- */

function describeUser(user: SessionUser): StaffUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  }
}
