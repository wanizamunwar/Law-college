/**
 * Authentication for the API.
 *
 * Passwords are stored as scrypt hashes. Sign-in returns a signed, expiring
 * token that the browser sends back as a bearer credential, so a stolen
 * device gives no access without also reading the database.
 */

import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mapUser, query } from './db.ts'
import type { Role, SessionUser, StaffUser } from './types.ts'

const scrypt = promisify(scryptCallback)

type Row = Record<string, unknown>

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/** Tokens last eight hours — a working day at the registry. */
const TOKEN_TTL_SECONDS = 8 * 60 * 60

/* ------------------------------------------------------------- passwords --- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored).split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const salt = Buffer.from(parts[1], 'base64')
  const expected = Buffer.from(parts[2], 'base64')
  if (expected.length !== KEY_LENGTH) return false

  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  if (derived.length !== expected.length) return false

  return timingSafeEqual(derived, expected)
}

/* ---------------------------------------------------------------- tokens --- */

function secret(): string {
  const configured = process.env.SESSION_SECRET

  if (configured && configured.length >= 32) return configured

  if (configured) {
    throw new Error('SESSION_SECRET must be at least 32 characters. See .env.example.')
  }

  // Development fallback so `npm run dev` works before .env.local exists.
  // It is stable per machine, and it never reaches production because a
  // deployment without SESSION_SECRET is refused below.
  if (process.env.VERCEL) {
    throw new Error('SESSION_SECRET is not set. Add it to the environment in Vercel.')
  }
  console.warn('[api] SESSION_SECRET is not set — using a development fallback secret.')
  return 'lcm-development-only-secret-do-not-use-in-production'
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function issueToken(user: SessionUser): string {
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      username: user.username,
      name: user.displayName,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }),
  )
  return `${payload}.${sign(payload)}`
}

/**
 * What the signed token actually carries.
 *
 * Deliberately narrower than SessionUser: the token is only a claim to look the
 * account up, so `active` and `createdAt` must come from the row.
 */
export interface TokenClaims {
  id: string
  username: string
  displayName: string
  role: Role
}

export function readToken(token: string | null): TokenClaims | null {
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = sign(payload)
  const given = Buffer.from(signature)
  const wanted = Buffer.from(expected)

  // timingSafeEqual throws when the lengths differ.
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string
      username: string
      name: string
      role: Role
      exp: number
    }

    if (!claims.sub || claims.exp * 1000 < Date.now()) return null

    return {
      id: claims.sub,
      username: claims.username,
      displayName: claims.name,
      role: claims.role,
    }
  } catch {
    return null
  }
}

/* --------------------------------------------------------------- lookup --- */

function bearerToken(headers: Record<string, string | string[] | undefined>): string | null {
  const header = headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return null

  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1] : null
}

/**
 * Resolves the caller from the bearer token.
 *
 * The account is re-read each time so a deactivated or deleted user loses
 * access immediately, without waiting for their token to expire.
 */
export async function currentUser(
  headers: Record<string, string | string[] | undefined>,
): Promise<SessionUser | null> {
  const claims = readToken(bearerToken(headers))
  if (!claims) return null

  const rows = await query(
    'select id, username, display_name, role, active, created_at from staff_users where id = $1',
    [claims.id],
  )

  const row = rows[0] as Record<string, unknown> | undefined
  if (!row || !row.active) return null

  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    role: row.role as Role,
    active: true,
    createdAt: new Date(String(row.created_at)).toISOString(),
  }
}

/* ------------------------------------------------------------ permissions --- */

/** Viewers may read; registrars and admins may write. */
export function canWrite(user: SessionUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'registrar'
}

/** Only admins manage the staff list. */
export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin'
}

/* ------------------------------------------------------------------ users --- */

export async function findUserByUsername(username: string): Promise<Row | null> {
  const rows = await query(
    'select id, username, display_name, role, active, created_at, password_hash from staff_users where lower(username) = lower($1)',
    [username],
  )
  return (rows[0] as Row) ?? null
}

export async function listUsers(): Promise<StaffUser[]> {
  const rows = await query(
    `select id, username, display_name, role, active, created_at
     from staff_users
     order by created_at`,
  )
  return rows.map((row) => mapUser(row as Row))
}
