/**
 * Typed client for the /api routes.
 *
 * The Neon connection string stays on the server; this module only ever sends
 * the session token issued at sign-in.
 */

import type {
  Application,
  AppSettings,
  ApplicationStatus,
  DocumentMeta,
  Program,
  Role,
  StaffUser,
  Student,
} from '@/types'

const TOKEN_KEY = 'lcm:token'

/** An error carrying the HTTP status, so callers can react to 401/403. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/* ----------------------------------------------------------------- token --- */

let token: string | null = null
let loaded = false

function readStoredToken(): string | null {
  if (loaded) return token
  loaded = true
  try {
    token = window.localStorage.getItem(TOKEN_KEY)
  } catch {
    // Private mode with storage disabled — the session simply won't persist.
    token = null
  }
  return token
}

export function storedToken(): string | null {
  return readStoredToken()
}

export function setStoredToken(next: string | null): void {
  token = next
  loaded = true
  try {
    if (next) window.localStorage.setItem(TOKEN_KEY, next)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — the session lasts until the tab closes */
  }
}

/* ---------------------------------------------------------------- request --- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Sends a Blob or string as the raw body instead of JSON. */
  raw?: BodyInit
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, raw, headers = {}, signal } = options

  const auth = readStoredToken()
  const init: RequestInit = { method, signal }

  if (auth) init.headers = { authorization: `Bearer ${auth}`, ...headers }
  else if (Object.keys(headers).length > 0) init.headers = headers

  if (raw !== undefined) {
    init.body = raw
  } else if (body !== undefined) {
    init.headers = { 'content-type': 'application/json', ...(init.headers ?? {}) }
    init.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(`/api${path}`, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.')
  }

  if (response.status === 204) return undefined as T

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : '') || `Request failed (${response.status}).`

    // A rejected token means the session is gone; drop it so the app shows the
    // login screen instead of retrying with a credential that cannot work.
    if (response.status === 401) setStoredToken(null)

    throw new ApiError(response.status, message)
  }

  return payload as T
}

/* ------------------------------------------------------------------- auth --- */

export interface SignInResponse {
  token: string
  user: StaffUser
}

export function signInRequest(username: string, password: string): Promise<SignInResponse> {
  return request<SignInResponse>('/auth/login', { method: 'POST', body: { username, password } })
}

export function signOutRequest(): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST' })
}

/** Rotates the signed-in account's own password. Requires the current one. */
export function changeOwnPasswordRequest(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return request('/auth/password', { method: 'POST', body: { currentPassword, newPassword } })
}

/* ------------------------------------------------------------- bootstrap --- */

export interface BootstrapResponse {
  user: StaffUser
  settings: { college: AppSettings['college'] }
  programs: Program[]
  applications: Application[]
  students: Student[]
}

export function fetchBootstrap(): Promise<BootstrapResponse> {
  return request<BootstrapResponse>('/bootstrap')
}

/* -------------------------------------------------------------- programs --- */

export function createProgramRequest(
  input: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Program> {
  return request<Program>('/programs', { method: 'POST', body: input })
}

export function updateProgramRequest(id: string, patch: Partial<Program>): Promise<Program> {
  return request<Program>(`/programs/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
}

export function deleteProgramRequest(id: string): Promise<{ ok: true }> {
  return request(`/programs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ---------------------------------------------------------- applications --- */

export type CreateApplicationInput = Pick<
  Application,
  'personal' | 'academic' | 'program' | 'address' | 'documents'
>

export function createApplicationRequest(input: CreateApplicationInput): Promise<Application> {
  return request<Application>('/applications', { method: 'POST', body: input })
}

export function updateApplicationRequest(
  id: string,
  patch: Partial<Application>,
): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function setApplicationStatusRequest(
  id: string,
  status: ApplicationStatus,
  note?: string,
): Promise<Application> {
  return request<Application>(`/applications/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status, note },
  })
}

export function deleteApplicationRequest(id: string): Promise<{ ok: true }> {
  return request(`/applications/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* -------------------------------------------------------------- students --- */

export type CreateStudentInput = Omit<
  Student,
  'id' | 'studentNo' | 'createdAt' | 'updatedAt'
>

export function createStudentRequest(input: CreateStudentInput): Promise<Student> {
  return request<Student>('/students', { method: 'POST', body: input })
}

export function promoteToStudentRequest(applicationId: string): Promise<Student> {
  return request<Student>('/students/promote', { method: 'POST', body: { applicationId } })
}

export function updateStudentRequest(id: string, patch: Partial<Student>): Promise<Student> {
  return request<Student>(`/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
}

export function deleteStudentRequest(id: string): Promise<{ ok: true }> {
  return request(`/students/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* -------------------------------------------------------------- settings --- */

export function saveSettingsRequest(college: AppSettings['college']): Promise<{
  college: AppSettings['college']
}> {
  return request('/settings', { method: 'PUT', body: { college } })
}

/* ------------------------------------------------------------- documents --- */

/** Must match the server's limit — see MAX_DOCUMENT_BYTES in api/_lib/routes. */
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024

export function uploadDocumentRequest(
  applicationId: string,
  meta: Omit<DocumentMeta, 'size' | 'uploadedAt'>,
  file: Blob,
): Promise<{ meta: DocumentMeta }> {
  const query = new URLSearchParams({
    applicationId,
    id: meta.id,
    label: meta.label,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
  })

  return request(`/documents?${query.toString()}`, {
    method: 'POST',
    raw: file,
    headers: { 'content-type': meta.mimeType || 'application/octet-stream' },
  })
}

/** Fetches a stored document as an object URL. The caller revokes it. */
export async function documentObjectUrl(id: string, mimeType: string): Promise<string | null> {
  const auth = readStoredToken()
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  })

  if (!response.ok) throw new ApiError(response.status, 'That document could not be opened.')

  const blob = await response.blob()
  // Prefer the type recorded with the upload; the response may say
  // "application/octet-stream" when the browser did not supply one.
  const type = mimeType || blob.type

  return URL.createObjectURL(type === blob.type ? blob : new Blob([blob], { type }))
}

/* ------------------------------------------------------------ staff users --- */

export interface StaffListResponse {
  users: StaffUser[]
}

export interface StaffInput {
  username: string
  displayName: string
  password: string
  role: Role
}

export function listStaffRequest(): Promise<StaffListResponse> {
  return request<StaffListResponse>('/users')
}

export function createStaffRequest(input: StaffInput): Promise<StaffUser> {
  return request<StaffUser>('/users', { method: 'POST', body: input })
}

export function updateStaffRequest(
  id: string,
  patch: Partial<Pick<StaffUser, 'displayName' | 'role' | 'active'>> & { password?: string },
): Promise<StaffUser> {
  return request<StaffUser>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
}

export function deleteStaffRequest(id: string): Promise<{ ok: true }> {
  return request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* -------------------------------------------------------- import / reset --- */

export interface ImportResponse {
  ok: boolean
  counts: { programs: number; applications: number; students: number }
}

export function importDataRequest(payload: unknown): Promise<ImportResponse> {
  return request<ImportResponse>('/import', { method: 'POST', body: payload })
}

export function resetDataRequest(): Promise<{ ok: true }> {
  return request('/reset', { method: 'POST' })
}
