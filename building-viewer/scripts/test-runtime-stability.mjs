import assert from 'node:assert/strict'
import { createServer } from 'vite'

const browser = {
  devicePixelRatio: 2,
}
const navigatorStub = {
  hardwareConcurrency: 8,
  deviceMemory: 8,
  userAgent: 'Runtime stability test',
  xr: undefined,
}

Object.defineProperty(globalThis, 'window', {
  value: browser,
  configurable: true,
})
Object.defineProperty(globalThis, 'navigator', {
  value: navigatorStub,
  configurable: true,
})

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { QualityManager, getQualityProfile } = await vite.ssrLoadModule(
    '/src/performance/QualityManager.ts',
  )
  const { XRManager } = await vite.ssrLoadModule('/src/xr/XRManager.ts')
  const { ModelLoader } = await vite.ssrLoadModule('/src/scene/ModelLoader.ts')
  const { ModelManager } = await vite.ssrLoadModule('/src/scene/ModelManager.ts')
  const { CellStreamLoader } = await vite.ssrLoadModule('/src/scene/CellStreamLoader.ts')
  const { BoxGeometry, Group, Mesh, MeshBasicMaterial } = await import('three')

  // AUTO ignores a transient spike, then steps High -> Balanced only after
  // sustained p95 pressure and the startup warmup.
  {
    const quality = new QualityManager('DESKTOP_BALANCED')
    assert.equal(quality.setPreferred('AUTO').id, 'DESKTOP_HIGH')
    quality.notePerformance({ fps: 20, rafP95Ms: 55, nowMs: 0 })
    for (let i = 1; i <= 7; i += 1) {
      quality.notePerformance({
        fps: 20,
        rafP95Ms: 55,
        cpuP95Ms: 36,
        gpuP95Ms: 38,
        nowMs: 8_000 + i * 250,
      })
    }
    assert.equal(quality.getProfile().id, 'DESKTOP_HIGH')
    quality.notePerformance({ fps: 20, rafP95Ms: 55, nowMs: 10_000 })
    assert.equal(quality.getProfile().id, 'DESKTOP_BALANCED')

    // Crossing the Web/Quest asset boundary takes a longer severe window and
    // the cooldown. Once crossed, healthy FPS cannot cause a reload loop.
    for (let i = 1; i <= 30; i += 1) {
      quality.notePerformance({
        fps: 18,
        rafP95Ms: 60,
        cpuP95Ms: 40,
        gpuP95Ms: 42,
        nowMs: 10_000 + i * 250,
      })
    }
    assert.equal(quality.getProfile().id, 'DESKTOP_BALANCED')
    quality.notePerformance({
      fps: 18,
      rafP95Ms: 60,
      cpuP95Ms: 40,
      gpuP95Ms: 42,
      nowMs: 25_100,
    })
    assert.equal(quality.getProfile().id, 'QUEST')
    for (let i = 1; i <= 200; i += 1) {
      quality.notePerformance({
        fps: 60,
        rafP95Ms: 16.7,
        cpuP95Ms: 5,
        gpuP95Ms: 6,
        nowMs: 25_100 + i * 250,
      })
    }
    assert.equal(quality.getProfile().id, 'QUEST')
    assert.equal(quality.setPreferred('DESKTOP_HIGH').id, 'DESKTOP_HIGH')

    const questProfile = getQualityProfile('QUEST')
    assert.equal(questProfile.xrFramebufferScale, 0.9)
    assert.equal(Object.isFrozen(questProfile), true)
    assert.equal(quality.getPreferred(), 'DESKTOP_HIGH')
  }

  // requestSession is invoked synchronously, before any support probe/await,
  // and concurrent clicks share one in-flight request.
  {
    const events = []
    let resolveSession
    let resolveSessionInstall
    let activation = true
    let presenting = false
    const endHandlers = []
    const session = {
      frameRate: 72,
      inputSources: [],
      addEventListener(name, handler) {
        if (name === 'end') endHandlers.push(handler)
      },
      async end() {
        presenting = false
        for (const handler of endHandlers.splice(0)) handler()
      },
    }
    navigatorStub.xr = {
      async isSessionSupported() {
        events.push('support')
        return true
      },
      requestSession() {
        assert.equal(activation, true, 'requestSession lost transient activation')
        events.push('request')
        activation = false
        return new Promise((resolve) => {
          resolveSession = resolve
        })
      },
    }
    const renderer = {
      xr: {
        enabled: false,
        setSession() {
          events.push('set-session')
          presenting = true
          return new Promise((resolve) => {
            resolveSessionInstall = resolve
          })
        },
        getFoveation() {
          return 0
        },
        setFoveation() {},
        setFramebufferScaleFactor(scale) {
          assert.equal(presenting, false, 'framebuffer scale changed during presentation')
          events.push(`scale:${scale}`)
        },
      },
    }
    const xr = new XRManager(renderer)
    const first = xr.enterVR(0.9)
    const second = xr.enterVR(0.9)
    assert.equal(first, second)
    assert.deepEqual(events, ['request', 'scale:0.9'])
    resolveSession(session)
    await Promise.resolve()
    const third = xr.enterVR(0.7)
    assert.equal(third, first)
    assert.deepEqual(events, ['request', 'scale:0.9', 'set-session'])
    resolveSessionInstall()
    assert.equal(await first, true)
    assert.deepEqual(events, ['request', 'scale:0.9', 'set-session'])
    assert.equal(xr.isActive(), true)
    await xr.exitVR()
    assert.equal(xr.isActive(), false)
  }

  // A late requestSession result after disposal is ended and never installed
  // into Three's WebXR manager.
  {
    const events = []
    let resolveSession
    let endCount = 0
    const session = {
      frameRate: 72,
      inputSources: [],
      addEventListener() {},
      async end() {
        endCount += 1
        events.push('end')
      },
    }
    navigatorStub.xr = {
      requestSession() {
        events.push('request')
        return new Promise((resolve) => {
          resolveSession = resolve
        })
      },
    }
    const renderer = {
      xr: {
        enabled: false,
        async setSession() {
          events.push('set-session')
        },
        setFramebufferScaleFactor(scale) {
          events.push(`scale:${scale}`)
        },
      },
    }
    const xr = new XRManager(renderer)
    const entering = xr.enterVR(0.8)
    assert.deepEqual(events, ['request', 'scale:0.8'])
    xr.dispose()
    resolveSession(session)
    assert.equal(await entering, false)
    assert.equal(endCount, 1)
    assert.deepEqual(events, ['request', 'scale:0.8', 'end'])
    assert.equal(xr.isActive(), false)
    assert.equal(await xr.enterVR(0.8), false)
  }

  // A superseded model request forwards AbortSignal to fetch and exits as an
  // AbortError instead of completing later and replacing the current scene.
  {
    const originalFetch = globalThis.fetch
    const controller = new AbortController()
    let observedSignal
    globalThis.fetch = (_url, init) => {
      observedSignal = init?.signal
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        )
      })
    }
    const loader = new ModelLoader(() => null)
    try {
      const pending = loader.loadUrl('/slow.glb', undefined, controller.signal)
      controller.abort()
      await assert.rejects(pending, (error) => error?.name === 'AbortError')
      assert.equal(observedSignal, controller.signal)
    } finally {
      loader.dispose()
      globalThis.fetch = originalFetch
    }
  }

  // A full variant replacement is staged off-scene: the committed layer stays
  // visible until every replacement has loaded, and an aborted stage cannot
  // clear or overwrite it.
  {
    const manager = new ModelManager(() => null)
    const makeResult = (name) => {
      const root = new Group()
      root.name = name
      return {
        root,
        url: name,
        transferredBytes: 1,
        downloadMs: 1,
        parseMs: 1,
        fileSizeBytes: 1,
        animations: [],
      }
    }
    try {
      manager.loader.loadUrl = async (url) => makeResult(url)
      await manager.loadLayers(
        [{ id: 'old', name: 'Old', web: '/old.glb' }],
        'web',
      )
      assert.equal(manager.listLayers()[0]?.id, 'old')

      let finishReplacement
      manager.loader.loadUrl = () => new Promise((resolve) => {
        finishReplacement = () => resolve(makeResult('/new.glb'))
      })
      const replacement = manager.loadLayers(
        [{ id: 'new', name: 'New', web: '/new.glb' }],
        'web',
      )
      assert.equal(manager.listLayers()[0]?.id, 'old')
      assert.equal(manager.root.children[0]?.name, 'Model:old')
      finishReplacement()
      await replacement
      assert.equal(manager.listLayers()[0]?.id, 'new')
      assert.equal(manager.root.children[0]?.name, 'Model:new')

      manager.loader.loadUrl = (_url, _progress, signal) => new Promise((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        )
      })
      const controller = new AbortController()
      const superseded = manager.loadLayers(
        [{ id: 'stale', name: 'Stale', web: '/stale.glb' }],
        'web',
        undefined,
        undefined,
        controller.signal,
      )
      controller.abort()
      await assert.rejects(superseded, (error) => error?.name === 'AbortError')
      assert.equal(manager.listLayers()[0]?.id, 'new')
      assert.equal(manager.root.children[0]?.name, 'Model:new')

      let localSignal
      manager.loader.loadArrayBuffer = (_buffer, _name, _progress, signal) => {
        localSignal = signal
        return new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        })
      }
      const localController = new AbortController()
      const local = manager.loadLocalFile(
        { name: 'local.glb', arrayBuffer: async () => new ArrayBuffer(8) },
        undefined,
        localController.signal,
      )
      await Promise.resolve()
      assert.equal(localSignal, localController.signal)
      assert.equal(manager.listLayers()[0]?.id, 'new')
      localController.abort()
      await assert.rejects(local, (error) => error?.name === 'AbortError')
      assert.equal(manager.listLayers()[0]?.id, 'new')
    } finally {
      manager.dispose()
    }
  }

  // Disposing a cell stream aborts its in-flight work and disposes a decoder
  // result that resolves late instead of attaching it to a dead scene root.
  {
    let finishCell
    let geometryDisposed = false
    const lateGeometry = new BoxGeometry(1, 1, 1)
    lateGeometry.addEventListener('dispose', () => {
      geometryDisposed = true
    })
    const lateRoot = new Group()
    lateRoot.add(new Mesh(lateGeometry, new MeshBasicMaterial()))
    const loader = {
      loadUrl() {
        return new Promise((resolve) => {
          finishCell = () => resolve({
            root: lateRoot,
            url: '/cell.glb',
            transferredBytes: 1,
            downloadMs: 1,
            parseMs: 1,
            fileSizeBytes: 1,
            animations: [],
          })
        })
      },
    }
    const stream = new CellStreamLoader(loader)
    stream.manifest = {
      version: 2,
      modelId: 'stream',
      sceneMin: [0, 0, 0],
      sceneMax: [10, 10, 10],
      bandHeight: 4,
      cellSize: [10, 4, 10],
      cells: [{
        id: 'cell',
        floorBand: 0,
        cell: [0, 0, 0],
        boundsMin: [0, 0, 0],
        boundsMax: [1, 1, 1],
        url: 'cell.glb',
        triangles: 12,
        alwaysOn: true,
      }],
    }
    stream.attachLayer({ id: 'stream', name: 'Stream', web: '/stream.glb' }, new Group())
    const pending = stream.syncFocus({ x: 0, y: 0, z: 0 })
    stream.dispose()
    finishCell()
    await assert.rejects(pending, (error) => error?.name === 'AbortError')
    assert.equal(geometryDisposed, true)
  }

  console.log('Runtime stability tests passed')
} finally {
  await vite.close()
}
