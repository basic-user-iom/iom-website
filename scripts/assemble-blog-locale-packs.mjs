/**
 * Merge batch-*.{de,fr,nl,it,es}.json → src/blog/posts/locales/{lang}.ts
 * Usage: node scripts/assemble-blog-locale-packs.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const batchDir = join(__dirname, '.tmp-blog-batches')
const outDir = join(__dirname, '..', 'src', 'blog', 'posts', 'locales')
const LANGS = ['de', 'fr', 'nl', 'it', 'es']
const EXPORT_NAME = {
  de: 'deDemoBlogPosts',
  fr: 'frDemoBlogPosts',
  nl: 'nlDemoBlogPosts',
  it: 'itDemoBlogPosts',
  es: 'esDemoBlogPosts',
}

function esc(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
}

function asTs(value, indent = 2) {
  const pad = ' '.repeat(indent)
  if (value === null || value === undefined) return 'undefined'
  if (typeof value === 'string') {
    if (value.includes('\n') || value.includes("'") || value.length > 80) {
      return `\`${esc(value)}\``
    }
    return JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    const items = value.map((v) => `${pad}  ${asTs(v, indent + 2)}`).join(',\n')
    return `[\n${items},\n${pad}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (!keys.length) return '{}'
    const body = keys
      .map((k) => {
        const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : JSON.stringify(k)
        return `${pad}  ${key}: ${asTs(value[k], indent + 2)}`
      })
      .join(',\n')
    return `{\n${body},\n${pad}}`
  }
  return JSON.stringify(value)
}

for (const lang of LANGS) {
  const merged = {}
  if (!existsSync(batchDir)) continue
  const files = readdirSync(batchDir)
    .filter((f) => f.endsWith(`.${lang}.json`))
    .sort()
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(batchDir, file), 'utf8'))
    Object.assign(merged, data)
  }
  const count = Object.keys(merged).length
  const exportName = EXPORT_NAME[lang]
  const content = `/* Auto-assembled by scripts/assemble-blog-locale-packs.mjs — do not hand-edit large blocks */
import type { DemoPostLocalePack } from './types'

export const ${exportName}: DemoPostLocalePack = ${asTs(merged, 0)}
`
  writeFileSync(join(outDir, `${lang}.ts`), content)
  console.log(`${lang}: ${count} posts → locales/${lang}.ts`)
}
