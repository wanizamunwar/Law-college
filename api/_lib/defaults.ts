/**
 * Defaults shared by the API and the browser.
 *
 * Type-only imports are erased at build time, so nothing here reaches the
 * client bundle — it exists so a fresh database and a fresh browser agree on
 * what "empty" looks like.
 */

import type { CollegeProfile, OfficeHours } from './types'

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
