import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundled = await build({
  stdin: {
    contents: `
      export {
        formatLinarLightSurfaceClearance,
        LINAR_LIGHT_MAX_HEIGHT_PERCENT,
        LINAR_LIGHT_MIN_HEIGHT_PERCENT,
        linarLightHeightPercent,
        linarLightOrbitDegrees,
        linarLightSurfaceClearanceM,
        linarLightValueForHeightPercent,
        linarLightValueForOrbitDegrees,
        setLinarLightLocalPosition,
      } from './lightRig.ts'
    `,
    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
    sourcefile: 'light-rig-test-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  write: false,
  logLevel: 'silent',
})

const rig = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

const bounds = {
  minX: -0.6,
  maxX: 0.6,
  minZ: -0.1,
  maxZ: 0.2,
  heightM: 2.8,
}
const near = -1
const defaultDistance = 0
const far = 1
const epsilon = 1e-9
const closeTo = (actual, expected, message) =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${message}: expected ${expected}, received ${actual}`,
  )
const position = (state, mounted = true, inspectionFlipped = false) =>
  rig.setLinarLightLocalPosition(
    { x: 0, y: 0, z: 0 },
    state,
    bounds,
    mounted,
    inspectionFlipped,
  )
const planClearance = ({ x, z }) => {
  const outsideX = Math.max(bounds.minX - x, 0, x - bounds.maxX)
  const outsideZ = Math.max(bounds.minZ - z, 0, z - bounds.maxZ)
  return Math.hypot(outsideX, outsideZ)
}

assert.equal(rig.linarLightOrbitDegrees(-1, true), -90)
assert.equal(rig.linarLightOrbitDegrees(1, true), 90)
assert.equal(rig.linarLightOrbitDegrees(-1, false), -180)
assert.equal(rig.linarLightOrbitDegrees(1, false), 180)
closeTo(rig.linarLightValueForOrbitDegrees(45, true), 0.5, 'mounted degree inverse')
closeTo(rig.linarLightValueForOrbitDegrees(90, false), 0.5, 'free degree inverse')

assert.equal(rig.linarLightHeightPercent(-1), rig.LINAR_LIGHT_MIN_HEIGHT_PERCENT)
assert.equal(rig.linarLightHeightPercent(1), rig.LINAR_LIGHT_MAX_HEIGHT_PERCENT)
for (const percent of [-15, 0, 50, 100, 125]) {
  closeTo(
    rig.linarLightHeightPercent(rig.linarLightValueForHeightPercent(percent)),
    percent,
    `height ${percent}% round trip`,
  )
}

closeTo(rig.linarLightSurfaceClearanceM(near), 0.04, 'Near clearance')
closeTo(rig.linarLightSurfaceClearanceM(defaultDistance), 0.45, 'default clearance')
closeTo(rig.linarLightSurfaceClearanceM(far), 4.2, 'Far clearance')
assert.equal(rig.formatLinarLightSurfaceClearance(near), '4 cm')
assert.equal(rig.formatLinarLightSurfaceClearance(defaultDistance), '45 cm')
assert.equal(rig.formatLinarLightSurfaceClearance(far), '4.2 m')

const shared = { placement: 'room', u: 0.38, v: 0.25, radius: 0 }
const lower = position({ ...shared, v: -1 })
const upper = position({ ...shared, v: 1 })
closeTo(lower.x, upper.x, 'Height does not change local X')
closeTo(lower.z, upper.z, 'Height does not change local Z')
closeTo(lower.y, bounds.heightM * -0.15, 'minimum height is honest panel percentage')
closeTo(upper.y, bounds.heightM * 1.25, 'maximum height is honest panel percentage')

const left = position({ ...shared, u: -0.72 })
const right = position({ ...shared, u: 0.72 })
closeTo(left.y, right.y, 'Position does not change height')
assert.ok(left.x < right.x, 'Position moves around the panel horizontally')

const centreX = (bounds.minX + bounds.maxX) * 0.5
const centreZ = (bounds.minZ + bounds.maxZ) * 0.5
const nearPosition = position({ ...shared, radius: near })
const farPosition = position({ ...shared, radius: far })
const nearDirection = Math.atan2(nearPosition.x - centreX, nearPosition.z - centreZ)
const farDirection = Math.atan2(farPosition.x - centreX, farPosition.z - centreZ)
closeTo(nearDirection, farDirection, 'Distance preserves orbit direction')
closeTo(nearPosition.y, farPosition.y, 'Distance does not change height')
assert.ok(
  Math.hypot(farPosition.x - centreX, farPosition.z - centreZ) >
    Math.hypot(nearPosition.x - centreX, nearPosition.z - centreZ),
  'Distance moves the source farther from the same panel-local ray',
)
for (const u of [-0.92, -0.5, -0.08, 0.27, 0.71, 0.96]) {
  for (const radius of [near, defaultDistance, far]) {
    closeTo(
      planClearance(position({ ...shared, u, radius })),
      rig.linarLightSurfaceClearanceM(radius),
      `displayed distance matches actual plan clearance at u=${u}, radius=${radius}`,
    )
  }
}

const room = position({ placement: 'room', u: 0, v: 0, radius: near })
const behind = position({ placement: 'behind', u: 0, v: 0, radius: near })
closeTo(room.z, bounds.maxZ + 0.04, 'Room source clears the front envelope')
closeTo(behind.z, bounds.minZ - 0.04, 'Behind source clears the rear envelope')
closeTo(room.x, behind.x, 'Side switch preserves local X')
closeTo(room.y, behind.y, 'Side switch preserves local height')

const flipped = position(
  { placement: 'room', u: 0.4, v: 0.5, radius: defaultDistance },
  true,
  true,
)
const unflipped = position(
  { placement: 'room', u: 0.4, v: 0.5, radius: defaultDistance },
)
closeTo(flipped.x - centreX, -(unflipped.x - centreX), 'inspection flip mirrors X')
closeTo(flipped.z - centreZ, -(unflipped.z - centreZ), 'inspection flip mirrors Z')
closeTo(flipped.y, unflipped.y, 'inspection flip preserves height')

console.log('LINAR independent light-control mapping checks passed.')
