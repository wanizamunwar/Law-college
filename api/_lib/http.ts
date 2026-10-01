/**
 * Minimal HTTP plumbing for the API functions.
 *
 * Deliberately built on Node's own request/response objects so the same
 * handler runs unchanged on Vercel and on the Vite dev server.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SessionUser } from './types.ts'

/** Viewers may read; registrars and admins may write. */
function canWrite(user: SessionUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'registrar'
}

/** An error with an HTTP status, thrown by handlers and turned into JSON. */
export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export function unauthorized(message = 'Sign in to continue.'): HttpError {
  return new HttpError(401, message)
}

export function forbidden(message = 'Your account does not have access to this action.'): HttpError {
  return new HttpError(403, message)
}

export function notFound(message = 'Record not found.'): HttpError {
  return new HttpError(404, message)
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message)
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message)
}

/* -------------------------------------------------------------- responses --- */

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload ?? null)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

export function sendBuffer(
  res: ServerResponse,
  status: number,
  body: Buffer,
  contentType: string,
  fileName?: string,
): void {
  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': String(body.length),
    'cache-control': 'no-store',
  }

  if (fileName) {
    // Plain ASCII names stay readable; anything else is encoded.
    const safe = /^[\x20-\x7e]+$/.test(fileName) ? fileName : encodeURIComponent(fileName)
    headers['content-disposition'] = `inline; filename="${safe.replace(/"/g, '')}"`
  }

  res.writeHead(status, headers)
  res.end(body)
}

/* --------------------------------------------------------------- requests --- */

const MAX_JSON_BYTES = 6 * 1024 * 1024

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req, MAX_JSON_BYTES)
  if (raw.length === 0) return {} as T

  try {
    return JSON.parse(raw.toString('utf8')) as T
  } catch {
    throw badRequest('The request body is not valid JSON.')
  }
}

/**
 * Reads the raw request body.
 *
 * Vercel pre-buffers binary uploads into `req.body`; the dev server does not,
 * so the stream is drained as a fallback.
 *
 * An oversized body is drained rather than cut off: destroying the socket
 * mid-upload makes the client see a dropped connection instead of the 413.
 * Draining is capped, so a client that never stops sending is still dropped.
 */
export async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const preloaded = (req as IncomingMessage & { body?: unknown }).body

  if (Buffer.isBuffer(preloaded)) return preloaded
  if (typeof preloaded === 'string') return Buffer.from(preloaded)
  if (preloaded instanceof Uint8Array) return Buffer.from(preloaded)

  // Anything past this is not a legitimate upload, it is a runaway stream.
  const hardCeiling = Math.max(limit * 4, limit + 8 * 1024 * 1024)

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let tooLarge = false

    const tooLargeError = (): HttpError =>
      new HttpError(413, `That request is too large. The limit is ${Math.round(limit / 1024 / 1024)} MB.`)

    req.on('data', (chunk: Buffer) => {
      size += chunk.length

      if (size > hardCeiling) {
        req.destroy()
        reject(tooLargeError())
        return
      }

      // Past the limit the bytes are discarded, but the stream is still read
      // to the end so the client can finish sending and read the 413.
      if (size > limit) {
        tooLarge = true
        chunks.length = 0
        return
      }

      chunks.push(chunk)
    })

    req.on('end', () => (tooLarge ? reject(tooLargeError()) : resolve(Buffer.concat(chunks))))
    req.on('error', reject)
  })
}

/* ----------------------------------------------------------------- router --- */

export interface RequestContext {
  req: IncomingMessage
  res: ServerResponse
  /** Path segments after `/api`, e.g. ['applications', 'abc']. */
  params: string[]
  query: URLSearchParams
  user: SessionUser | null
  json: <T>() => Promise<T>
  body: (limit?: number) => Promise<Buffer>
  /** Reads a required query parameter. */
  param: (name: string) => string
}

export type Handler = (ctx: RequestContext) => Promise<void>

interface Route {
  method: string
  /** Segments; `:name` captures one segment. */
  path: string[]
  /** Where the handler is allowed to run. */
  access: 'public' | 'signed-in' | 'write' | 'admin'
  handler: Handler
}

/** Skips the signing work for endpoints that do not need a user. */
function needsUser(access: Route['access']): boolean {
  return access !== 'public'
}

/* ---------------------------------------------------------------- routing --- */

/**
 * Builds the router. `resolveUser` is called lazily so public endpoints never
 * touch the database.
 */
