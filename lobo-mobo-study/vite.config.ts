import { defineConfig } from 'vite';

export default defineConfig({
  root: 'app',
  base: './',
  server: { host: '127.0.0.1', fs: { deny: ['**/.git/**', '**/qa/**', '**/*.blend', '**/*manifest*.json', '**/02_Cursor_prompt.txt', '**/CURSOR_HANDOFF.txt'] } },
  build: { outDir: '../dist', emptyOutDir: true, rollupOptions: { output: { manualChunks: { three: ['three'] } } } }
});
