import assert from 'node:assert/strict'
import { createServer } from 'vite'

const SNAPSHOT_INPUT = {
  width: 1,
  height: 1,
  pixelRatio: 1,
  drawCalls: 0,
  triangles: 0,
  points: 0,
  lines: 0,
  geometries: 0,
  textures: 0,
  qualityProfile: 'test',
  detailLod: 'test',
  collision: 'test',
  renderer: 'test',
  xrActive: false,
  xrFrameRate: null,
  xrFoveation: null,
}

function createGpuContext() {
  const extension = {
    TIME_ELAPSED_EXT: 0x88bf,
    GPU_DISJOINT_EXT: 0x8fbb,
  }
  const created = []
  const deleted = []
  let active = null
  let disjoint = false

  const gl = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
    getExtension(name) {
      return name === 'EXT_disjoint_timer_query_webgl2' ? extension : null
    },
    createQuery() {
      const query = {
        id: created.length + 1,
        available: false,
        result: 5_000_000,
      }
      created.push(query)
      return query
    },
    deleteQuery(query) {
      deleted.push(query.id)
    },
    beginQuery(target, query) {
      assert.equal(target, extension.TIME_ELAPSED_EXT)
      assert.equal(active, null)
      active = query
    },
    endQuery(target) {
      assert.equal(target, extension.TIME_ELAPSED_EXT)
      assert.notEqual(active, null)
      active = null
    },
    getQueryParameter(query, pname) {
      if (pname === gl.QUERY_RESULT_AVAILABLE) return query.available
      if (pname === gl.QUERY_RESULT) return query.result
      throw new Error(`Unexpected query parameter: ${pname}`)
    },
    getParameter(pname) {
      assert.equal(pname, extension.GPU_DISJOINT_EXT)
      return disjoint
    },
  }

  return {
    gl,
    created,
    deleted,
    setDisjoint(value) {
      disjoint = value
    },
  }
}

function state(monitor) {
  // TypeScript `private` fields compile to ordinary properties; this test uses
  // them only to verify the bounded in-flight queue and cleanup invariants.
  return monitor.gpu
}

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

try {
  const { PerformanceMonitor } = await vite.ssrLoadModule(
    '/src/performance/PerformanceMonitor.ts',
  )

  // A standards-shaped WebGL2 context resolves a delayed query and records ms.
  {
    const gpu = createGpuContext()
    const monitor = new PerformanceMonitor()
    monitor.attachRenderer(gpu.gl)
    monitor.beginFrame(0)
    monitor.beginGpu()
    monitor.endGpu()
    gpu.created[0].available = true
    monitor.beginFrame(16)

    const snapshot = monitor.getSnapshot(SNAPSHOT_INPUT)
    assert.equal(snapshot.gpuFrameMs, 5)
    assert.equal(snapshot.gpuMedianMs, 5)
    assert.deepEqual(gpu.deleted, [1])
    assert.equal(state(monitor).supported, true)
  }

  // Eight unresolved queries fill the ring. The ninth frame must skip a new
  // query rather than delete the oldest result before it becomes available.
  {
    const gpu = createGpuContext()
    const monitor = new PerformanceMonitor()
    monitor.attachRenderer(gpu.gl)
    for (let i = 0; i < 8; i += 1) {
      monitor.beginFrame(i * 16)
      monitor.beginGpu()
      monitor.endGpu()
    }
    assert.equal(gpu.created.length, 8)
    assert.equal(state(monitor).pending.length, 8)

    monitor.beginFrame(128)
    monitor.beginGpu()
    monitor.endGpu()
    assert.equal(gpu.created.length, 8)
    assert.equal(gpu.deleted.length, 0)

    gpu.created[0].available = true
    monitor.beginFrame(144)
    monitor.beginGpu()
    monitor.endGpu()
    assert.equal(gpu.created.length, 9)
    assert.equal(state(monitor).pending.length, 8)
    assert.deepEqual(gpu.deleted, [1])

    // A disjoint event invalidates every outstanding query and timing sample.
    gpu.setDisjoint(true)
    monitor.beginFrame(160)
    assert.equal(state(monitor).pending.length, 0)
    assert.equal(gpu.deleted.length, 9)
    const snapshot = monitor.getSnapshot(SNAPSHOT_INPUT)
    assert.equal(snapshot.gpuFrameMs, null)
    assert.equal(snapshot.gpuMedianMs, null)
    assert.equal(state(monitor).supported, true)
  }

  // Reattaching a renderer deletes old pending work and clears stale samples.
  {
    const first = createGpuContext()
    const second = createGpuContext()
    const monitor = new PerformanceMonitor()
    monitor.attachRenderer(first.gl)

    monitor.beginFrame(0)
    monitor.beginGpu()
    monitor.endGpu()
    first.created[0].available = true
    monitor.beginFrame(16)
    assert.equal(monitor.getSnapshot(SNAPSHOT_INPUT).gpuFrameMs, 5)

    monitor.beginGpu()
    monitor.endGpu()
    assert.equal(state(monitor).pending.length, 1)
    monitor.attachRenderer(second.gl)
    assert.deepEqual(first.deleted, [1, 2])
    assert.equal(state(monitor).pending.length, 0)
    assert.equal(monitor.getSnapshot(SNAPSHOT_INPUT).gpuFrameMs, null)
    assert.equal(state(monitor).supported, true)
  }

  // Rendering/physics may clamp simulation dt, but FPS and rAF telemetry must
  // use the real frame interval so slow frames can report below 20 FPS.
  {
    const monitor = new PerformanceMonitor()
    monitor.beginFrame(0)
    monitor.endFrame(0.05, 300, 0.2)
    const snapshot = monitor.getSnapshot(SNAPSHOT_INPUT)
    assert.equal(snapshot.fps, 5)
    assert.equal(snapshot.avgFps, 5)
    assert.equal(snapshot.frameTimeMs, 200)
  }

  console.log('PerformanceMonitor GPU timer tests passed')
} finally {
  await vite.close()
}
