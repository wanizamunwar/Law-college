/**
 * The API handler.
 *
 * Lives outside `api/` on purpose. Vercel turns every file under `api/` into a
 * serverless function and routes to it by path, so it needs one file per route;
 * the thin files in `api/` all re-export this handler and let it decide which
 * route a request belongs to.
 *
 * It deliberately does not live in `api/[...path].ts`: that catch-all only
 * matches a single path segment on Vercel, which 404s every multi-segment route
 * such as `POST /api/auth/login`. It works under the Vite dev server, which is
 * exactly why the failure was invisible until deployment.
 */

import { createRouter } from '../api/_lib/http.ts'
import { currentUser } from '../api/_lib/auth.ts'
import { routes } from '../api/_lib/routes.ts'

const handle = createRouter(routes, currentUser)

export default handle