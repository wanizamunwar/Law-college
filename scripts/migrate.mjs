/**
 * Creates the schema in Neon and, if the staff_users table is empty, inserts
 * the first administrator account.
 *
 *   npm run db:migrate
 *
 * Reads DATABASE_URL from the environment or from .env.local.
 * Both steps are idempotent — re-running is safe.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { hashPassword } from './hash-password.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/* --------------------------- .env.local loader --------------------------- */

function readEnvFile() {
  for (const name of ['.env.local', '.env']) {
    const path = join(root, name)
    if (!existsSync(path)) continue

    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const separator = line.indexOf('=')
      if (separator === -1) continue

      const key = line.slice(0, separator).trim()
      let value = line.slice(separator + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (key && !(key in process.env)) process.env[key] = value
    }
  }
}

readEnvFile()

/* --------------------------------- run ---------------------------------- */

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error(
    '\n  DATABASE_URL is not set.\n\n' +
      '  Create .env.local in the project root and add your Neon connection string:\n\n' +
      '    DATABASE_URL="postgresql://user:password@ep-xxxx.region.aws.neon.tech/lawcollege?sslmode=require"\n' +
      '    SESSION_SECRET="<any long random string>"\n',
  )
  process.exit(1)
}

const sql = neon(connectionString)

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
} else {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  await sql.query(
    `insert into staff_users (username, display_name, role, password_hash)
     values ($1, $2, 'admin', $3)`,
    [username, 'Registrar', await hashPassword(password)],
  )

  console.log(`  ✓ Created the first administrator — ${username} / ${password}`)
  console.log('    Change this password from Settings after your first sign-in.')
}

if (!process.env.SESSION_SECRET) {
  console.log('\n  ! SESSION_SECRET is not set.')
  console.log('    Sign-in will fall back to a development-only secret and every session will be')
  console.log('    rejected once one is set. Add one to .env.local — see .env.example.\n')
}

console.log('\n  Done.\n')
