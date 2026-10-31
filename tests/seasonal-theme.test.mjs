import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('../src/seasonal/resolve.ts', import.meta.url))
const compiled = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node' })
const { resolveSeasonalTheme: resolve } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))

test('default/off and unknown or unreviewed holidays never activate', () => {
  for (const configured of ['off', 'default', 'christmas', 'easter', 'lunar-new-year', 'hanukkah', 'missing', 'toString']) {
    assert.equal(resolve({ pathname: '/', configured }), null)
  }
})

test('a manually selected ready theme covers the public shell in every site locale', () => {
  for (const locale of ['', '/de', '/fr', '/es', '/it', '/nl']) {
    for (const route of ['/', '/blog', '/blog/gallery-of-light-sculpture-sound', '/case-studies', '/case-studies/gallery-of-light', '/project-costs', '/start', '/privacy', '/terms', '/cookies']) {
      assert.equal(resolve({ pathname: locale + route, configured: 'halloween' }), 'halloween', locale + route)
    }
  }
})

test('CRM, demos, tools, recordings, unknown routes and iframe documents are excluded', () => {
  for (const pathname of ['/client-login', '/crm-demo', '/r/recording', '/demos/gallery-of-light/', '/demos/robot-cell/', '/demo/icm', '/artist-globe', '/tools/image-prep', '/api/example', '/unrecognized', '/de/client-login', '/fr/demos/foo/']) {
    assert.equal(resolve({ pathname, configured: 'halloween', previewEnabled: true, search: '?iom-season=halloween' }), null, pathname)
  }
  for (const search of ['?embed=1', '?embed', '?embed=0&iom-season=halloween']) {
    assert.equal(resolve({ pathname: '/project-costs', configured: 'halloween', search }), null)
  }
  assert.equal(resolve({ pathname: '/', configured: 'halloween', embedded: true }), null)
})

test('production ignores preview URL and storage, including attempts to override off', () => {
  assert.equal(resolve({ pathname: '/', configured: 'off', search: '?iom-season=halloween', storedPreview: 'halloween' }), null)
  assert.equal(resolve({ pathname: '/', configured: 'halloween', search: '?iom-season=off', storedPreview: 'off' }), 'halloween')
})

test('local preview supports on/off, tab navigation, invalid selection and an explicit default', () => {
  const base = { pathname: '/', configured: 'off', previewEnabled: true }
  assert.equal(resolve({ ...base, search: '?iom-season=halloween' }), 'halloween')
  assert.equal(resolve({ ...base, pathname: '/de/project-costs', storedPreview: 'halloween' }), 'halloween')
  for (const choice of ['off', 'default', 'missing', 'hanukkah', '']) {
    assert.equal(resolve({ ...base, search: '?iom-season=' + choice, storedPreview: 'halloween' }), null)
  }
})
