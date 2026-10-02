/**
 * Creates the schema in Neon and, if the staff_users table is empty, inserts
 * the first administrator account.
 *
 *   npm run db:migrate
 *
 * Reads DATABASE_URL from the environment or from .env.local.
 * Both steps are idempotent — re-running is safe.
 *
 * Existing staff accounts are never touched, so this is not the way to recover
 * a lost password. Use `npm run db:reset-password` for that.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'
import { hashPassword, generatePassword } from './hash-password.mjs'
import { loadEnvFile, projectRoot, requireDatabaseUrl } from './load-env.mjs'

const root = projectRoot

loadEnvFile()

/* --------------------------------- run ---------------------------------- */

const sql = neon(requireDatabaseUrl())

/**
 * The HTTP driver runs one statement per round trip and cannot open a
 * multi-statement transaction, so the file is split on statement boundaries
 * and executed sequentially.
 */
function splitStatements(sqlText) {
  return sqlText
    .split(/^\s*--.*$/gm)
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

console.log('\n  Law College Management — database setup\n')

const schema = readFileSync(join(root, 'db', 'schema.sql'), 'utf8')
const statements = splitStatements(schema)

for (const statement of statements) {
  try {
    await sql.query(statement)
  } catch (error) {
    console.error(`\n  Failed while running:\n\n${statement}\n`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}

console.log(`  ✓ ${statements.length} schema statements applied`)

/* --------------------------- First administrator ------------------------- */

const [{ count }] = await sql.query('select count(*)::int as count from staff_users')

if (count > 0) {
  console.log(`  ✓ ${count} staff account${count === 1 ? '' : 's'} already exist — left untouched`)
  console.log('    Forgotten a password? Run: npm run db:reset-password')
} else {
  const username = process.env.ADMIN_USERNAME || 'admin'

  // A configured password is used as given; otherwise one is generated. There is
  // deliberately no hard-coded default — a password committed to this
  // repository is a password on every clone of it.
  const configured = process.env.ADMIN_PASSWORD
  const password = configured || generatePassword()

  await sql.query(
    `insert into staff_users (username, display_name, role, password_hash)
     values ($1, $2, 'admin', $3)`,
    [username, 'Registrar', await hashPassword(password)],
  )

  console.log(`  ✓ Created the first administrator — ${username}`)
  if (configured) {
    console.log('    Password taken from ADMIN_PASSWORD in your environment.')
  } else {
    console.log('    New password (shown once, not stored anywhere):')
    console.log(`      ${password}`)
  }
  console.log('    Change this password from Settings after your first sign-in.')
}

if (!process.env.SESSION_SECRET) {
  console.log('\n  ! SESSION_SECRET is not set.')
  console.log('    Sign-in will fall back to a development-only secret and every session will be')
  console.log('    rejected once one is set. Add one to .env.local — see .env.example.\n')
}

console.log('\n  Done.\n')
