/**
 * Smoke test walk mode controls on SSR + Denoise demo.
 * Usage: node scripts/smoke-ssr-denoise-walk.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173'
const url = `${baseUrl.replace(/\/$/, '')}/demos/ssr-denoise/?walkTest=1`

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,WebGPU',
      '--use-angle=vulkan',
      '--ignore-gpu-blocklist',
    ],
  })

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })

    await page.waitForFunction(
      () => {
        const fallback = document.getElementById('fallback')
        const canvas = document.querySelector('#container canvas')
        return (
          canvas instanceof HTMLCanvasElement &&
          canvas.width > 0 &&
          !fallback?.classList.contains('is-visible') &&
          typeof window.__walkTest !== 'undefined'
        )
      },
      { timeout: 45000 },
    )

    await page.waitForTimeout(2500)

    const shareRoundTrip = await page.evaluate(() => {
      if (!window.__shareState) return { ok: false, reason: 'missing __shareState' }
      const sample = {
        v: 1,
        p: { ssr: { intensity: 2.25 }, light: { intensity: 5 } },
        cam: { p: [1.5, 0.3, 0.4], t: [0.9, 0.2, -1.0] },
      }
      const encoded = window.__shareState.encodeSharePayloadSync(sample)
      const decoded = window.__shareState.decodeSharePayloadSync(encoded)
      return {
        ok: JSON.stringify(decoded) === JSON.stringify(sample),
        encodedLength: encoded.length,
      }
    })
    if (!shareRoundTrip.ok) {
      throw new Error(`Share state round-trip failed: ${JSON.stringify(shareRoundTrip)}`)
    }

    const shareApply = await page.evaluate(() => {
      const before = window.__walkTest.getState().movementSpeed
      const ok = window.__shareState.applyShareState({
        v: 1,
        p: { runtime: { movementSpeed: 0.42 } },
      })
      const after = window.__walkTest.getState().movementSpeed
      window.__shareState.applyShareState({ v: 1, p: { runtime: { movementSpeed: before } } })
      return { ok, after, before }
    })
    if (!shareApply.ok || shareApply.after !== 0.42) {
      throw new Error(`Share state apply failed: ${JSON.stringify(shareApply)}`)
    }

    const before = await page.evaluate(() => window.__walkTest.getState())

    const placed = await page.evaluate(() => {
      const rect = document.querySelector('#container canvas')?.getBoundingClientRect()
      const hit = window.__walkTest.raycastAt(
        rect ? rect.left + rect.width * 0.5 : 640,
        rect ? rect.top + rect.height * 0.55 : 500,
      )
      return { ok: !!hit, hit }
    })

    await page.evaluate(() => window.__walkTest.setNavigationMode('Walk'))
    await page.waitForTimeout(1500)
    const spawned = await page.evaluate(() => window.__walkTest.getState())

    const ySamples = []
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(250)
      const sample = await page.evaluate(() => window.__walkTest.getState())
      if (sample.playerPosition) ySamples.push(sample.playerPosition[1])
    }

    await page.evaluate(() => window.__walkTest.setKey('KeyW', true))
    await page.waitForTimeout(1200)
    const moving = await page.evaluate(() => {
      window.__walkTest.setKey('KeyW', false)
      return window.__walkTest.getState()
    })

    const moved =
      spawned.playerPosition &&
      moving.playerPosition &&
      Math.hypot(
        moving.playerPosition[0] - spawned.playerPosition[0],
        moving.playerPosition[2] - spawned.playerPosition[2],
      ) > 0.01

    const runStart = await page.evaluate(() => window.__walkTest.getState())
    await page.evaluate(() => {
      window.__walkTest.setKey('ShiftLeft', true)
      window.__walkTest.setKey('KeyW', true)
    })
    await page.waitForTimeout(1200)
    const running = await page.evaluate(() => {
      const state = window.__walkTest.getState()
      window.__walkTest.setKey('KeyW', false)
      window.__walkTest.setKey('ShiftLeft', false)
      return state
    })
    const runDistance =
      runStart.playerPosition && running.playerPosition
        ? Math.hypot(
            running.playerPosition[0] - runStart.playerPosition[0],
            running.playerPosition[2] - runStart.playerPosition[2],
          )
        : 0

    const cameraAbovePlayer =
      spawned.cameraPosition &&
      spawned.playerPosition &&
      spawned.cameraPosition[1] - spawned.playerPosition[1]
    const cameraHeightOk =
      typeof cameraAbovePlayer === 'number' &&
      cameraAbovePlayer > -0.08 &&
      cameraAbovePlayer < 0.32

    const avatarProbe = await page.evaluate(() => window.__walkTest.getAvatarFrustumState())
    const pivotProbe = await page.evaluate(() => window.__walkTest.getPlayerGizmoPivotState())

    const edgeProbe =
      spawned.effectiveCollisionMode === 'off'
        ? { ok: true, skipped: true }
        : await page.evaluate(() => {
            const state = window.__walkTest.getState()
            if (!state.activeBounds || !state.playerPosition) return { ok: false }

            const [px, , pz] = state.playerPosition
            const { min, max } = state.activeBounds
            const margin = 0.06
            const targets = [
              [min[0] - 0.5, pz],
              [max[0] + 0.5, pz],
              [px, min[2] - 0.5],
              [px, max[2] + 0.5],
            ]

            for (const [x, z] of targets) {
              window.__walkTest.nudgePlayer(x - px, z - pz)
            }

            const after = window.__walkTest.getState()
            const [ax, , az] = after.playerPosition
            const insideX = ax >= min[0] + margin && ax <= max[0] - margin
            const insideZ = az >= min[2] + margin && az <= max[2] - margin
            return { ok: insideX && insideZ, after: after.playerPosition, bounds: state.activeBounds }
          })

    const ySpread = ySamples.length ? Math.max(...ySamples) - Math.min(...ySamples) : Infinity
    const yStable = ySamples.length >= 4 && ySpread < 0.2
    const onFloor = spawned.playerOnFloor === true
    const hasCollision = (spawned.octreeTriangleCount ?? 0) > 0

    await page.evaluate(() => {
      window.__walkTest.setPlaceSpawn(true)
    })

    console.log('Share round-trip:', shareRoundTrip)
    console.log('Share apply:', shareApply)
    console.log('Before:', before)
    console.log('Spawned:', spawned)
    console.log('After W:', moving)
    console.log('Y samples:', ySamples)
    console.log('Raycast:', placed)
    console.log('Avatar:', avatarProbe)
    console.log('Pivot:', pivotProbe)
    console.log('Running:', { isRunning: running.isRunning, runWeight: running.runWeight, runDistance })

    if (before.navigationMode !== 'Inspect') throw new Error('Expected initial Inspect mode')
    if (before.movementSpeed !== 0.06) throw new Error(`Expected default walk speed 0.06, got ${before.movementSpeed}`)
    if (spawned.navigationMode !== 'Walk') throw new Error('Failed to enter Walk mode')
    if (!hasCollision) throw new Error('Walk octree has no collision triangles')
    if (!onFloor) throw new Error('Player is not on floor after entering Walk mode')
    if (!yStable) throw new Error(`Player Y unstable while idle (spread=${ySpread.toFixed(3)})`)
    if (!moved) throw new Error('Player did not move while KeyW was held')
    if (!running.runActionLoaded) throw new Error('Run animation clip did not load from Xbot GLB')
    if (!running.isRunning) throw new Error('Shift + W did not trigger running state')
    if (!(runDistance > 0.01)) throw new Error('Player did not move while running (Shift + W)')
    if (!placed.ok) throw new Error('Floor raycast under cursor failed')
    if (!cameraHeightOk) {
      throw new Error(
        `Third-person camera too high/low above player (deltaY=${cameraAbovePlayer?.toFixed(3) ?? 'n/a'})`,
      )
    }
    if (!edgeProbe.ok) {
      throw new Error(`Player escaped walk bounds after edge nudge (${JSON.stringify(edgeProbe)})`)
    }
    if (!avatarProbe.characterLoaded) {
      throw new Error('Xbot character model did not load')
    }
    if (!avatarProbe.visible || !avatarProbe.playerMeshVisible) {
      throw new Error(`Player avatar not visible (${JSON.stringify(avatarProbe)})`)
    }
    if (!avatarProbe.inFrustum) {
      throw new Error(`Character avatar outside camera frustum (${JSON.stringify(avatarProbe)})`)
    }
    const characterScale = avatarProbe.scale
    if (typeof characterScale !== 'number' || characterScale <= 0.06 || characterScale >= 0.45) {
      throw new Error(`Character visual scale out of expected range (${characterScale})`)
    }
    const expectedFloorY = 0.051
    const feetOffset = (avatarProbe.characterFeetY ?? NaN) - (expectedFloorY - (avatarProbe.floorSink ?? 0.004))
    const maxFloat = 0.04
    if (!Number.isFinite(feetOffset) || feetOffset > maxFloat) {
      throw new Error(
        `Character feet floating above gallery floor (feetY=${avatarProbe.characterFeetY}, expectedFloorY=${expectedFloorY}, offset=${feetOffset})`,
      )
    }
    if (feetOffset < -0.03) {
      throw new Error(
        `Character feet sunk below gallery floor (offset=${feetOffset})`,
      )
    }
    if (!pivotProbe) {
      throw new Error('Player transform pivot probe unavailable')
    }
    if (Math.abs(pivotProbe.pivotToFloorDelta ?? Infinity) > 0.02) {
      throw new Error(
        `Player gizmo pivot not aligned to capsule floor (delta=${pivotProbe.pivotToFloorDelta})`,
      )
    }
    if (
      typeof pivotProbe.pivotToFeetDelta !== 'number' ||
      pivotProbe.pivotToFeetDelta < -0.03 ||
      pivotProbe.pivotToFeetDelta > 0.02
    ) {
      throw new Error(
        `Player gizmo pivot not near character soles (pivotToFeetDelta=${pivotProbe.pivotToFeetDelta})`,
      )
    }
    const expectedSpawn = [1.221, 0.051, 0.341]
    const spawnDistFromExpected = spawned.playerPosition
      ? Math.hypot(
          spawned.playerPosition[0] - expectedSpawn[0],
          spawned.playerPosition[2] - expectedSpawn[2],
        )
      : Infinity
    if (spawnDistFromExpected > 0.15) {
      throw new Error(
        `Player spawned far from default spawn (dist=${spawnDistFromExpected.toFixed(3)}, pos=${JSON.stringify(spawned.playerPosition)}, expected=${JSON.stringify(expectedSpawn)})`,
      )
    }

    const movedPivot = await page.evaluate(() => {
      const before = window.__walkTest.getPlayerGizmoPivotState()
      const after = window.__walkTest.movePlayerPivot(0.12, 0, 0.08)
      return { before, after }
    })
    console.log('Pivot move:', movedPivot)
    if (
      !movedPivot.before?.pivotPosition ||
      !movedPivot.after?.pivotPosition ||
      Math.hypot(
        movedPivot.after.pivotPosition[0] - movedPivot.before.pivotPosition[0] - 0.12,
        movedPivot.after.pivotPosition[2] - movedPivot.before.pivotPosition[2] - 0.08,
      ) > 0.02
    ) {
      throw new Error(`Player pivot move did not sync (${JSON.stringify(movedPivot)})`)
    }
    const walkAfterPivotMove = await page.evaluate(() => window.__walkTest.getState())
    if (!walkAfterPivotMove.playerPosition) {
      throw new Error('Player collider missing after pivot move')
    }
    const colliderFollowsPivot =
      Math.hypot(
        walkAfterPivotMove.playerPosition[0] - movedPivot.after.pivotPosition[0],
        walkAfterPivotMove.playerPosition[2] - movedPivot.after.pivotPosition[2],
      ) < 0.08
    if (!colliderFollowsPivot) {
      throw new Error(
        `Player collider did not follow pivot move (${JSON.stringify({
          collider: walkAfterPivotMove.playerPosition,
          pivot: movedPivot.after.pivotPosition,
        })})`,
      )
    }

    console.log('Walk mode smoke test passed.')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
