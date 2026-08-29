import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const sitePublic = path.resolve(root, '../public')

/**
 * During package-local `vite` / `preview`, serve shared site assets
 * (`/models`, `/demos/ssr-denoise/...`) from the repo `public/` folder.
 */
function serveSitePublicPlugin() {
  const mime: Record<string, string> = {
    '.json': 'application/json',
    '.glb': 'model/gltf-binary',
    '.txt': 'text/plain',
    '.hdr': 'application/octet-stream',
    '.exr': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }

  const serve = (req: { url?: string }, res: import('http').ServerResponse, next: () => void) => {
    if (!req.url) return next()
    const urlPath = decodeURIComponent((req.url.split('?')[0] || '').replace(/\\/g, '/'))
    if (!(urlPath.startsWith('/models/') || urlPath === '/models' || urlPath.startsWith('/demos/') || urlPath.startsWith('/basis/') || urlPath.startsWith('/draco/'))) {
      return next()
    }
    const filePath = path.resolve(sitePublic, `.${urlPath}`)
    if (!filePath.startsWith(sitePublic)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404
      res.end('Not found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const stat = fs.statSync(filePath)
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
    // Required for XHR/GLTFLoader progress (lengthComputable + %)
    res.setHeader('Content-Length', String(stat.size))
    res.setHeader('Accept-Ranges', 'bytes')
    fs.createReadStream(filePath).pipe(res)
  }

  return {
    name: 'serve-site-public',
    configureServer(server: { middlewares: { use: (fn: typeof serve) => void } }) {
      server.middlewares.use(serve)
    },
    configurePreviewServer(server: { middlewares: { use: (fn: typeof serve) => void } }) {
      server.middlewares.use(serve)
    },
  }
}

export default defineConfig(({ command }) => ({
  root,
  envDir: path.resolve(root, '..'),
  base: command === 'serve' ? '/' : '/demos/icm-building/',
  publicDir: 'public',
  plugins: [serveSitePublicPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  build: {
    outDir: path.resolve(root, '../public/demos/icm-building'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: path.resolve(root, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/three-mesh-bvh')) return 'bvh'
          if (id.includes('node_modules/three')) return 'three'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5192,
    strictPort: true,
  },
  preview: {
    port: 5193,
    strictPort: true,
  },
}))
