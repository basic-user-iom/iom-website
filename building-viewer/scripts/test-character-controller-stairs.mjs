import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const result = await build({
  entryPoints: [fileURLToPath(new URL('./character-controller-stair-diagnostic.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  write: false,
  logLevel: 'silent',
})

const output = result.outputFiles[0]
if (!output) throw new Error('Character stair diagnostic produced no executable output')
const source = Buffer.from(output.contents).toString('base64')
await import(`data:text/javascript;base64,${source}`)
