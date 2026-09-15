// Run from the repository: node src/demo/dukta-linar-concept/installationBend.test.mjs
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Reuse the project's installed TypeScript transform; no extra test dependency.
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('.', import.meta.url)),
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
})
try {
  const { makeInstallationBendState } = await server.ssrLoadModule('/installationBend.ts')
  const { curveElement } = await server.ssrLoadModule('/bendMath.ts')
  let cases = 0
  for (const width of [0.1, 0.6, 1.2]) {
    for (const reference of [100, 180, 520]) {
      for (const bend of [-100, -55, -10, 10, 55, 100]) {
        for (const offset of [0.002, 0.0097]) {
          const single = makeInstallationBendState(bend, 1, 1.2, reference, width, 100, offset)
          for (const count of [1, 2, 3, 4]) {
            const repeated = makeInstallationBendState(bend, count, 1.2, reference, width, 100, offset)
            assert.ok(Math.abs(single.minimumLocalRadiusMm - repeated.minimumLocalRadiusMm) < 1e-6,
              `Full S radius changed for ${count} modules / ${width} m / ${bend}`)
            for (const key of ['x', 'z', 'tangent']) {
              for (let i = 0; i < single.compoundCurve[key].length; i += 10) {
                assert.ok(Math.abs(single.compoundCurve[key][i] - repeated.compoundCurve[key][i]) < 1e-6,
                  `Full S geometry changed: ${key}`)
              }
            }
            for (const progression of [0, 0.001, 24.999, 25, 25.001, 50, 61, 75, 100]) {
              const state = makeInstallationBendState(bend, count, 1.2, reference, width, progression, offset)
              const left = { x: 0, z: 0, rotY: 0 }
              const right = { x: 0, z: 0, rotY: 0 }
              curveElement(-0.6, state, 1.2, left)
              curveElement(0.6, state, 1.2, right)
              assert.ok(Object.values(left).every(Number.isFinite) && Object.values(right).every(Number.isFinite))
              assert.ok(Math.abs(right.rotY - left.rotY) * count <= Math.PI + 1e-5,
                'Repeated installation wraps beyond a half turn')
              assert.ok(state.minimumLocalRadiusMm > 0 || Math.abs(progression - 25) <= 0.00101,
                'Curved radius must remain positive; the handover is flat')
              if (progression >= 25) {
                assert.ok(Math.abs(right.rotY - left.rotY) < 1e-6,
                  'S periods must join with equal tangents, without cumulative yaw')
                assert.ok(Math.abs(right.z - left.z) < 1e-6,
                  'S periods must repeat in one plane, without drift from the host')
                if (progression === 25) assert.equal(state.minimumLocalRadiusMm, null)
              }
              cases += 1
            }
            const c = makeInstallationBendState(bend, count, 1.2, reference, width, 0, offset)
            const almostC = makeInstallationBendState(bend, count, 1.2, reference, width, 0.001, offset)
            for (let x = -0.6; x <= 0.601; x += 0.1) {
              const a = { x: 0, z: 0, rotY: 0 }, b = { x: 0, z: 0, rotY: 0 }
              curveElement(x, c, 1.2, a)
              curveElement(x, almostC, 1.2, b)
              assert.ok(Math.hypot(a.x-b.x, a.z-b.z) < 1e-5, 'S activation must not jump')
            }
          }
        }
      }
    }
  }
  console.log(`PASS: ${cases} repeated C/S cases; full S radius, shape, finite geometry continuous activation and coplanar S periods`)
} finally {
  await server.close()
}
