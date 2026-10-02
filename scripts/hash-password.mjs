/**
 * Password hashing, shared by the migration script and the API.
 *
 * scrypt with a per-password random salt. Both sides are Base64 so the whole
 * thing is one storable column:
 *
 *     scrypt$<salt>$<hash>
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Builds a strong, random password.
 *
 * Used by the setup scripts when no password was configured, so a fresh install
 * never falls back to a hard-coded default that is published in this repository.
 *
 * The alphabet omits symbols and visually similar characters (0/O, 1/l/I): the
 * value is read off a terminal and retyped by hand, so ambiguity costs more than
 * the extra characters would add.
 */
export function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(20)

  let password = ''
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length]
  }

  return password
}

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const salt = Buffer.from(parts[1], 'base64')
  const expected = Buffer.from(parts[2], 'base64')
  if (expected.length !== KEY_LENGTH) return false

  const derived = await scrypt(password, salt, KEY_LENGTH)

  // Lengths already match, but timingSafeEqual throws on a mismatch.
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
