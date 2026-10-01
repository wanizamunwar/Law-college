import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

/**
 * Serves the /api routes during `npm run dev`.
 *
 * Vercel handles them in production; this mounts the exact same handler on the
 * dev server so local development talks to the real database without needing
 * the Vercel CLI.
 */
function apiDevServer(): Plugin {
  return {
    name: 'lcm-api',
    async configureServer(server) {
      const env = loadEnv('', process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (value !== undefined && process.env[key] === undefined) process.env[key] = value
      }

      // Resolved per request rather than once at startup. Vite invalidates its
      // SSR module cache when a file changes, so editing the API while the dev
      // server is running takes effect on the next request instead of needing
      // a restart.
      const resolve = async (): Promise<ApiHandler> => {
        const module_ = (await server.ssrLoadModule('/api/[...path].ts')) as { default: ApiHandler }
        return module_.default
      }

      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (!req.url?.startsWith('/api')) {
            next()
            return
          }

          resolve()
            .then((handle) => handle(req, res))
            .catch((error: unknown) => {
              server.config.logger.error(String(error))
              if (!res.headersSent) {
                res.writeHead(500, { 'content-type': 'application/json' })
              }
              res.end(JSON.stringify({ error: 'The development API server failed to respond.' }))
            })
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDevServer()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