export function createRouter(
  routes: Route[],
  resolveUser: (headers: IncomingMessage['headers']) => Promise<SessionUser | null>,
) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const segments = url.pathname.split('/').filter(Boolean).slice(1) // drop 'api'

      const match = matchRoute(routes, req.method ?? 'GET', segments)
      if (!match) {
        sendJson(res, 404, { error: `No API route matches ${req.method} /api/${segments.join('/')}` })
        return
      }

      const { route, params } = match

      const user = needsUser(route.access)
        ? await resolveUser(req.headers)
        : null

      // A stale token must not silently act as signed-out on a write: tell the
      // browser to drop the session instead of returning a bare 401.
      if (needsUser(route.access) && !user) {
        sendJson(res, 401, { error: 'Your session has expired. Please sign in again.' })
        return
      }

      if (route.access === 'write' && !canWrite(user)) {
        sendJson(res, 403, {
          error: 'Your account is read-only. Ask an administrator for editing access.',
        })
        return
      }

      if (route.access === 'admin' && user?.role !== 'admin') {
        sendJson(res, 403, { error: 'Only an administrator can do this.' })
        return
      }

      const query = url.searchParams

      const ctx: RequestContext = {
        req,
        res,
        params,
        query,
        user,
        json: <T,>() => readJson<T>(req),
        body: (limit = MAX_JSON_BYTES) => readBody(req, limit),
        param: (name: string) => {
          const value = query.get(name)
          if (!value) throw badRequest(`Missing required "${name}" parameter.`)
          return value
        },
      }

      await route.handler(ctx)
    } catch (error) {
      handleError(res, error)
    }
  }
}

function matchRoute(
  routes: Route[],
  method: string,
  segments: string[],
): { route: Route; params: string[] } | null {
  for (const route of routes) {
    if (route.method !== method) continue
    if (route.path.length !== segments.length) continue

    const params: string[] = []
    let matched = true

    for (let index = 0; index < route.path.length; index += 1) {
      const part = route.path[index]
      if (part.startsWith(':')) {
        params.push(segments[index])
      } else if (part !== segments[index]) {
        matched = false
        break
      }
    }

    if (matched) return { route, params }
  }

  return null
}

/** Turns anything thrown by a handler into a clean JSON error. */
export function handleError(res: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.message })
    return
  }

  const message = error instanceof Error ? error.message : String(error)

  // Postgres reports the useful part of a constraint violation in `detail`,
  // not `message`, and the Neon driver keeps the two as separate fields — so
  // both are searched, and the SQLSTATE is used when it is available.
  const fields = error instanceof Error ? (error as { detail?: unknown; code?: unknown }) : {}
  const detail = String(fields.detail ?? '')
  const code = String(fields.code ?? '')
  const haystack = `${message} ${detail}`

  // Postgres constraint violations are a client problem, not a server fault.
  if (code === '23505' || /duplicate key value violates unique constraint/i.test(haystack)) {
    sendJson(res, 409, { error: 'That value is already in use.' })
    return
  }

  if (code === '23503' || /violates foreign key constraint/i.test(haystack)) {
    // Postgres says which way the constraint failed. On an insert or update the
    // row we sent points at something that is not there — that is the caller's
    // mistake. Only a delete can be blocked by rows still pointing at it.
    const missingTable = /is not present in table "([^"]+)"/i.exec(haystack)?.[1]
    if (missingTable) {
      sendJson(res, 400, {
        error: `That ${singular(missingTable)} no longer exists. Reload the page and try again.`,
      })
      return
    }

    sendJson(res, 409, { error: 'That record is still referenced by other records.' })
    return
  }

  if (code === '23514' || /violates check constraint/i.test(haystack)) {
    sendJson(res, 400, { error: 'One of the submitted values is not allowed.' })
    return
  }

  if (code === '23502' || /violates not-null constraint/i.test(haystack)) {
    const column = (error as { column?: unknown }).column
    sendJson(res, 400, {
      error: `A required value was missing${column ? ` (${String(column)})` : ''}.`,
    })
    return
  }

  console.error('[api] unhandled error:', error)
  sendJson(res, 500, {
    error: 'Something went wrong while saving. Please try again.',
    detail: process.env.NODE_ENV === 'development' ? message : undefined,
  })
}

/* ------------------------------------------------------------ input checks --- */

/** "programs" -> "program". Only used for human-readable error messages. */
function singular(table: string): string {
  return table.endsWith('ies') ? `${table.slice(0, -3)}y` : table.replace(/s$/, '')
}

export function requireFields(
  body: Record<string, unknown>,
  fields: string[],
): void {
  const missing = fields.filter((field) => {
    const value = body[field]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw badRequest(`Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`)
  }
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}
