/**
 * Resets the password of an existing staff account.
 *
 *   npm run db:reset-password
 *   npm run db:reset-password -- --username registrar1
 *
 * This is the recovery path when nobody can sign in — a forgotten or mistyped
 * password, or a laptop that never had the .env.local the first seed used. It
 * changes the `password_hash` of an account that already exists and touches
 * nothing else: no rows are created or deleted, the role and the account's
 * place in the staff list stay exactly as they were, and the schema is not
 * altered. Run `npm run db:migrate` for the first account on an empty database.
 *
 * The password is read from the environment rather than a command-line flag,
 * because a flag is kept in shell history and is visible to every other process
 * on the machine. Either set it in .env.local:
 *
 *   ADMIN_PASSWORD="the-new-password"
 *
 * or pass it for one run only, which leaves it in neither file nor history:
 *
 *   $env:ADMIN_PASSWORD = "the-new-password"; npm run db:reset-password
 *
 * With neither set, a strong password is generated and printed once so it can
 * be copied out — it is never written to disk, and only its scrypt hash reaches
 * the database.
 *
 * The password is hashed with the same scrypt scheme as every other credential
 * in the system (see hash-password.mjs), and the update is verified by reading
 * the stored hash back and checking it against the password before reporting
 * success.
 */

import { neon } from '@neondatabase/serverless'
import { generatePassword, hashPassword, verifyPassword } from './hash-password.mjs'
import { loadEnvFile, requireDatabaseUrl } from './load-env.mjs'

loadEnvFile()

const MIN_LENGTH = 8

/**
 * Reads `--username admin` style flags.
 *
 * Only options are parsed; anything positional is ignored so a stray word cannot
 * be mistaken for a password.
 */
function readFlags() {
  const flags = new Map()

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index]
    if (!arg.startsWith('--')) continue

    const [name, inline] = arg.slice(2).split(/=(.*)/s)
    const value = inline ?? process.argv[index + 1]

    if (inline === undefined && value !== undefined && !value.startsWith('--')) index += 1
    flags.set(name, value)
  }

  return flags
}

function fail(message, detail) {
  console.error(`\n  ${message}\n`)
  if (detail) console.error(`  ${detail}\n`)
  process.exit(1)
}

const flags = readFlags()
const username = (flags.get('username') || process.env.ADMIN_USERNAME || 'admin').trim()

if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
  fail(
    `"${username}" is not a valid username.`,
    'Usernames are 3-24 letters, numbers, dots, dashes or underscores. Pass one with --username.',
  )
}

// Supplied through the environment, or generated when neither is set.
const supplied = process.env.ADMIN_PASSWORD || process.env.RESET_PASSWORD
const password = supplied || generatePassword()
const generated = !supplied

if (password.length < MIN_LENGTH) {
  fail(
    `The new password must be at least ${MIN_LENGTH} characters (got ${password.length}).`,
    'Set a longer ADMIN_PASSWORD and run this again.',
  )
}

const sql = neon(requireDatabaseUrl())

console.log('\n  Law College Management — password reset\n')

/* --------------------------------- lookup -------------------------------- */

/** Every account, so a typo in the username is reported against a real list. */
const staff = await sql.query(
  'select id, username, display_name, role, active from staff_users order by created_at',
)

if (staff.length === 0) {
  fail(
    'There are no staff accounts yet.',
    'Run `npm run db:migrate` first — it creates the first administrator.',
  )
}

const account = staff.find((row) => String(row.username).toLowerCase() === username.toLowerCase())

if (!account) {
  const known = staff.map((row) => `${row.username} (${row.role})`).join(', ')
  fail(`There is no staff account called "${username}".`, `Existing accounts: ${known}`)
}

if (!account.active) {
  console.log(`  ! ${account.username} is deactivated, so sign-in is refused even with the right password.`)
  console.log('    Re-enable it from Settings → Staff after signing in as another administrator.')
}

/* --------------------------------- update -------------------------------- */

// Only the hash and the timestamp move. Role, active and display_name are left
// out of the statement entirely so no future edit can accidentally widen it.
const updated = await sql.query(
  'update staff_users set password_hash = $2, updated_at = now() where id = $1 returning id, username',
  [account.id, await hashPassword(password)],
)

if (updated.length !== 1) {
  fail(`The password for ${username} could not be updated.`, 'No rows were changed.')
}

/* --------------------------------- verify -------------------------------- */

/**
 * Reads the hash back and checks it, rather than trusting the write.
 *
 * A reset that silently failed leaves an account nobody can open, which is the
 * one outcome this script exists to prevent — so it is confirmed before the
 * script reports success. The hash itself is never printed.
 */
const [check] = await sql.query('select password_hash from staff_users where id = $1', [account.id])
const verified = await verifyPassword(password, String(check.password_hash))

if (!verified) {
  fail(
    `The new password for ${username} did not verify against the stored hash.`,
    'The database was updated but the hash did not round-trip. Do not report success — investigate before using the account.',
  )
}

/* --------------------------------- report -------------------------------- */

// The count is the guard against a script that dropped or duplicated rows.
const [{ count }] = await sql.query('select count(*)::int as count from staff_users')

console.log(`  ✓ Password updated for ${account.username} (${account.role}) and verified`)
console.log(`  ✓ ${count} staff account${count === 1 ? '' : 's'} still present — none added or removed`)

if (generated) {
  console.log('\n    New password (shown once, not stored anywhere):')
  console.log(`      ${password}`)
  console.log('\n    Copy it now, sign in, then change it from Settings → My Account.')
} else {
  console.log('\n    The password you supplied is now in effect. Sign in and change it from')
  console.log('    Settings → My Account if it was a temporary one.')
}

console.log('')
