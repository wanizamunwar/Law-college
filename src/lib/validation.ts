/**
 * A very small validation helper.
 *
 * `validate` takes a plain object plus a rules map and returns a map of
 * field -> first error message. An empty result means the payload is valid.
 * Keeping this in-house avoids pulling in a form library and keeps the
 * rules readable next to the fields they describe.
 */

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export interface FieldRule {
  label: string
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  patternMessage?: string
  validate?: (value: string, values: Record<string, string>) => string | null
}

export type RuleMap<T> = { [K in keyof T]?: FieldRule }

export function validate<T extends Record<string, unknown>>(
  values: T,
  rules: RuleMap<T>,
): FieldErrors<T> {
  const errors: FieldErrors<T> = {}
  const flat: Record<string, string> = {}

  for (const key of Object.keys(values)) {
    flat[key] = String(values[key] ?? '')
  }

  for (const key of Object.keys(rules) as Array<keyof T>) {
    const rule = rules[key]
    if (!rule) continue

    const raw = flat[String(key)] ?? ''
    const value = raw.trim()

    if (rule.required && value.length === 0) {
      errors[key] = `${rule.label} is required.`
      continue
    }

    // Optional + empty -> no further checks.
    if (value.length === 0) continue

    if (rule.min !== undefined && value.length < rule.min) {
      errors[key] = `${rule.label} must be at least ${rule.min} characters.`
      continue
    }

    if (rule.max !== undefined && value.length > rule.max) {
      errors[key] = `${rule.label} must be ${rule.max} characters or fewer.`
      continue
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors[key] = rule.patternMessage ?? `${rule.label} is not in the correct format.`
      continue
    }

    if (rule.validate) {
      const message = rule.validate(value, flat)
      if (message) errors[key] = message
    }
  }

  return errors
}

/* ------------------------------------------------------------------ */
/* Shared reusable patterns                                            */
/* ------------------------------------------------------------------ */

/** Pakistani CNIC: 5 digits, hyphen, 7 digits, hyphen, 1 digit. */
export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/
export const CNIC_MESSAGE = 'Enter CNIC as 00000-0000000-0.'

/** Accepts local formats such as 03001234567 or +923001234567. */
export const PHONE_PATTERN = /^(?:\+92|0)3\d{9}$/
export const PHONE_MESSAGE = 'Enter a valid mobile number, e.g. 03001234567.'

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const EMAIL_MESSAGE = 'Enter a valid email address.'

export const POSTAL_PATTERN = /^\d{4,6}$/
export const POSTAL_MESSAGE = 'Enter a valid postal code (4–6 digits).'

export const LATITUDE_PATTERN = /^-?\d{1,2}(\.\d{1,6})?$/
export const LATITUDE_MESSAGE = 'Latitude must be between -90 and 90.'

export const LONGITUDE_PATTERN = /^-?\d{1,3}(\.\d{1,6})?$/
export const LONGITUDE_MESSAGE = 'Longitude must be between -180 and 180.'

export function requiredNumber(
  label: string,
  min: number,
  max: number,
): (value: string) => string | null {
  return (value) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return `${label} must be a number.`
    if (parsed < min || parsed > max) return `${label} must be between ${min} and ${max}.`
    return null
  }
}

export function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}