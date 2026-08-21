/**
 * URL scheme allowlist for hotspot CTAs / link.open.
 * Run: npx tsx src/tests/safeUrls.ts
 */
import assert from 'node:assert/strict'
import { isAllowedExternalUrl, sanitizeExternalUrl } from '../persistence/safeUrls'
import { sanitizeProjectUrls } from '../persistence/sanitizeProjectUrls'
import { createEmptyProject } from '../persistence/schema'
import { migrateProject } from '../persistence/migrations'

assert.equal(isAllowedExternalUrl('https://iobjectm.com/demo'), true)
assert.equal(isAllowedExternalUrl('http://localhost:5173/x'), true)
assert.equal(isAllowedExternalUrl('mailto:hi@example.com'), true)
assert.equal(isAllowedExternalUrl('tel:+15551212'), true)
assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false)
assert.equal(isAllowedExternalUrl('data:text/html,<h1>x</h1>'), false)
assert.equal(isAllowedExternalUrl('vbscript:msgbox(1)'), false)
assert.equal(isAllowedExternalUrl(''), false)
assert.equal(sanitizeExternalUrl('  javascript:evil  '), null)
assert.equal(sanitizeExternalUrl('https://ok.example/a'), 'https://ok.example/a')

const project = createEmptyProject('URL sanitize')
project.hotspots.push({
  id: 'h1',
  name: 'Bad',
  markerLabel: '1',
  anchor: {
    assetFingerprint: '',
    node: {},
    localPosition: [0, 1, 0],
    localNormal: [0, 1, 0],
    offset: 0.05,
  },
  blocks: [
    { type: 'cta', label: 'Safe', url: 'https://example.com' },
    { type: 'cta', label: 'Evil', url: 'javascript:alert(1)' },
  ],
  actions: [
    { type: 'link.open', url: 'https://ok.example' },
    { type: 'link.open', url: 'data:text/html,x' },
  ],
  exploreVisible: true,
  closeBehavior: 'keep-state',
})

sanitizeProjectUrls(project)
const cta = project.hotspots[0].blocks.filter((b) => b.type === 'cta')
assert.equal(cta[0].type === 'cta' && cta[0].url, 'https://example.com')
assert.equal(cta[1].type === 'cta' && cta[1].url, '')
assert.equal(project.hotspots[0].actions.length, 1)
assert.equal(project.hotspots[0].actions[0].type, 'link.open')

const migrated = migrateProject(JSON.parse(JSON.stringify(project)))
assert.ok(
  migrated.hotspots[0].blocks.every(
    (b) => b.type !== 'cta' || !b.url.startsWith('javascript:'),
  ),
)

console.log('safeUrls: ok')
