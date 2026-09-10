import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

// These production modules intentionally use Vite-style extensionless imports.
// Bundle one in-memory test entry so this check runs under Node in the same way
// the application is resolved, without changing production import semantics or
// leaving generated test artifacts in the repository.
const bundled = await build({
  stdin: {
    contents: `
      export { LINAR_TOUR_STEPS, mergeLinarTourStepState } from './linarTour.ts'
      export { buildLinarShareUrl, parseLinarShareState } from './shareState.ts'
      export { DEFAULT_LINAR_CONFIG, DEFAULT_LINAR_LIGHT, cloneConfig } from './types.ts'
    `,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
    sourcefile: 'tour-and-share-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  write: false,
  logLevel: 'silent',
})

const bundledModule = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)
const {
  DEFAULT_LINAR_CONFIG,
  DEFAULT_LINAR_LIGHT,
  LINAR_TOUR_STEPS,
  buildLinarShareUrl,
  cloneConfig,
  mergeLinarTourStepState,
  parseLinarShareState,
} = bundledModule

const expectedPrimaryTourOrder = [
  'bending',
  's-curve',
  'incision',
  'thickness',
  'repetition',
  'application',
  'materials',
  'veneer',
  'backing',
  'backlight',
]

assert.deepEqual(
  LINAR_TOUR_STEPS.slice(0, expectedPrimaryTourOrder.length).map(
    (step) => step.target,
  ),
  expectedPrimaryTourOrder,
  'tour follows the compact control hierarchy before secondary features',
)

const currentConfig = {
  ...cloneConfig(DEFAULT_LINAR_CONFIG),
  incisionLengthMm: 123,
  panelCount: 3,
}
const currentLight = {
  ...DEFAULT_LINAR_LIGHT,
  enabled: true,
  placement: 'room',
  u: 0.37,
  v: -0.24,
  radius: -0.52,
  intensity: 64,
}
const mergedWithoutLightPatch = mergeLinarTourStepState(
  currentConfig,
  currentLight,
  { config: { thicknessMm: 10 } },
)
assert.equal(mergedWithoutLightPatch.config.thicknessMm, 10)
assert.equal(mergedWithoutLightPatch.config.incisionLengthMm, 123)
assert.equal(mergedWithoutLightPatch.config.panelCount, 3)
assert.deepEqual(
  mergedWithoutLightPatch.light,
  currentLight,
  'a tour step without a light patch preserves the manipulated light',
)
assert.notEqual(mergedWithoutLightPatch.light, currentLight)

const shareConfig = {
  ...cloneConfig(DEFAULT_LINAR_CONFIG),
  application: 'wall',
  backing: 'acoustic-fleece',
  backlightMode: 'on',
  backlightIntensity: 70,
  panelCount: 4,
}
const shareLight = {
  ...currentLight,
  placement: 'behind',
  intensity: 64,
}
const shareUrl = buildLinarShareUrl('https://example.test/demo', {
  config: shareConfig,
  bend: -48,
  secondaryCurveAmount: 37,
  side: 'back',
  view: 'top',
  light: shareLight,
})
const parsedShare = parseLinarShareState(new URL(shareUrl).hash)
assert.equal(parsedShare.isShared, true)
assert.equal(parsedShare.config.panelCount, 4)
assert.equal(parsedShare.config.backlightMode, 'on')
assert.equal(parsedShare.config.backlightIntensity, 70)
assert.equal(parsedShare.bend, -48)
assert.equal(parsedShare.secondaryCurveAmount, 37)
assert.equal(parsedShare.side, 'back')
assert.equal(parsedShare.view, 'top')
assert.deepEqual(parsedShare.light, shareLight)

const legacyLight = parseLinarShareState('#linar=2&light=1&lu=12&lv=-25&lr=40')
assert.equal(
  legacyLight.light.intensity,
  DEFAULT_LINAR_LIGHT.intensity,
  'older links without brightness use the current safe default',
)

console.log('LINAR tour-state preservation and share round-trip checks passed.')
