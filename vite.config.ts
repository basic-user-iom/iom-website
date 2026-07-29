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

/**
 * Built CSS is render-blocking by default. Load it async so the critical
 * inline shell in index.html can paint FCP/LCP without waiting on the bundle.
 * Also defer the module entry until after the first paint so the LCP image
 * is not blocked by parsing ~1MB of JS on mobile CPUs.
 */
function nonBlockingCssPlugin() {
  return {
    name: 'non-blocking-css',
    enforce: 'post',
    transformIndexHtml(html) {
      let next = html.replace(
        /<link(\s[^>]*?)rel="stylesheet"([^>]*?)>/g,
        (match, before = '', after = '') => {
          if (/media=/.test(match) || /onload=/.test(match)) return match
          const hrefMatch = match.match(/href="([^"]+\.css)"/)
          if (!hrefMatch) return match
          const href = hrefMatch[1]
          return `<link${before}rel="stylesheet"${after} media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${href}"></noscript>`
        },
      )

      next = next.replace(/<link rel="modulepreload"[^>]*>\s*/g, '')

      next = next.replace(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/,
        (_m, src) => `<script>
      (function () {
        var src = ${JSON.stringify(String(src))};
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
    </script>`,
      )

      return next
    },
  }
}

export default defineConfig({
  plugins: [react(), demoDirectoryIndexPlugin(), blogApiDevPlugin(), nonBlockingCssPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
