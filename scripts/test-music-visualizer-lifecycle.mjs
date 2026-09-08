import assert from 'node:assert/strict'

import { mountMusicPlayerVisualizer } from '../src/utils/musicPlayerVisualizerLifecycle.ts'

function createContainer(canvas = new EventTarget()) {
  return {
    getBoundingClientRect: () => ({ width: 320, height: 240 }),
    querySelector: (selector) => (selector === 'canvas' ? canvas : null),
  }
}

function createVisualizer(overrides = {}) {
  let disposeCount = 0
  const visualizer = {
    mount() {},
    resize() {},
    update() {},
    pause() {},
    resume() {},
    isPaused() { return false },
    setFullscreenMode() {},
    setPointer() {},
    resetPointer() {},
    setDeviceOrientation() {},
    clearDeviceOrientation() {},
    getBandLevels() { return { bass: 0, mids: 0, highs: 0, phase: 0 } },
    dispose() { disposeCount += 1 },
    ...overrides,
  }
  return { visualizer, getDisposeCount: () => disposeCount }
}

async function expectMountFailure(overrides, message) {
  const { visualizer, getDisposeCount } = createVisualizer(overrides)
  await assert.rejects(
    mountMusicPlayerVisualizer({
      visualizer,
      container: createContainer(),
      onContextLost() {},
    }),
    new RegExp(message),
  )
  assert.equal(getDisposeCount(), 1, `${message}: partial resources were not disposed`)
}

await expectMountFailure({ mount() { throw new Error('sync mount') } }, 'sync mount')
await expectMountFailure({ mount() { return Promise.reject(new Error('async mount')) } }, 'async mount')
await expectMountFailure({ resize() { throw new Error('first resize') } }, 'first resize')
await expectMountFailure({ update() { throw new Error('first update') } }, 'first update')

const canvas = new EventTarget()
const { visualizer, getDisposeCount } = createVisualizer()
let contextLossCount = 0
const removeContextListener = await mountMusicPlayerVisualizer({
  visualizer,
  container: createContainer(canvas),
  onContextLost(error) {
    assert.match(error.message, /context lost/i)
    contextLossCount += 1
  },
})
const lost = new Event('webglcontextlost', { cancelable: true })
canvas.dispatchEvent(lost)
assert.equal(lost.defaultPrevented, true, 'context loss should suppress browser restoration loops')
assert.equal(contextLossCount, 1, 'context loss should enter fallback once')
removeContextListener()
canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
assert.equal(contextLossCount, 1, 'context listener cleanup failed')
assert.equal(getDisposeCount(), 0, 'successful mount cleanup must stay owned by the caller')

console.log('Music visualizer lifecycle tests passed.')
