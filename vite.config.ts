// @ts-nocheck — Vite config; blog API plugin is plain .mjs
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { blogApiDevPlugin } from './scripts/vite-blog-api-plugin.mjs'

export default defineConfig({
  plugins: [react(), blogApiDevPlugin()],
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
