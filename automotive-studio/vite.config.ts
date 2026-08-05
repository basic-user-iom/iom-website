import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

/**
 * Dual-entry Automotive Studio build.
 * Studio and Presentation share schema/runtime modules; Presentation must not
 * pull authoring-only UI (keep imports separated by entry).
 */
export default defineConfig({
  root,
  base: '/demos/automotive-studio/',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  build: {
    outDir: path.resolve(root, '../public/demos/automotive-studio'),
    emptyOutDir: true,
    // Production: no public source maps (audit §12.1). Use `sourcemap: true` locally via CLI if needed.
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        studio: path.resolve(root, 'index.html'),
        presentation: path.resolve(root, 'presentation.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('/src/persistence/') || id.includes('/src/transport/')) {
            return 'runtime-core'
          }
          return undefined
        },
      },
    },
  },
  server: {
    port: 5190,
    strictPort: true,
  },
  preview: {
    port: 5191,
    strictPort: true,
  },
})
