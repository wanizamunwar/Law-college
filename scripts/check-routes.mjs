/**
 * Checks that every route in the router has a Vercel function file, and that
 * every function file belongs to a route.
 *
 * Vercel maps one file per route out of `api/`, and its catch-all only matches a
 * single path segment. A route added to `routes.ts` without a matching file is
 * therefore invisible until deployment, where it returns a bare 404 that looks
 * like a network problem. This runs as part of the build so that cannot ship.
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const routesFile = path.join(root, 'api', '_lib', 'routes.ts')

const source = readFileSync(routesFile, 'utf8')

/**
 * Reads the `path: [...]` array that follows each `method:` in the route table.
 * The table is a literal, so a targeted scan is enough and avoids importing the
 * module, which would need the database environment to load.
 */
function declaredRoutes() {
  const found = []
  const pattern = /method:\s*'(\w+)'\s*,\s*\n\s*path:\s*\[([^\]]*)\]/g

  for (const match of source.matchAll(pattern)) {
    const [, method, raw] = match
    const segments = [...raw.matchAll(/'([^']+)'/g)].map((part) => part[1])
    if (segments.length > 0) found.push({ method, segments })
  }

  return found
}

/**
 * `['auth', ':id', 'status']` -> `api/auth/[id]/status.ts`
 *
 * Forward slashes on purpose: `walk()` reports the same way, and a separator
 * mismatch here would make every file look like an orphan.
 */
function fileFor(segments) {
  const parts = segments.map((segment) => (segment.startsWith(':') ? `[${segment.slice(1)}]` : segment))
  return `api/${parts.join('/')}.ts`
}

const routes = declaredRoutes()
if (routes.length === 0) {
  console.error('check-routes: found no routes in api/_lib/routes.ts — the scan is broken.')
  process.exit(1)
}

// Several methods can share one file, so collapse to unique paths.
const expected = [...new Set(routes.map((route) => fileFor(route.segments)))]
const missing = expected.filter((file) => !existsSync(path.join(root, ...file.split('/'))))

// The reverse: a file Vercel will deploy that the router never answers.
const apiDir = path.join(root, 'api')
const { readdirSync } = await import('node:fs')

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // `_lib` holds the implementation, not functions, and Vercel ignores it.
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.name.endsWith('.ts')) acc.push(path.relative(root, full).replace(/\\/g, '/'))
  }
  return acc
}

const orphans = walk(apiDir).filter((file) => !expected.includes(file))

if (missing.length > 0 || orphans.length > 0) {
  console.error('check-routes failed.\n')
  for (const file of missing) {
    console.error(`  missing: ${file}  — a route in routes.ts has no Vercel function file`)
  }
  for (const file of orphans) {
    console.error(`  orphan:  ${file}  — Vercel deploys this, but the router never answers it`)
  }
  console.error('\nOne file per route under api/, each re-exporting server/handler.ts.')
  process.exit(1)
}

console.log(`check-routes: ${routes.length} routes across ${expected.length} files, all wired up.`)