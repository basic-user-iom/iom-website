import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_DIR = join(SCRIPT_DIR, '..')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

const vite = await createServer({
  root: PROJECT_DIR,
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  const module = await vite.ssrLoadModule(
    '/src/scene/development/DevelopmentRepeatSixPartViewerLifecycleController.ts',
  )
  const {
    DEVELOPMENT_REPEAT_SIX_PART_LIFECYCLE_MUTATION_REASONS: mutationReasons,
    DevelopmentRepeatSixPartViewerLifecycleController: Controller,
    DevelopmentRepeatSixPartViewerLifecycleError: LifecycleError,
  } = module

  function fixture(generation = 1, overrides = {}) {
    const events = []
    const calls = []
    const published = []
    const state = {
      cancelCount: 0,
      disposeCount: 0,
      restoreCount: 0,
      preserveCount: 0,
      inspectCount: 0,
      ownerRefreshCount: 0,
      maxConcurrency: 0,
      concurrency: 0,
      knownOwnerPreserved: true,
    }
    const session = {
      generation,
      updateOwnerWorldMatrix() {
        state.ownerRefreshCount += 1
        events.push('owner-refresh')
      },
      worldToOwnerLocal(worldPoint) {
        events.push('owner-convert')
        return {
          space: 'owner-local',
          point: [
            worldPoint.point[0] - 10,
            worldPoint.point[1] - 20,
            worldPoint.point[2] - 30,
          ],
        }
      },
      ...overrides.session,
    }
    const adapter = {
      async updateFocus(request) {
        state.concurrency += 1
        state.maxConcurrency = Math.max(state.maxConcurrency, state.concurrency)
        calls.push(request)
        events.push(`adapter-start:${request.focus.point[0]}`)
        try {
          if (overrides.updateFocus) await overrides.updateFocus(request, { events, published, state })
          if (request.canPublish()) published.push([...request.focus.point])
        } finally {
          events.push(`adapter-settle:${request.focus.point[0]}`)
          state.concurrency -= 1
        }
      },
      cancelPendingUpdate() {
        state.cancelCount += 1
        events.push('cancel')
        if (overrides.onCancel) overrides.onCancel()
        if (overrides.cancelError) throw overrides.cancelError
        if ('cancelResult' in overrides) return overrides.cancelResult
      },
      async dispose() {
        state.disposeCount += 1
        events.push('dispose')
        if (overrides.dispose) await overrides.dispose()
        events.push('dispose-complete')
      },
    }
    const inspection = {
      clearInspection() {
        state.inspectCount += 1
        events.push('inspect-clear')
        if (overrides.clearInspection) return overrides.clearInspection()
      },
    }
    const barrier = {
      restoreOriginalOwnership(reason) {
        state.restoreCount += 1
        events.push(`restore:${reason}`)
        if (overrides.onRestore) overrides.onRestore(reason)
        if (overrides.restoreError) throw overrides.restoreError
        if ('restoreResult' in overrides) return overrides.restoreResult
      },
      preserveKnownOwnership(reason) {
        state.preserveCount += 1
        state.knownOwnerPreserved = true
        events.push(`preserve:${reason}`)
        if ('preserveResult' in overrides) return overrides.preserveResult
      },
    }
    return {
      attachment: { generation, session, adapter, inspection, barrier },
      events,
      calls,
      published,
      state,
    }
  }

  function world(generation, x, y = 20, z = 30, overview = false) {
    return { generation, worldPoint: { space: 'world', point: [x, y, z] }, overview }
  }

  // (a) Static audit posture is explicit and cannot carry an activation token.
  {
    const controller = new Controller()
    const snapshot = controller.getSnapshot()
    assert.equal(snapshot.developmentOnly, true)
    assert.equal(snapshot.activationAuthorized, false)
    assert.equal(snapshot.activationCapability, null)
    assert.equal(snapshot.state, 'idle')
  }

  // (b) A stale generation is rejected before counters, callbacks, or adapter calls.
  {
    const controller = new Controller()
    const value = fixture(4)
    controller.attachSession(value.attachment)
    const before = controller.getSnapshot()
    assert.throws(
      () => controller.queueWorldFocus(world(3, 11)),
      (error) => error instanceof LifecycleError && error.code === 'STALE_GENERATION',
    )
    assert.deepEqual(controller.getSnapshot().counters, before.counters)
    assert.deepEqual(value.events, [])
    assert.equal(value.calls.length, 0)
    await controller.dispose()
  }

  // (c) One in-flight plus one replaceable pending request; latest wins.
  {
    const first = deferred()
    const controller = new Controller()
    const value = fixture(5, {
      updateFocus: async (request) => {
        if (request.focus.point[0] === 1) await first.promise
      },
    })
    controller.attachSession(value.attachment)
    const a = controller.queueWorldFocus(world(5, 11))
    const b = controller.queueWorldFocus(world(5, 12))
    const c = controller.queueWorldFocus(world(5, 13))
    assert.equal((await b).kind, 'superseded')
    assert.deepEqual(value.calls.map((call) => call.focus.point[0]), [1])
    assert.equal(value.state.maxConcurrency, 1)
    first.resolve()
    assert.equal((await a).kind, 'published')
    assert.equal((await c).kind, 'published')
    assert.deepEqual(value.calls.map((call) => call.focus.point[0]), [1, 3])
    assert.equal(value.state.maxConcurrency, 1)
    assert.ok(
      value.events.indexOf('adapter-settle:1') < value.events.indexOf('adapter-start:3'),
      'C started before A settled',
    )
    assert.deepEqual(value.published.at(-1), [3, 0, 0])
    await controller.dispose()
  }

  // (d) Inputs are copied, immutable, finite, and converted to owner-local only.
  {
    const controller = new Controller()
    const value = fixture(6)
    controller.attachSession(value.attachment)
    const mutablePoint = [17, 28, 39]
    const completed = controller.queueWorldFocus({
      generation: 6,
      worldPoint: { space: 'world', point: mutablePoint },
      overview: true,
    })
    mutablePoint[0] = 999
    assert.equal((await completed).kind, 'published')
    assert.deepEqual(value.calls[0].focus, { space: 'owner-local', point: [7, 8, 9] })
    assert.equal(Object.isFrozen(value.calls[0]), true)
    assert.equal(Object.isFrozen(value.calls[0].focus), true)
    assert.equal(Object.isFrozen(value.calls[0].focus.point), true)
    const callCount = value.calls.length
    for (const invalid of [
      { generation: 6, worldPoint: { space: 'owner-local', point: [1, 2, 3] }, overview: false },
      { generation: 6, worldPoint: { space: 'world', point: [1, Number.NaN, 3] }, overview: false },
      { generation: 6, worldPoint: { space: 'world', point: [1, 2, Infinity] }, overview: false },
    ]) {
      assert.throws(
        () => controller.queueWorldFocus(invalid),
        (error) => error instanceof LifecycleError && error.code === 'INVALID_FOCUS',
      )
    }
    assert.equal(value.calls.length, callCount)
    await controller.dispose()
  }

  // Promise-returning implementations of publication-side synchronous ports
  // are rejected before the adapter can publish and fail closed to originals.
  for (const [label, generation, overrides] of [
    ['owner refresh', 180, { session: { updateOwnerWorldMatrix: async () => undefined } }],
    ['inspection clear', 181, { clearInspection: async () => undefined }],
    ['owner-local rejected promise', 182, {
      session: {
        worldToOwnerLocal: () => Promise.reject(new Error('async conversion rejected')),
      },
    }],
    ['owner-local hostile then getter', 183, {
      session: {
        worldToOwnerLocal: () => Object.defineProperty({}, 'then', {
          get() { throw new Error('hostile then getter') },
        }),
      },
    }],
  ]) {
    const controller = new Controller()
    const value = fixture(generation, overrides)
    controller.attachSession(value.attachment)
    await assert.rejects(
      controller.queueWorldFocus(world(generation, 11)),
      (error) => (
        error instanceof LifecycleError &&
        error.code === 'PUBLICATION_FAILED' &&
        error.cause instanceof LifecycleError &&
        error.cause.code === 'ASYNC_SYNCHRONOUS_PORT'
      ),
      label,
    )
    assert.equal(value.calls.length, 0, `${label}: adapter publication was attempted`)
    assert.equal(value.state.restoreCount, 1, `${label}: originals were not restored`)
    await controller.dispose()
  }

  // (e) Every destructive lifecycle reason cancels/restores synchronously,
  // clears queued focus, and invokes its continuation only after settlement.
  for (const [index, reason] of mutationReasons.entries()) {
    const first = deferred()
    const controller = new Controller()
    const value = fixture(100 + index, { updateFocus: async () => first.promise })
    controller.attachSession(value.attachment)
    const a = controller.queueWorldFocus(world(100 + index, 11))
    const pending = controller.queueWorldFocus(world(100 + index, 12))
    let continuationCount = 0
    const mutation = controller.runLifecycleMutation(reason, () => {
      continuationCount += 1
      value.events.push('continuation')
      return reason
    })
    assert.equal(value.events.includes('cancel'), true, `${reason}: no synchronous cancel`)
    assert.equal(value.events.includes(`restore:${reason}`), true, `${reason}: no synchronous restore`)
    assert.equal(continuationCount, 0, `${reason}: continuation ran before settlement`)
    assert.equal((await pending).kind, 'cancelled', `${reason}: queued focus survived`)
    first.resolve()
    assert.equal((await a).kind, 'cancelled')
    assert.equal(await mutation, reason)
    assert.equal(continuationCount, 1)
    assert.ok(value.events.indexOf('cancel') < value.events.indexOf(`restore:${reason}`))
    assert.ok(value.events.indexOf(`restore:${reason}`) < value.events.indexOf('continuation'))
    assert.equal(value.calls.length, 1, `${reason}: pending focus reached adapter`)
  }

  // (f) Restoration failure blocks mutation, fail-stops, and preserves known ownership.
  {
    const controller = new Controller()
    const value = fixture(200, { restoreError: new Error('restore failed') })
    controller.attachSession(value.attachment)
    let continuationCount = 0
    const mutation = controller.runLifecycleMutation('model-load', () => { continuationCount += 1 })
    assert.equal(value.state.preserveCount, 1)
    assert.equal(continuationCount, 0)
    await assert.rejects(
      mutation,
      (error) => error instanceof LifecycleError && error.code === 'RESTORATION_FAILED',
    )
    assert.equal(continuationCount, 0)
    assert.equal(controller.getSnapshot().state, 'failed-stopped')
    assert.equal(controller.getSnapshot().knownOwnershipPreserved, true)
    assert.equal(value.state.disposeCount, 0)
  }

  // Cancellation failure cannot skip synchronous restoration or admit the
  // destructive continuation. Internal-only and unknown reasons are rejected
  // at the public teardown boundary before any lifecycle mutation.
  {
    const controller = new Controller()
    const value = fixture(2001, { cancelError: new Error('cancel failed') })
    controller.attachSession(value.attachment)
    for (const invalidReason of ['controller-dispose', 'focus-publication-failure', 'unknown']) {
      assert.throws(
        () => controller.teardown(invalidReason),
        (error) => error instanceof LifecycleError && error.code === 'INVALID_CONFIGURATION',
      )
    }
    assert.deepEqual(value.events, [])
    let continuationCount = 0
    const mutation = controller.runLifecycleMutation('model-remove', () => {
      continuationCount += 1
    })
    assert.deepEqual(value.events, ['cancel', 'restore:model-remove'])
    assert.equal(continuationCount, 0)
    await assert.rejects(
      mutation,
      (error) => error instanceof LifecycleError && error.code === 'CANCELLATION_FAILED',
    )
    assert.equal(continuationCount, 0)
    assert.equal(controller.getSnapshot().state, 'failed-stopped')
    assert.equal(controller.getSnapshot().knownOwnershipPreserved, true)
    assert.equal(value.state.restoreCount, 1)
    assert.equal(value.state.disposeCount, 0)
  }

  // Promise-returning implementations of teardown-side synchronous ports
  // are containment failures, never completed lifecycle barriers.
  {
    const controller = new Controller()
    const value = fixture(2002, { cancelResult: Promise.resolve(false) })
    controller.attachSession(value.attachment)
    let continuationCount = 0
    const mutation = controller.runLifecycleMutation('model-remove', () => {
      continuationCount += 1
    })
    assert.deepEqual(value.events, ['cancel', 'restore:model-remove'])
    await assert.rejects(
      mutation,
      (error) => (
        error instanceof LifecycleError &&
        error.code === 'CANCELLATION_FAILED' &&
        error.cause instanceof LifecycleError &&
        error.cause.code === 'ASYNC_SYNCHRONOUS_PORT'
      ),
    )
    assert.equal(continuationCount, 0)
    assert.equal(controller.getSnapshot().state, 'failed-stopped')
  }

  for (const [generation, overrides, expectedPreserved] of [
    [2003, { restoreResult: Promise.resolve() }, true],
    [2004, { restoreError: new Error('restore failed'), preserveResult: Promise.resolve() }, false],
  ]) {
    const controller = new Controller()
    const value = fixture(generation, overrides)
    controller.attachSession(value.attachment)
    let continuationCount = 0
    await assert.rejects(
      controller.runLifecycleMutation('quality-reload', () => {
        continuationCount += 1
      }),
      (error) => error instanceof LifecycleError && error.code === 'RESTORATION_FAILED',
    )
    assert.equal(continuationCount, 0)
    assert.equal(controller.getSnapshot().state, 'failed-stopped')
    assert.equal(controller.getSnapshot().knownOwnershipPreserved, expectedPreserved)
  }

  // (g) Concurrent and repeated teardown calls join one promise and dispose once.
  {
    const disposal = deferred()
    const controller = new Controller()
    const value = fixture(201, { dispose: async () => disposal.promise })
    controller.attachSession(value.attachment)
    const first = controller.teardown('quality-reload')
    const second = controller.teardown('context-loss')
    assert.equal(first, second)
    assert.equal(value.state.restoreCount, 1)
    await Promise.resolve()
    assert.equal(value.state.disposeCount, 1)
    disposal.resolve()
    await Promise.all([first, second])
    assert.equal(controller.teardown('stream-refresh'), first)
    assert.equal(value.state.disposeCount, 1)
  }

  // A cancel callback that reenters through both teardown and mutation sees
  // the already-published authentic join. Neither continuation can pass the
  // boundary until the single adapter disposal has completed.
  {
    const disposal = deferred()
    const controller = new Controller()
    let reentrantTeardown
    let reentrantMutation
    let reentrantContinuationCount = 0
    const value = fixture(202, {
      dispose: async () => disposal.promise,
      onCancel: () => {
        reentrantTeardown = controller.teardown('context-loss')
        reentrantMutation = controller.runLifecycleMutation('model-add', () => {
          reentrantContinuationCount += 1
          value.events.push('reentrant-continuation')
        })
      },
    })
    controller.attachSession(value.attachment)
    let outerContinuationCount = 0
    const outerMutation = controller.runLifecycleMutation('model-load', () => {
      outerContinuationCount += 1
      value.events.push('outer-continuation')
    })
    const publicJoin = controller.teardown('stream-refresh')
    assert.equal(reentrantTeardown, publicJoin)
    assert.equal(reentrantContinuationCount, 0)
    assert.equal(outerContinuationCount, 0)
    assert.equal(value.state.restoreCount, 1)
    await Promise.resolve()
    assert.equal(value.state.disposeCount, 1)
    disposal.resolve()
    await Promise.all([publicJoin, reentrantMutation, outerMutation])
    assert.equal(reentrantContinuationCount, 1)
    assert.equal(outerContinuationCount, 1)
    assert.equal(value.state.disposeCount, 1)
    const disposalIndex = value.events.indexOf('dispose-complete')
    assert.ok(disposalIndex < value.events.indexOf('reentrant-continuation'))
    assert.ok(disposalIndex < value.events.indexOf('outer-continuation'))
  }

  // A restore callback may also request controller disposal. The disposal
  // handle is published before reentry, adapter disposal remains singular,
  // and the outer destructive continuation loses authorization at the join.
  {
    const disposal = deferred()
    const controller = new Controller()
    let reentrantDisposal
    let outerContinuationCount = 0
    const value = fixture(2021, {
      dispose: async () => disposal.promise,
      onRestore: () => {
        reentrantDisposal = controller.dispose()
      },
    })
    controller.attachSession(value.attachment)
    const outerMutation = controller.runLifecycleMutation('quality-reload', () => {
      outerContinuationCount += 1
    })
    assert.equal(controller.dispose(), reentrantDisposal)
    assert.equal(outerContinuationCount, 0)
    await Promise.resolve()
    assert.equal(value.state.disposeCount, 1)
    disposal.resolve()
    await reentrantDisposal
    await assert.rejects(
      outerMutation,
      (error) => error instanceof LifecycleError && error.code === 'DISPOSED',
    )
    assert.equal(outerContinuationCount, 0)
    assert.equal(value.state.disposeCount, 1)
  }

  // A restore callback entered from a terminal focus-failure teardown sees
  // the authentic join, while a destructive mutation is rejected immediately.
  {
    const disposal = deferred()
    const controller = new Controller()
    let restoreJoin
    let terminalReentryError
    let destructiveContinuationCount = 0
    const value = fixture(203, {
      updateFocus: async () => { throw new Error('terminal publication failure') },
      dispose: async () => disposal.promise,
      onRestore: () => {
        restoreJoin = controller.teardown('quality-reload')
        try {
          controller.runLifecycleMutation('model-remove', () => {
            destructiveContinuationCount += 1
          })
        } catch (error) {
          terminalReentryError = error
        }
      },
    })
    controller.attachSession(value.attachment)
    await assert.rejects(
      controller.queueWorldFocus(world(203, 11)),
      (error) => error instanceof LifecycleError && error.code === 'PUBLICATION_FAILED',
    )
    const publicJoin = controller.teardown('stream-refresh')
    assert.equal(restoreJoin, publicJoin)
    assert.equal(terminalReentryError instanceof LifecycleError, true)
    assert.equal(terminalReentryError.code, 'FAIL_STOPPED')
    assert.equal(destructiveContinuationCount, 0)
    await Promise.resolve()
    assert.equal(value.state.disposeCount, 1)
    disposal.resolve()
    await publicJoin
    assert.equal(controller.getSnapshot().state, 'failed-stopped')
    assert.equal(destructiveContinuationCount, 0)
    await controller.dispose()
    assert.equal(value.state.disposeCount, 1)
  }

  // (h) A completion retained by an old adapter cannot publish after replacement.
  {
    const late = deferred()
    let oldCanPublish
    const controller = new Controller()
    const old = fixture(300, {
      updateFocus: async (request) => {
        oldCanPublish = request.canPublish
        void late.promise.then(() => {
          if (request.canPublish()) old.published.push(['late-old-publication'])
        })
      },
    })
    controller.attachSession(old.attachment)
    await controller.queueWorldFocus(world(300, 11))
    await controller.teardown('context-loss')
    const replacement = fixture(301)
    controller.attachSession(replacement.attachment)
    await controller.queueWorldFocus(world(301, 14))
    assert.equal(oldCanPublish(), false)
    late.resolve()
    await Promise.resolve()
    assert.deepEqual(old.published, [[1, 0, 0]])
    assert.deepEqual(replacement.published, [[4, 0, 0]])
    await controller.dispose()
  }

  // Terminal-race regression: a destructive mutation cannot join a failed
  // publication teardown during its asynchronous disposal window.
  {
    const disposal = deferred()
    const controller = new Controller()
    const value = fixture(399, {
      updateFocus: async () => { throw new Error('publication failed') },
      dispose: async () => disposal.promise,
    })
    controller.attachSession(value.attachment)
    await assert.rejects(
      controller.queueWorldFocus(world(399, 11)),
      (error) => error instanceof LifecycleError && error.code === 'PUBLICATION_FAILED',
    )
    await Promise.resolve()
    assert.equal(controller.getSnapshot().state, 'tearing-down')
    assert.equal(value.state.disposeCount, 1)
    let destructiveContinuationCount = 0
    assert.throws(
      () => controller.runLifecycleMutation('model-load', () => {
        destructiveContinuationCount += 1
      }),
      (error) => error instanceof LifecycleError && error.code === 'FAIL_STOPPED',
    )
    assert.equal(destructiveContinuationCount, 0)
    disposal.resolve()
    await controller.dispose()
    assert.equal(destructiveContinuationCount, 0)
  }

  // (i) Disposal is terminal for both attachment and focus submission.
  {
    const controller = new Controller()
    const value = fixture(400)
    controller.attachSession(value.attachment)
    const firstDispose = controller.dispose()
    const secondDispose = controller.dispose()
    assert.equal(firstDispose, secondDispose)
    await firstDispose
    assert.throws(
      () => controller.attachSession(fixture(401).attachment),
      (error) => error instanceof LifecycleError && error.code === 'DISPOSED',
    )
    assert.throws(
      () => controller.queueWorldFocus(world(400, 11)),
      (error) => error instanceof LifecycleError && error.code === 'DISPOSED',
    )
    assert.equal(value.state.disposeCount, 1)
  }

  // (j) Inspection is cleared immediately before every adapter attempt.
  {
    const controller = new Controller()
    const value = fixture(500)
    controller.attachSession(value.attachment)
    await controller.queueWorldFocus(world(500, 11))
    await controller.queueWorldFocus(world(500, 12))
    const relevant = value.events.filter((entry) => entry === 'inspect-clear' || entry.startsWith('adapter-start:'))
    assert.deepEqual(relevant, [
      'inspect-clear', 'adapter-start:1',
      'inspect-clear', 'adapter-start:2',
    ])
    assert.equal(value.state.inspectCount, value.calls.length)
    await controller.dispose()
  }

  console.log(JSON.stringify({
    status: 'PASS',
    contract: 'development-repeat-six-part-viewer-lifecycle-controller',
    cases: 'a-j',
    mutationReasons,
    activationAuthorized: false,
    productionIntegration: false,
  }, null, 2))
} finally {
  await vite.close()
}
