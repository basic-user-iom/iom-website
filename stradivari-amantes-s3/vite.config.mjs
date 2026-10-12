import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/demos/stradivari-amantes-s3/',
  build: { outDir: 'dist', assetsInlineLimit: 0, sourcemap: false },
});
