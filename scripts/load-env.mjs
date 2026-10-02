/**
 * Loads .env.local / .env into process.env for the maintenance scripts.
 *
 * The API reads its configuration from the platform environment, but the
 * scripts under scripts/ also have to work on a laptop, where the values live
 * in .env.local. Values already present in the real environment win, so CI and
 * Vercel are never overridden by a file on disk.
 *
 * Only the scripts import this. Nothing under api/ or src/ ever sees it, so no
 * secret can reach the browser through it.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Strips one layer of matching quotes, so `KEY="a=b"` keeps its value intact. */
function unquote(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

function readEnvFile(name) {
  const path = join(root, name)
  if (!existsSync(path)) return

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    if (!key || key in process.env) continue

    process.env[key] = unquote(line.slice(separator + 1).trim())
  }
}

/** Loads .env.local first, then .env. Safe to call more than once. */
export function loadEnvFile() {
  readEnvFile('.env.local')
  readEnvFile('.env')
}

/** The project root, for scripts that read files such as db/schema.sql. */
export const projectRoot = root

/**
 * Returns DATABASE_URL or exits with the setup instructions.
 *
 * The connection string is the one secret a script cannot work without, and it
 * must never be echoed back, so the error explains what is missing rather than
 * what was found.
 */
export function requireDatabaseUrl() {
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

  return connectionString
}
