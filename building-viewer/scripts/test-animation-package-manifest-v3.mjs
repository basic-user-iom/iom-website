import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANIMATION_PACKAGE_HARD_LIMITS,
  assertAnimationPackageManifestV3,
  localAssetPath,
  validateAnimationPackageManifestV3,
} from './validate-animation-package-manifest-v3.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')
const PILOT_PATH = join(SCRIPT_DIR, 'fixtures', 'animation-package-manifest-v3-disabled-pilot.json')
const PRODUCTION_MANIFEST_PATH = join(PROJECT_DIR, '..', 'public', 'models', 'manifest.json')
const pilot = JSON.parse(await readFile(PILOT_PATH, 'utf8'))

function allAssets(manifest) {
  const result = [manifest.source.variants.web, manifest.source.variants.quest, manifest.rig]
  for (const pkg of manifest.packages) {
    for (const variant of ['web', 'quest']) {
      for (const level of ['lod0', 'hlod']) {
        const payload = pkg.variants?.[variant]?.[level]
        if (payload) result.push(payload)
      }
    }
  }
  return result
}

const observedHashes = Object.fromEntries(allAssets(pilot).map((asset) => [asset.url, asset.sha256]))
const observedBytes = Object.fromEntries(
  allAssets(pilot)
    .filter((asset) => asset === pilot.rig || asset.estimates)
    .map((asset) => [asset.url, asset === pilot.rig ? asset.bytes : asset.estimates.bytes]),
)
const validationOptions = { observedHashes, observedBytes, requireHashVerification: true }

assert.throws(() => localAssetPath('../escape.glb', PILOT_PATH), /escapes its verification root/)
assert.throws(() => localAssetPath('/../escape.glb', PILOT_PATH, PROJECT_DIR), /escapes its verification root/)
assert.equal(localAssetPath('payload.glb', PILOT_PATH), join(dirname(PILOT_PATH), 'payload.glb'))

function clonePilot() {
  return structuredClone(pilot)
}

function expectInvalid(name, mutate, expected) {
  const candidate = clonePilot()
  mutate(candidate)
  const result = validateAnimationPackageManifestV3(candidate, validationOptions)
  assert.equal(result.valid, false, `${name} unexpectedly passed`)
  assert.match(result.errors.join('\n'), expected, name)
}

// The revised contract remains dormant and production routing stays untouched.
assert.equal(pilot.enabled, false)
assert.equal(pilot.packages[2].variants.web.hlod, undefined, 'per-detail HLOD must remain optional')
assert.equal(
  pilot.packages.every((pkg) => !pkg.requiredAttributes.includes('TEXCOORD_0')),
  true,
  'texture coordinates must be required per textured primitive, not globally',
)
const productionManifest = JSON.parse(await readFile(PRODUCTION_MANIFEST_PATH, 'utf8'))
const productionAnimated = productionManifest.models.find((entry) => entry.id === 'icm-anim-2025')
assert.ok(productionAnimated, 'production icm-anim-2025 route is missing')
assert.equal(Object.hasOwn(productionAnimated, 'cellManifest'), false)
assert.equal(Object.hasOwn(productionAnimated, 'cellManifestQuest'), false)
assert.equal(Object.hasOwn(productionAnimated, 'hlodStreaming'), false)

const valid = validateAnimationPackageManifestV3(pilot, validationOptions)
assert.deepEqual(valid.errors, [])
assert.equal(valid.valid, true)
assert.equal(valid.summary.packageCount, 3)
assert.equal(valid.summary.ownerCount, 1)
assert.deepEqual(valid.summary.alwaysResidentShellTriangles, { web: 12, quest: 12 })
assert.deepEqual(valid.summary.resident.web, {
  triangles: 24,
  draws: 2,
  bytes: 203,
  encodedTextureBytes: 0,
  gpuTextureBytes: 0,
})
assert.deepEqual(valid.summary.resident.quest, {
  triangles: 24,
  draws: 2,
  bytes: 203,
  encodedTextureBytes: 0,
  gpuTextureBytes: 0,
})
assert.deepEqual(assertAnimationPackageManifestV3(pilot, validationOptions), valid.summary)

expectInvalid('wrong manifest version', (value) => { value.version = 2 }, /version: must equal 3/)
expectInvalid('stale source hash', (value) => { value.source.variants.web.sha256 = 'a'.repeat(64) }, /source\.variants\.web\.sha256: is stale/)
expectInvalid('stale rig bytes', (value) => { value.rig.bytes += 1 }, /rig\.bytes: is stale/)
expectInvalid('missing package SHA', (value) => { delete value.packages[2].variants.web.lod0.sha256 }, /lod0\.sha256: must be exactly 64/)
expectInvalid('stale package bytes', (value) => { value.packages[2].variants.web.lod0.estimates.bytes += 1 }, /lod0\.bytes: is stale/)
expectInvalid('rig duration mismatch', (value) => { value.rig.animationDurationSeconds = 2.5 }, /must match source/)
expectInvalid('missing exact clip contract', (value) => { value.rig.clips = [] }, /rig\.clips: must declare every clip/)

