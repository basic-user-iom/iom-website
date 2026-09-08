// @ts-nocheck — Vite config; blog API plugin is plain .mjs
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { blogApiDevPlugin } from './scripts/vite-blog-api-plugin.mjs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

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
    // Nested SPA routes for the dukta website prototype.
    if (pathname === '/demos/dukta' || pathname.startsWith('/demos/dukta/')) {
      req.url = `/demos/dukta/index.html${search}`
      return
    }
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

function projectCostsPrerenderPlugin() {
  return {
    name: 'emit-project-costs-html',
    apply: 'build',
    async closeBundle() {
      execSync('node scripts/emit-project-costs-html.mjs', { stdio: 'inherit' })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    demoDirectoryIndexPlugin(),
    blogApiDevPlugin(),
    projectCostsPrerenderPlugin(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
        duktaLinarConcept: path.resolve(root, 'demos/dukta-linar-concept/index.html'),
        duktaWebsite: path.resolve(root, 'demos/dukta/index.html'),
        kellyKettle: path.resolve(root, 'demos/kelly-kettle/index.html'),
        precisionObject: path.resolve(root, 'demos/precision-object/index.html'),
        floatingStone: path.resolve(root, 'demos/floating-stone/index.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
