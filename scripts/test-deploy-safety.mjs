#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  inferDeployScope,
  invalidFilesForScope,
  isValidProjectSlug,
  matchesDeployScope,
} from './deploy-scope.mjs'

assert.equal(
  inferDeployScope([
    'automotive-studio/src/studio-main.ts',
    'public/demos/automotive-studio/index.html',
  ]),
  'automotive-studio',
)

assert.equal(
  inferDeployScope([
    'public/demos/ssr-denoise/index.html',
    'public/demos/ssr-denoise/assets/scene.glb',
  ]),
  'demo:ssr-denoise',
)

assert.equal(
  inferDeployScope([
    'trail-designs-prototype/src/app.js',
    'public/demos/trail-designs-prototype/index.html',
    'scripts/build-trail-designs-prototype.mjs',
  ]),
  'project:trail-designs-prototype',
)

assert.equal(
  inferDeployScope([
    'automotive-studio/src/studio-main.ts',
    'src/crm/DemosView.tsx',
  ]),
  null,
)

assert.deepEqual(
  invalidFilesForScope([
    'public/demos/automotive-studio/index.html',
    'src/data/projects.ts',
  ], 'automotive-studio'),
  ['src/data/projects.ts'],
)

assert.equal(matchesDeployScope('trail-designs-prototype/src/app.js', 'project:trail-designs-prototype'), true)
assert.equal(matchesDeployScope('public/demos/trail-designs-prototype/index.html', 'project:trail-designs-prototype'), true)
assert.equal(isValidProjectSlug('trail-designs-prototype'), true)
assert.equal(isValidProjectSlug('src'), false)
assert.equal(matchesDeployScope('src/crm/DemosView.tsx', 'project:src'), false)
assert.equal(matchesDeployScope('src/crm/DemosView.tsx', 'site'), true)
assert.equal(matchesDeployScope('public/demos/foo/index.html', 'demo:../foo'), false)
assert.equal(matchesDeployScope('src/crm/emailAttachments.ts', 'crm'), true)
assert.equal(matchesDeployScope('api/_lib/email-attachments.js', 'crm'), true)
assert.equal(matchesDeployScope('api/crm-send-email.js', 'crm'), true)
assert.equal(matchesDeployScope('src/data/projects.ts', 'crm'), false)
assert.equal(matchesDeployScope('solar-system/src/app/AppShell.tsx', 'project:solar-system'), true)
assert.equal(matchesDeployScope('public/demos/solar-system/index.html', 'project:solar-system'), true)
assert.equal(matchesDeployScope('.vercelignore', 'project:solar-system'), true)
assert.equal(matchesDeployScope('scripts/deploy-production.mjs', 'project:solar-system'), true)
assert.equal(matchesDeployScope('scripts/pre-deploy-check.mjs', 'project:solar-system'), true)
assert.equal(matchesDeployScope('public/models/icm-ext-v2/model-web.glb', 'project:solar-system'), false)
assert.equal(
  inferDeployScope([
    '.vercelignore',
    'solar-system/src/app/AppShell.tsx',
    'public/demos/solar-system/index.html',
    'scripts/deploy-production.mjs',
    'scripts/deploy-scope.mjs',
    'scripts/pre-deploy-check.mjs',
    'scripts/test-deploy-safety.mjs',
  ]),
  'project:solar-system',
)
assert.equal(
  inferDeployScope([
    'src/crm/emailAttachments.ts',
    'src/crm/EmailAttachmentsField.tsx',
    'api/_lib/email-attachments.js',
    'api/crm-send-email.js',
    'scripts/deploy-scope.mjs',
  ]),
  'crm',
)

for (const file of ['src/data/projects.ts', ...['de', 'nl', 'fr', 'it', 'es'].map(lang => 'src/i18n/projects/' + lang + '.ts'), 'public/assets/posters/solar-system.webp', 'public/assets/posters/solar-system-400.webp']) {
  assert.equal(matchesDeployScope(file, 'project:solar-system'), true)
}
for (const file of ['src/crm/DemosView.tsx', 'public/assets/posters/streets-gl.webp', 'public/demos/automotive-studio/index.html']) {
  assert.equal(matchesDeployScope(file, 'project:solar-system'), false)
}

console.log('Deploy scope safety tests passed.')
