/**
 * Repository functions over localStorage.
 *
 * Every function returns fresh data and never throws for missing keys —
 * callers can treat these as synchronous reads of persisted state.
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS } from './defaults'
import { readStore, writeStore, removeStore } from './storage'
import type { Application, AppSettings, Program, Student } from '@/types'

/* ---------------------------- Settings ---------------------------- */

export function loadSettings(): AppSettings {
  const stored = readStore<Partial<AppSettings>>(STORAGE_KEYS.settings, {})
  return {
    college: { ...DEFAULT_SETTINGS.college, ...(stored.college ?? {}) },
    admin: { ...DEFAULT_SETTINGS.admin, ...(stored.admin ?? {}) },
  }
}

export function saveSettings(settings: AppSettings): void {
  writeStore(STORAGE_KEYS.settings, settings)
}

/* ---------------------------- Programs ---------------------------- */

export function loadPrograms(): Program[] {
  return readStore<Program[]>(STORAGE_KEYS.programs, [])
}

export function savePrograms(programs: Program[]): void {
  writeStore(STORAGE_KEYS.programs, programs)
}

/* -------------------------- Applications -------------------------- */

export function loadApplications(): Application[] {
  return readStore<Application[]>(STORAGE_KEYS.applications, [])
}

export function saveApplications(applications: Application[]): void {
  writeStore(STORAGE_KEYS.applications, applications)
}

/* ---------------------------- Students ---------------------------- */

export function loadStudents(): Student[] {
  return readStore<Student[]>(STORAGE_KEYS.students, [])
}

export function saveStudents(students: Student[]): void {
  writeStore(STORAGE_KEYS.students, students)
}

/* ----------------------------- Session ---------------------------- */

export interface AuthSession {
  username: string
  displayName: string
  signedInAt: string
}

export function loadSession(): AuthSession | null {
  return readStore<AuthSession | null>(STORAGE_KEYS.session, null)
}

export function saveSession(session: AuthSession): void {
  writeStore(STORAGE_KEYS.session, session)
}

export function clearSession(): void {
  removeStore(STORAGE_KEYS.session)
}