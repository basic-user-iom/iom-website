import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  base: '/demos/solar-system/',
  publicDir: 'public',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  build: {
    outDir: path.resolve(root, '../public/demos/solar-system'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
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
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/satellite.js')) return 'orbital-propagation'
          if (id.includes('node_modules/react') || id.includes('node_modules/zustand')) {
            return 'app-vendor'
          }
          if (id.includes('spacecraft-trajectories.horizons.v1.json')) return 'spacecraft-data'
          if (id.includes('major-moon-anchors.horizons.v1.json')) return 'moon-anchor-data'
          if (id.includes('/rendering/black-hole/') || id.includes('/simulation/scenarios/black-hole/')) return 'black-hole'
          if (id.includes('/rendering/impact/') || id.includes('/simulation/scenarios/impact/')) return 'impact-studio'
          if (id.includes('/rendering/solar-fate/') || id.includes('/simulation/scenarios/solar-fate/')) return 'solar-fate'
          return undefined
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5194,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5195,
    strictPort: true,
  },
})
