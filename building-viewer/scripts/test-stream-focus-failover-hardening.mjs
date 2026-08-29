import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { Group, Vector3 } from 'three'

const vite = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

function layer(id, root, { streaming = false, visible = true } = {}) {
  return {
    id,
    entry: { id, name: id, web: `/${id}.glb` },
    root,
    result: {
      root,
      url: `/${id}.glb`,
      transferredBytes: null,
      downloadMs: 0,
      parseMs: 0,
      fileSizeBytes: null,
      animations: [],
    },
    visible,
    streaming,
  }
}

async function waitUntil(predicate, label) {
  const deadline = performance.now() + 2_000
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${label}`)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

try {
  const [{ ViewerEngine }, { ModelManager }] = await Promise.all([
    vite.ssrLoadModule('/src/ViewerEngine.ts'),
    vite.ssrLoadModule('/src/scene/ModelManager.ts'),
  ])

  // Render-loop polling owns exactly one async sync operation. While it is in
  // flight, intermediate focuses are discarded and the latest one is drained.
  {
    const calls = []
    const releases = []
    let active = 0
    let maxActive = 0
    const fakeViewer = Object.assign(Object.create(ViewerEngine.prototype), {
      disposed: false,
      lastStreamSyncMs: 0,
      streamFocusIntervalMs: 0,
      queuedStreamFocus: null,
      streamFocusDrain: null,
      activeModelLoad: null,
      events: {},
      models: {
        hasStreamingLayers: () => true,
        updateStreamingFocus: async (focus) => {
          calls.push({ ...focus })
          active += 1
          maxActive = Math.max(maxActive, active)
          await new Promise((resolve) => releases.push(resolve))
          active -= 1
        },
      },
      sleep: async () => {},
    })

    fakeViewer.flushStreamingFocus(new Vector3(1, 2, 3))
    await waitUntil(() => calls.length === 1, 'first focus sync')
    fakeViewer.flushStreamingFocus(new Vector3(4, 5, 6))
    fakeViewer.flushStreamingFocus(new Vector3(7, 8, 9))
    assert.equal(calls.length, 1, 'a focus sync must not overlap the active request')
    releases.shift()()
    await waitUntil(() => calls.length === 2, 'latest queued focus sync')
    assert.deepEqual(calls[1], { x: 7, y: 8, z: 9 })
    assert.equal(maxActive, 1)
    releases.shift()()
    await waitUntil(() => fakeViewer.streamFocusDrain === null, 'focus drain completion')
  }

  // A terminal recovery rejection is surfaced to the host and does not leave
  // the single-flight drain stuck in a busy state.
  {
    const errors = []
    const originalWarn = console.warn
    console.warn = () => {}
    try {
      const fakeViewer = Object.assign(Object.create(ViewerEngine.prototype), {
        disposed: false,
        lastStreamSyncMs: 0,
        streamFocusIntervalMs: 0,
        queuedStreamFocus: null,
        streamFocusDrain: null,
        activeModelLoad: null,
        events: { onError: (message) => errors.push(message) },
        models: {
          hasStreamingLayers: () => true,
          updateStreamingFocus: async () => {
            throw new Error('synthetic recovery rejection')
          },
        },
        sleep: async () => {},
      })
      fakeViewer.flushStreamingFocus(new Vector3(1, 0, 1))
      await waitUntil(() => fakeViewer.streamFocusDrain === null, 'failed focus drain release')
      assert.equal(errors.length, 1)
      assert.match(errors[0], /last resident scene remains active: synthetic recovery rejection/)
    } finally {
      console.warn = originalWarn
    }
  }

  // Atomic replacement preserves the prior UI visibility bit and root state.
  {
    const manager = new ModelManager(() => null)
    const oldRoot = new Group()
    const oldLayer = layer('hidden-layer', oldRoot, { visible: false })
    oldRoot.visible = false
    manager.layers.set(oldLayer.id, oldLayer)
    manager.root.add(oldRoot)

    const replacementRoot = new Group()
    const replacement = layer(oldLayer.id, replacementRoot)
    manager.commitReplacement([{ layer: replacement }])
    assert.equal(replacement.visible, false)
    assert.equal(replacementRoot.visible, false)
    manager.dispose()
  }

  // A rejected or incomplete monolithic replacement keeps the old streamed
  // root/collision mounted, rejects observably, and re-arms future syncing.
  {
    const manager = new ModelManager(() => null)
    const streamedRoot = new Group()
    const streamed = layer('recovery-layer', streamedRoot, { streaming: true, visible: false })
    const fakeStream = { dispose() {} }
    const preparedCollision = { chunks: [], report: {} }
    manager.layers.set(streamed.id, streamed)
    manager.streamLoaders.set(streamed.id, fakeStream)
    manager.preparedStreamingCollisions.set(streamed.id, preparedCollision)
    manager.root.add(streamedRoot)

    manager.setStreamingFailoverHandler(async () => {
      throw new Error('synthetic monolith failure')
    })
    await assert.rejects(
      manager.requestStreamingFailover(streamed.id, new Error('package failure')),
      /synthetic monolith failure/,
    )
    assert.equal(manager.blockedStreamingLayerIds.has(streamed.id), false)
    assert.equal(manager.getLayer(streamed.id), streamed)
    assert.equal(streamedRoot.parent, manager.root)
    assert.equal(manager.preparedStreamingCollisions.get(streamed.id), preparedCollision)

    manager.setStreamingFailoverHandler(async () => {})
    await assert.rejects(
      manager.requestStreamingFailover(streamed.id, new Error('package failure')),
      /without installing a monolithic replacement/,
    )
    assert.equal(manager.blockedStreamingLayerIds.has(streamed.id), false)

    const monolithicRoot = new Group()
    const monolithic = layer(streamed.id, monolithicRoot)
    manager.setStreamingFailoverHandler(async () => {
      manager.commitLayer({ layer: monolithic })
    })
    await manager.requestStreamingFailover(streamed.id, new Error('package failure'))
    assert.equal(manager.getLayer(streamed.id), monolithic)
    assert.equal(monolithic.streaming, false)
    assert.equal(monolithic.visible, false)
    assert.equal(monolithicRoot.visible, false)
    assert.equal(manager.blockedStreamingLayerIds.has(streamed.id), true)
    manager.dispose()
  }

  console.log(
    'Streaming focus/failover hardening: PASS (single-flight latest focus, visibility preservation, failed-recovery re-arm)',
  )
} finally {
  await vite.close()
}
