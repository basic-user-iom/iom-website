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

/**
 * Built CSS is render-blocking by default. Load it async so the critical
 * inline shell in index.html can paint FCP/LCP without waiting on the bundle.
 * Defer *executing* the module entry until after first paint, but keep
 * modulepreload so the ~1MB JS download starts immediately (hard reload
 * otherwise leaves a non-scrollable boot shell while the network is idle).
 */
function nonBlockingCssPlugin() {
  return {
    name: 'non-blocking-css',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      const file = String(ctx?.filename || ctx?.path || '').replace(/\\/g, '/')
      if (
        file.includes('dukta-linar-concept') ||
        file.includes('demos/dukta') ||
        file.includes('kelly-kettle') ||
        file.includes('precision-object')
      ) {
        return html
      }
      let next = html.replace(
        /<link(\s[^>]*?)rel="stylesheet"([^>]*?)>/g,
        (match, before = '', after = '') => {
          if (/media=/.test(match) || /onload=/.test(match)) return match
          const hrefMatch = match.match(/href="([^"]+\.css)"/)
          if (!hrefMatch) return match
          const href = hrefMatch[1]
          return `<link${before}rel="stylesheet"${after} media="print" onload="this.media='all';document.documentElement.classList.add('css-ready')"><noscript><link rel="stylesheet" href="${href}"></noscript>`
        },
      )

      next = next.replace(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/,
        (_m, src) => {
          const href = String(src)
          return `<link rel="modulepreload" crossorigin href="${href}">
    <script>
      (function () {
        var src = ${JSON.stringify(href)};
        // Failsafe if the async stylesheet never fires onload.
        setTimeout(function () {
          document.documentElement.classList.add('css-ready');
        }, 1800);
        function load() {
          var s = document.createElement('script');
          s.type = 'module';
          s.crossOrigin = '';
          s.src = src;
          document.body.appendChild(s);
        }
        // Two rAFs: after style/layout + first paint of the LCP poster.
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () {
            requestAnimationFrame(load);
          });
        } else {
          setTimeout(load, 0);
        }
      })();
    </script>`
        },
      )

      return next
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
    nonBlockingCssPlugin(),
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
