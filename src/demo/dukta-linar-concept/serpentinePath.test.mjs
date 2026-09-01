import assert from 'node:assert/strict'
import { makeSerpentinePathLookup } from './serpentinePath.ts'

function approx(actual, expected, tolerance, label) {
  assert.notEqual(actual, null, `${label}: expected a finite local radius`)
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  )
}

const fullS = makeSerpentinePathLookup({
  panelWidthM: 1.2,
  activeWidthM: 1.2,
  serpentineWidthM: 1.2,
  radiusM: 1,
  bendAngleRad: 1.2,
  directionSign: 1,
  progression: 1,
})
approx(fullS.minimumLocalRadiusMm, 1000 / Math.PI, 1e-9, 'full S analytical radius')

const reversedS = makeSerpentinePathLookup({
  panelWidthM: 1.2,
  activeWidthM: 1.2,
  serpentineWidthM: 1.2,
  radiusM: 1,
  bendAngleRad: 1.2,
  directionSign: -1,
  progression: 1,
})
approx(
  reversedS.minimumLocalRadiusMm,
  fullS.minimumLocalRadiusMm,
  1e-9,
  'direction reversal invariance',
)

const primaryOnly = makeSerpentinePathLookup({
  panelWidthM: 1.2,
  activeWidthM: 0.6,
  serpentineWidthM: 1.2,
  radiusM: 0.3,
  bendAngleRad: 2,
  directionSign: 1,
  progression: 0,
})
approx(primaryOnly.minimumLocalRadiusMm, 300, 1e-9, 'primary C radius')

const halfBlend = makeSerpentinePathLookup({
  panelWidthM: 1.2,
  activeWidthM: 0.6,
  serpentineWidthM: 1.2,
  radiusM: 0.3,
  bendAngleRad: 2,
  directionSign: 1,
  progression: 0.5,
})
const halfBlendCurvature = 0.5 / 0.3 + (0.5 * 2 * Math.PI) / 1.2
approx(
  halfBlend.minimumLocalRadiusMm,
  1000 / halfBlendCurvature,
  1e-9,
  'blended primary and positive S lobe',
)

const narrowPrimaryBlend = makeSerpentinePathLookup({
  panelWidthM: 1.2,
  activeWidthM: 0.3,
  serpentineWidthM: 1.2,
  radiusM: 0.3,
  bendAngleRad: 1,
  directionSign: 1,
  progression: 0.5,
})
const narrowBoundaryCurvature =
  0.5 / 0.3 + ((0.5 * Math.PI) / 1.2) * Math.sin(Math.PI * 0.75)
approx(
  narrowPrimaryBlend.minimumLocalRadiusMm,
  1000 / narrowBoundaryCurvature,
  1e-9,
  'one-sided active-span boundary maximum',
)

const safetyLimited = makeSerpentinePathLookup({
  panelWidthM: 1.2,
  activeWidthM: 0.2,
  serpentineWidthM: 0.2,
  radiusM: 0.05,
  bendAngleRad: 3,
  directionSign: 1,
  progression: 1,
  maxNormalOffsetM: 0.1,
})
assert.equal(safetyLimited.visualSafetyLimited, true)
approx(
  safetyLimited.minimumLocalRadiusMm,
  250,
  1e-9,
  'render-safety-limited S radius',
)

// Independently differentiate the stored lookup. This verifies that the
// analytical result describes the same tangent field used to render the
// centreline, within the discretisation error of its 600 Float32 samples.
const stepLengthM = 1.2 / fullS.steps
let sampledMaximumCurvature = 0
for (let i = 1; i < fullS.steps; i += 1) {
  const curvature =
    Math.abs(fullS.tangent[i + 1] - fullS.tangent[i - 1]) / (2 * stepLengthM)
  sampledMaximumCurvature = Math.max(sampledMaximumCurvature, curvature)
}
approx(
  1000 / sampledMaximumCurvature,
  fullS.minimumLocalRadiusMm,
  0.03,
  'lookup tangent numerical cross-check',
)

let sampledPositionMaximumCurvature = 0
for (let i = 1; i < fullS.steps; i += 1) {
  const dx = (fullS.x[i + 1] - fullS.x[i - 1]) / (2 * stepLengthM)
  const dz = (fullS.z[i + 1] - fullS.z[i - 1]) / (2 * stepLengthM)
  const ddx =
    (fullS.x[i + 1] - 2 * fullS.x[i] + fullS.x[i - 1]) /
    (stepLengthM * stepLengthM)
  const ddz =
    (fullS.z[i + 1] - 2 * fullS.z[i] + fullS.z[i - 1]) /
    (stepLengthM * stepLengthM)
  const speedSquared = dx * dx + dz * dz
  if (speedSquared <= 1e-12) continue
  const curvature = Math.abs(dx * ddz - dz * ddx) / speedSquared ** 1.5
  sampledPositionMaximumCurvature = Math.max(
    sampledPositionMaximumCurvature,
    curvature,
  )
}
approx(
  1000 / sampledPositionMaximumCurvature,
  fullS.minimumLocalRadiusMm,
  0.5,
  'lookup position cross-product numerical check',
)

console.log('LINAR serpentine minimum-local-radius checks passed.')
