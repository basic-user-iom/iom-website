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

console.log('Deploy scope safety tests passed.')
