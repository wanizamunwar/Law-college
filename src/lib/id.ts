/**
 * Human-friendly identifiers.
 * Application ID: LCM-2026-0007   Student ID: STU-2026-0003
 */

export function currentSessionYear(): string {
  return String(new Date().getFullYear())
}

function padSequence(value: number, width = 4): string {
  return String(value).padStart(width, '0')
}

/** Builds the next sequential ID for a given prefix, based on existing records. */
export function nextSequentialId(
  prefix: 'LCM' | 'STU',
  sessionYear: string,
  existingIds: string[],
): string {
  const pattern = new RegExp(`^${prefix}-${sessionYear}-(\\d+)$`)
  let highest = 0

  for (const id of existingIds) {
    const match = pattern.exec(id)
    if (match) {
      const value = Number.parseInt(match[1], 10)
      if (Number.isFinite(value) && value > highest) highest = value
    }
  }

  return `${prefix}-${sessionYear}-${padSequence(highest + 1)}`
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}