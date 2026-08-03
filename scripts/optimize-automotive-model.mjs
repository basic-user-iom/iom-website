/**
 * Thin redirect — the real optimizer lives under automotive-studio so it
 * resolves that package's @gltf-transform/sharp installs (root copies were
 * producing corrupt WebP bufferViews).
 *
 * Prefer: npm run optimize:automotive
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'automotive-studio', 'scripts', 'optimize-model.mjs')
const child = spawn(process.execPath, [script, ...process.argv.slice(2)], {
  cwd: join(root, 'automotive-studio'),
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', (code) => process.exit(code ?? 1))
