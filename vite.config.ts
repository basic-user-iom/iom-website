// @ts-nocheck — Vite config; blog API plugin is plain .mjs
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { blogApiDevPlugin } from './scripts/vite-blog-api-plugin.mjs'

/**
 * Vite SPA fallback otherwise serves the React app for `/demos/foo/`.
 * Rewrite those directory URLs to the static `index.html` under public/.
 */
function demoDirectoryIndexPlugin() {
  const rewrite = (req) => {
    if (!req.url) return
    const q = req.url.indexOf('?')
    const pathname = q === -1 ? req.url : req.url.slice(0, q)
    const search = q === -1 ? '' : req.url.slice(q)
    if (!pathname.startsWith('/demos/')) return
    if (/\.[a-zA-Z0-9]+$/.test(pathname)) return
    const base = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    req.url = `${base}/index.html${search}`
  }

  return {
    name: 'demo-directory-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req)
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req)
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), demoDirectoryIndexPlugin(), blogApiDevPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
})