expectInvalid('projective package matrix', (value) => {
  value.packages[2].transform.matrix[3] = 0.25
}, /must be an affine column-major matrix/)
expectInvalid('singular package matrix', (value) => {
  value.packages[2].transform.matrix[0] = 0
}, /must be invertible/)
expectInvalid('invalid owner-local bounds', (value) => {
  value.packages[2].selectionBounds.web.max[0] = value.packages[2].selectionBounds.web.min[0]
}, /max\[0\] must be greater/)
expectInvalid('invalid exact payload bounds', (value) => {
  value.packages[2].variants.quest.lod0.bounds.max[2] = value.packages[2].variants.quest.lod0.bounds.min[2]
}, /variants\.quest\.lod0\.bounds: max\[2\] must be greater/)
expectInvalid('payload escapes selection bounds', (value) => {
  value.packages[2].variants.web.lod0.bounds.max[0] += 1
}, /must be contained by selectionBounds\.web/)
expectInvalid('detail HLOD leaves a transition gap', (value) => {
  for (const variant of ['web', 'quest']) {
    value.packages[2].variants[variant].hlod = structuredClone(value.packages[2].variants[variant].lod0)
  }
  value.packages[2].streaming.lod0ExitMarginMeters = 8
  value.packages[2].streaming.hlodMarginMeters = 6
}, /hlodMarginMeters: must be at least the effective lod0ExitMarginMeters/)
expectInvalid('unknown owner', (value) => {
  value.packages[2].ownerId = 'missing'
}, /unknown or invalid rig owner/)
expectInvalid('missing baseline position', (value) => {
  value.packages[2].requiredAttributes = ['NORMAL']
}, /requiredAttributes: must include POSITION/)
expectInvalid('duplicate package source ownership', (value) => {
  value.packages[2].sourcePaths.web = [...value.packages[1].sourcePaths.web]
}, /duplicates global source ownership/)
expectInvalid('stale source ownership digest', (value) => {
  value.source.ownership.web.pathsSha256 = 'f'.repeat(64)
}, /does not match declared package sourcePaths/)
expectInvalid('exit margin below enter margin', (value) => {
  value.packages[2].streaming.lod0ExitMarginMeters = 1
  value.packages[2].streaming.lod0MarginMeters = 2
}, /lod0ExitMarginMeters: must be at least/)

expectInvalid('detail HLOD heavier than LOD0', (value) => {
  value.packages[2].variants.web.hlod = structuredClone(value.packages[2].variants.web.lod0)
  value.packages[2].variants.web.hlod.estimates.triangles = 37
}, /hlod\.estimates\.triangles: must not exceed LOD0/)
expectInvalid('detail HLOD has more draws than LOD0', (value) => {
  value.packages[2].variants.web.hlod = structuredClone(value.packages[2].variants.web.lod0)
  value.packages[2].variants.web.hlod.estimates.draws = 4
}, /hlod\.estimates\.draws: must not exceed LOD0/)
expectInvalid('persistent critical duplicates HLOD', (value) => {
  value.packages[1].variants.web.hlod = structuredClone(value.packages[1].variants.web.lod0)
}, /persistent-lossless detail must not duplicate HLOD/)
expectInvalid('critical role is not persistent', (value) => {
  value.packages[1].residency = 'streamed'
}, /fire-safety and building-connection roles require persistent-lossless detail/)
expectInvalid('missing persistent critical from initial set', (value) => {
  value.residentSets.web = value.residentSets.web.filter((entry) => entry.packageId !== 'floor-01-critical-pilot')
}, /must include persistent package floor-01-critical-pilot/)
expectInvalid('shell missing from initial set', (value) => {
  value.residentSets.quest = value.residentSets.quest.filter((entry) => entry.packageId !== 'floor-01-shell-pilot')
}, /must include persistent package floor-01-shell-pilot/)
expectInvalid('shell selects unavailable LOD0', (value) => {
  value.residentSets.web[0].level = 'lod0'
}, /persistent package must select hlod|payload is unavailable/)
expectInvalid('more than one shell', (value) => {
  const shell = structuredClone(value.packages[0])
  shell.id = 'second-shell'
  value.packages.push(shell)
  value.residentSets.web.push({ packageId: shell.id, level: 'hlod' })
  value.residentSets.quest.push({ packageId: shell.id, level: 'hlod' })
}, /exactly one always-resident-shell/)

expectInvalid('resident draw budget exceeded', (value) => {
  value.budgets.maxResident.web.draws = 1
}, /residentSets\.web\.draws/)
expectInvalid('transition peak below resident', (value) => {
  value.budgets.maxTransitionPeak.web.bytes = 900
  value.budgets.maxResident.web.bytes = 1000
}, /maxTransitionPeak\.web\.bytes: must be at least resident budget/)
expectInvalid('raised Quest hard triangle budget', (value) => {
  value.budgets.maxResident.quest.triangles = ANIMATION_PACKAGE_HARD_LIMITS.maxResident.quest.triangles + 1
  value.budgets.maxTransitionPeak.quest.triangles = value.budgets.maxResident.quest.triangles
}, /maxResident\.quest\.triangles: exceeds runtime hard limit/)

{
  const noObserved = validateAnimationPackageManifestV3(pilot, { requireHashVerification: true })
  assert.equal(noObserved.valid, false)
  assert.match(noObserved.errors.join('\n'), /source\.variants\.web\.sha256: cannot verify/)
  assert.match(noObserved.errors.join('\n'), /floor-01-detail-lod0\.glb; no observed hash/)
}

console.log(
  'Animation package manifest v3: PASS (dormant route, shell/unloaded detail, persistent critical, integrity, affine transforms, multidimensional budgets)',
)
