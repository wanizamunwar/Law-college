/**
 * Catch-all API entry point.
 *
 * Vercel routes every request under /api here. The same handler is mounted on
 * the Vite dev server (see vite.config.ts), so `npm run dev` talks to the real
 * database without needing the Vercel CLI.
 */

import { createRouter } from './_lib/http'
import { currentUser } from './_lib/auth'
import { routes } from './_lib/routes'

const handle = createRouter(routes, currentUser)

export default handle
