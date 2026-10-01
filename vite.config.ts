import { defineConfig, loadEnv } from 'vite'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>
type Next = (error?: unknown) => void

const API_ENTRY = '/api/[...path].ts'

/**
 * Serves the /api routes during `npm run dev` and `npm run preview`.
 *
 * Vercel handles them in production; this mounts the exact same handler on the
 * local server so development talks to the real database without needing the
 * Vercel CLI.
 */
function apiDevServer(): Plugin {
  const mount = (server: ViteDevServer | PreviewServer, resolve: () => Promise<ApiHandler>) => {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: Next) => {
      // Anything that is not an API call belongs to the static/asset handler.
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
          res.end(JSON.stringify({ error: 'The local API server failed to respond.' }))
        })
    })
  }

  return {
    name: 'lcm-api',
    configureServer(server) {
      loadDotEnv()

      // Resolved per request rather than once at startup. Vite invalidates its
      // SSR module cache when a file changes, so editing the API while the dev
      // server is running takes effect on the next request instead of needing
      // a restart.
      mount(server, async () => {
        const module_ = (await server.ssrLoadModule(API_ENTRY)) as { default: ApiHandler }
        return module_.default
      })
    },

    configurePreviewServer(server) {
      loadDotEnv()

      // The preview server has no SSR module loader, so Node imports the
      // TypeScript handler itself using native type stripping (Node 22.6+).
      // This matters: `vite preview` only serves `dist`, so without mounting
      // the API every /api call 404s and no part of the app works.
      mount(server, async () => {
        const entry = pathToFileURL(path.join(process.cwd(), API_ENTRY)).href
        const module_ = (await import(entry)) as { default: ApiHandler }
        return module_.default
      })
    },
  }
}

function loadDotEnv(): void {
  const env = loadEnv('', process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && process.env[key] === undefined) process.env[key] = value
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
