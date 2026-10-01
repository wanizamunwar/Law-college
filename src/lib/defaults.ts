import type { CollegeProfile, OfficeHours } from '@/types'

/** Keys the pre-database version wrote to `localStorage`. */
export const LEGACY_STORAGE_PREFIX = 'lcm:'

export const EMPTY_OFFICE_HOURS: OfficeHours = {
  monday: '08:30 – 16:00',
  tuesday: '08:30 – 16:00',
  wednesday: '08:30 – 16:00',
  thursday: '08:30 – 16:00',
  friday: '08:30 – 12:00',
  saturday: 'Closed',
  sunday: 'Closed',
}

export const DEFAULT_COLLEGE: CollegeProfile = {
  name: 'College of Law',
  shortName: '',
  logoDataUrl: null,
  address: '',
  phone: '',
  email: '',
  website: '',
  about: '',
  establishmentYear: '',
  registrarName: '',
  officeHours: { ...EMPTY_OFFICE_HOURS },
  city: '',
  province: '',
  latitude: '',
  longitude: '',
}

/** Province options — Pakistan (the CNIC field implies this context). */
export const PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Gilgit-Baltistan',
  'Azad Jammu & Kashmir',
  'Islam Capital Territory',
] as const

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const

export const QUALIFICATION_OPTIONS = [
  'Intermediate (HSSC / F.A.)',
  'Bachelor (BA / BS / LL.B.)',
  'Master (MA / M.A.)',
  'Others',
] as const

export const MAX_IMAGE_BYTES = 1024 * 1024