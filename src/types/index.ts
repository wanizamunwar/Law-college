/**
 * Domain types for the Law College Management System.
 */

export type Gender = 'male' | 'female' | 'other'

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'on-leave'

export type AdmissionSession = string

export interface PersonalInfo {
  fullName: string
  fatherName: string
  cnic: string
  dateOfBirth: string
  gender: Gender | ''
  phone: string
  email: string
}

export interface AcademicInfo {
  previousQualification: string
  institution: string
  passingYear: string
  marksPercentage: string
}

export interface ProgramSelection {
  programId: string
  session: AdmissionSession
}

export interface AddressInfo {
  currentAddress: string
  permanentAddress: string
  city: string
  district: string
  province: string
  postalCode: string
}

/** Metadata for an uploaded document. Binary content lives in IndexedDB. */
export interface DocumentMeta {
  id: string
  label: 'photograph' | 'cnic' | 'academicCertificate' | 'marksSheet'
  fileName: string
  mimeType: string
  size: number
  uploadedAt: string
}

export type DocumentSet = Record<DocumentMeta['label'], DocumentMeta | null>

export interface Application {
  id: string
  /** e.g. LCM-2026-0001 */
  applicationNo: string
  createdAt: string
  updatedAt: string
  status: ApplicationStatus
  personal: PersonalInfo
  academic: AcademicInfo
  program: ProgramSelection
  address: AddressInfo
  documents: DocumentSet
  reviewNote?: string
}

export interface Program {
  id: string
  name: string
  code: string
  /** e.g. "5 Years" */
  duration: string
  description: string
  admissionOpen: boolean
  createdAt: string
  updatedAt: string
}

export interface Student {
  id: string
  /** e.g. STU-2026-0001 */
  studentNo: string
  applicationId: string | null
  name: string
  fatherName: string
  phone: string
  email: string
  cnic: string
  programId: string
  admissionDate: string
  status: StudentStatus
  createdAt: string
  updatedAt: string
}

export interface OfficeHours {
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
  friday: string
  saturday: string
  sunday: string
}

export interface CollegeProfile {
  name: string
  shortName: string
  logoDataUrl: string | null
  address: string
  phone: string
  email: string
  website: string
  about: string
  establishmentYear: string
  registrarName: string
  officeHours: OfficeHours
  city: string
  province: string
  latitude: string
  longitude: string
}

export interface AdminUser {
  username: string
  displayName: string
  password: string
}

export interface AppSettings {
  college: CollegeProfile
  admin: AdminUser
}

export interface SeedData {
  programs: Program[]
  applications: Application[]
  students: Student[]
}