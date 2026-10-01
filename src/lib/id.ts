/**
 * Identifiers generated in the browser.
 *
 * Human-facing references — LCM-2026-0001, STU-2026-0001 — are issued by the
 * database so two admissions submitted at the same moment cannot collide.
 * Only document ids are minted here, because a file has to be identified
 * before the record it belongs to exists.
 */

export function currentSessionYear(): string {
  return String(new Date().getFullYear())
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
