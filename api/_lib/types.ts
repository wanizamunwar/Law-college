/**
 * Types for the API layer.
 *
 * The domain shapes are imported (type-only, so nothing is emitted at runtime)
 * from the app's own definitions — the browser and the database must agree.
 */

import type {
  AppSettings,
  Application,
  CollegeProfile,
  Program,
  Student,
} from '../../src/types/index'

export type {
  AcademicInfo,
  AddressInfo,
  Application,
  ApplicationStatus,
  AppSettings,
  CollegeProfile,
  DocumentMeta,
  DocumentSet,
  Gender,
  OfficeHours,
  PersonalInfo,
  Program,
  ProgramSelection,
  Student,
  StudentStatus,
} from '../../src/types/index'

export type Role = 'admin' | 'registrar' | 'viewer'

/** A staff account, minus the password hash. */
export interface StaffUser {
  id: string
  username: string
  displayName: string
  role: Role
  active: boolean
  createdAt: string
}

/** The signed-in identity attached to every authenticated request. */
export interface SessionUser {
  id: string
  username: string
  displayName: string
  role: Role
  active: boolean
  createdAt: string
}

/** Everything the app needs on first paint after sign-in. */
export interface BootstrapPayload {
  user: StaffUser
  settings: { college: AppSettings['college'] }
  programs: Program[]
  applications: Application[]
  students: Student[]
}

/** Shape of the JSON backup produced by Settings → Data. */
export interface ImportPayload {
  version?: number
  exportedAt?: string
  programs?: Partial<Program>[]
  applications?: Partial<Application>[]
  students?: Partial<Student>[]
  settings?: { college?: Partial<CollegeProfile> }
}
