export type LiveRenderStats = {
  fps: number
  avgFps: number
  /** Uncapped rAF interval (ms). This is not JavaScript CPU time. */
  frameTimeMs: number
  worstFrameMs: number
  /** Main-thread work this frame (beginFrame → endFrame), excluding vsync wait. */
  jsCpuMs: number
  cpuWalkMs: number
  cpuAnimMs: number
  cpuLodMs: number
  cpuRenderMs: number
  /** Latest resolved GPU frame time (ms), or null if unsupported / not yet ready. */
  gpuFrameMs: number | null
  /** rAF interval percentiles (includes idle/vsync). */
  rafMedianMs: number
  rafP95Ms: number
  rafP99Ms: number
  /** Main-thread JS percentiles. */
  cpuMedianMs: number
  cpuP95Ms: number
  cpuP99Ms: number
  gpuMedianMs: number | null
  gpuP95Ms: number | null
  gpuP99Ms: number | null
  width: number
  height: number
  pixelRatio: number
  drawCalls: number
  triangles: number
  points: number
  lines: number
  geometries: number
  textures: number
  qualityProfile: string
  detailLod: string
  collision: string
  renderer: string
  xrActive: boolean
  xrFrameRate: number | null
  xrFoveation: number | null
}

type GpuExt = {
  TIME_ELAPSED_EXT: number
  GPU_DISJOINT_EXT: number
}

type PendingGpuQuery = {
  query: WebGLQuery
  /** performance.now() when the query was ended */
  endedAt: number
}

type GpuTimerState = {
  ext: GpuExt | null
  gl: WebGL2RenderingContext | null
  active: WebGLQuery | null
  pending: PendingGpuQuery[]
  ms: number | null
  supported: boolean
}

const GPU_RING_MAX = 8
const GPU_QUERY_TIMEOUT_MS = 2000
const PERCENTILE_WINDOW = 120

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx]!
}

function ringPush(buf: Float32Array, index: { i: number; n: number }, value: number): void {
  buf[index.i] = value
  index.i = (index.i + 1) % buf.length
  if (index.n < buf.length) index.n += 1
}

function ringStats(buf: Float32Array, count: number): { median: number; p95: number; p99: number } {
  if (count <= 0) return { median: 0, p95: 0, p99: 0 }
  const tmp = Array.from(buf.subarray(0, count)).sort((a, b) => a - b)
  return {
    median: percentile(tmp, 0.5),
    p95: percentile(tmp, 0.95),
    p99: percentile(tmp, 0.99),
  }
}

/**
 * Allocation-conscious performance monitor.
 * Call beginFrame/endFrame every frame; sample getSnapshot at a lower rate for UI.
 * Optional WebGL2 disjoint timer queries for GPU elapsed time (pending-query ring).
 */
export class PerformanceMonitor {
  private frames = 0
  private elapsed = 0
  private fps = 0
  private avgFps = 0
  private frameTimeMs = 0
  private worstFrameMs = 0
  private worstWindowMs = 0
  private lastSample = 0
  private readonly fpsHistory = new Float32Array(120)
  private fpsHistoryIndex = 0
  private fpsHistoryCount = 0

  private sectionStart = 0
  private walkMs = 0
  private animMs = 0
  private lodMs = 0
  private renderMs = 0
  private walkAcc = 0
  private animAcc = 0
  private lodAcc = 0
  private renderAcc = 0
  private sectionSamples = 0

  private readonly cpuFrameBuf = new Float32Array(PERCENTILE_WINDOW)
  private readonly cpuFrameIdx = { i: 0, n: 0 }
  private readonly rafFrameBuf = new Float32Array(PERCENTILE_WINDOW)
  private readonly rafFrameIdx = { i: 0, n: 0 }
  private readonly gpuFrameBuf = new Float32Array(PERCENTILE_WINDOW)
  private readonly gpuFrameIdx = { i: 0, n: 0 }
  private jsStart = 0
  private jsCpuMs = 0

  private readonly gpu: GpuTimerState = {
    ext: null,
    gl: null,
    active: null,
    pending: [],
    ms: null,
    supported: false,
  }

  attachRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext | null): void {
    this.clearPendingGpu()
    this.resetGpuSamples()
    this.gpu.ext = null
    this.gpu.gl = null
    this.gpu.supported = false
    this.gpu.ms = null
    this.gpu.active = null
    if (!gl || !('createQuery' in gl)) return
    const gl2 = gl as WebGL2RenderingContext
    const ext = gl2.getExtension('EXT_disjoint_timer_query_webgl2') as GpuExt | null
    if (!ext) return
    this.gpu.gl = gl2
    this.gpu.ext = ext
    this.gpu.supported = true
  }

  private clearPendingGpu(): void {
    const gl = this.gpu.gl
    if (!gl) {
      this.gpu.pending = []
      this.gpu.active = null
      return
    }
    for (const p of this.gpu.pending) {
      try {
        gl.deleteQuery(p.query)
      } catch {
        /* ignore */
      }
    }
    this.gpu.pending = []
    if (this.gpu.active) {
      try {
        gl.deleteQuery(this.gpu.active)
      } catch {
        /* ignore */
      }
      this.gpu.active = null
    }
  }

  private resetGpuSamples(): void {
    this.gpuFrameBuf.fill(0)
    this.gpuFrameIdx.i = 0
    this.gpuFrameIdx.n = 0
  }

  beginFrame(_now: number): void {
    this.sectionStart = performance.now()
    this.jsStart = this.sectionStart
    this.pollGpu()
  }

  /** Close the previous section and start the next. */
  markSection(name: 'walk' | 'anim' | 'lod' | 'render' | null): void {
    const t = performance.now()
    const dt = t - this.sectionStart
    this.sectionStart = t
    if (name === 'walk') this.walkMs = dt
    else if (name === 'anim') this.animMs = dt
    else if (name === 'lod') this.lodMs = dt
    else if (name === 'render') this.renderMs = dt
  }

  /** Begin GPU timer around renderer.render(). */
  beginGpu(): void {
    if (!this.gpu.supported || !this.gpu.ext || !this.gpu.gl) return
    if (this.gpu.active) return
    // Cap in-flight queries so we do not grow without bound if results stall.
    if (this.gpu.pending.length >= GPU_RING_MAX) {
      this.pollGpu()
      // Never evict an unresolved query just to submit another one. On slower
      // mobile GPUs results can legitimately take more than eight frames.
      if (this.gpu.pending.length >= GPU_RING_MAX) return
    }
    let q: WebGLQuery | null = null
    try {
      q = this.gpu.gl.createQuery()
      if (!q) return
      this.gpu.gl.beginQuery(this.gpu.ext.TIME_ELAPSED_EXT, q)
      this.gpu.active = q
    } catch {
      if (q) {
        try {
          this.gpu.gl.deleteQuery(q)
        } catch {
          /* ignore */
        }
      }
      this.gpu.supported = false
    }
  }

  endGpu(): void {
    if (!this.gpu.active) return
    const query = this.gpu.active
    this.gpu.active = null
    if (!this.gpu.ext || !this.gpu.gl) return
    try {
      this.gpu.gl.endQuery(this.gpu.ext.TIME_ELAPSED_EXT)
      this.gpu.pending.push({ query, endedAt: performance.now() })
    } catch {
      try {
        this.gpu.gl.deleteQuery(query)
      } catch {
        /* ignore */
      }
      this.gpu.supported = false
    }
  }

  private pollGpu(): void {
    if (!this.gpu.ext || !this.gpu.gl || this.gpu.pending.length === 0) return
    const now = performance.now()
    const remaining: PendingGpuQuery[] = []

    try {
      const disjoint = Boolean(this.gpu.gl.getParameter(this.gpu.ext.GPU_DISJOINT_EXT))

      // A disjoint event invalidates every outstanding timing result, including
      // queries that are not available yet. Do not read them on a later frame.
      if (disjoint) {
        for (const entry of this.gpu.pending) {
          try {
            this.gpu.gl.deleteQuery(entry.query)
          } catch {
            /* ignore */
          }
        }
        this.gpu.pending = []
        this.gpu.ms = null
        this.resetGpuSamples()
        return
      }

      for (const entry of this.gpu.pending) {
        if (now - entry.endedAt > GPU_QUERY_TIMEOUT_MS) {
          try {
            this.gpu.gl.deleteQuery(entry.query)
          } catch {
            /* ignore */
          }
          continue
        }

        const available = this.gpu.gl.getQueryParameter(
          entry.query,
          this.gpu.gl.QUERY_RESULT_AVAILABLE,
        )
        if (!available) {
          remaining.push(entry)
          continue
        }

        const ns = this.gpu.gl.getQueryParameter(entry.query, this.gpu.gl.QUERY_RESULT) as number
        if (typeof ns === 'number' && Number.isFinite(ns)) {
          const ms = ns / 1e6
          this.gpu.ms = ms
          ringPush(this.gpuFrameBuf, this.gpuFrameIdx, ms)
        }
        try {
          this.gpu.gl.deleteQuery(entry.query)
        } catch {
          /* ignore */
        }
      }
      this.gpu.pending = remaining
    } catch {
      this.clearPendingGpu()
      this.gpu.ms = null
      this.resetGpuSamples()
      this.gpu.supported = false
    }
  }

  endFrame(dt: number, now: number, rawDt = dt): void {
    const measuredDt = Number.isFinite(rawDt) && rawDt > 0 ? rawDt : dt
    this.frames += 1
    this.elapsed += measuredDt
    this.frameTimeMs = measuredDt * 1000
    this.jsCpuMs = Math.max(0, performance.now() - this.jsStart)
    if (this.frameTimeMs > this.worstWindowMs) this.worstWindowMs = this.frameTimeMs
    ringPush(this.rafFrameBuf, this.rafFrameIdx, this.frameTimeMs)
    ringPush(this.cpuFrameBuf, this.cpuFrameIdx, this.jsCpuMs)

    this.walkAcc += this.walkMs
    this.animAcc += this.animMs
    this.lodAcc += this.lodMs
    this.renderAcc += this.renderMs
    this.sectionSamples += 1

    this.fpsHistory[this.fpsHistoryIndex] = measuredDt > 0 ? 1 / measuredDt : 0
    this.fpsHistoryIndex = (this.fpsHistoryIndex + 1) % this.fpsHistory.length
    if (this.fpsHistoryCount < this.fpsHistory.length) this.fpsHistoryCount += 1

    if (now - this.lastSample >= 250) {
      this.fps = this.elapsed > 0 ? this.frames / this.elapsed : 0
      let sum = 0
      for (let i = 0; i < this.fpsHistoryCount; i++) sum += this.fpsHistory[i]!
      this.avgFps = this.fpsHistoryCount > 0 ? sum / this.fpsHistoryCount : this.fps
      this.worstFrameMs = this.worstWindowMs
      this.worstWindowMs = 0
      this.frames = 0
      this.elapsed = 0
      this.lastSample = now
    }
  }

  getSnapshot(input: {
    width: number
    height: number
    pixelRatio: number
    drawCalls: number
    triangles: number
    points: number
    lines: number
    geometries: number
    textures: number
    qualityProfile: string
    detailLod: string
    collision: string
    renderer: string
    xrActive: boolean
    xrFrameRate: number | null
    xrFoveation: number | null
  }): LiveRenderStats {
    const n = Math.max(1, this.sectionSamples)
    const cpuWalkMs = this.walkAcc / n
    const cpuAnimMs = this.animAcc / n
    const cpuLodMs = this.lodAcc / n
    const cpuRenderMs = this.renderAcc / n
    this.walkAcc = 0
    this.animAcc = 0
    this.lodAcc = 0
    this.renderAcc = 0
    this.sectionSamples = 0

    const cpu = ringStats(this.cpuFrameBuf, this.cpuFrameIdx.n)
    const raf = ringStats(this.rafFrameBuf, this.rafFrameIdx.n)
    const gpu = ringStats(this.gpuFrameBuf, this.gpuFrameIdx.n)
    const hasGpu = this.gpu.supported && this.gpuFrameIdx.n > 0

    return {
      fps: this.fps,
      avgFps: this.avgFps,
      frameTimeMs: this.frameTimeMs,
      worstFrameMs: this.worstFrameMs,
      jsCpuMs: this.jsCpuMs,
      cpuWalkMs,
      cpuAnimMs,
      cpuLodMs,
      cpuRenderMs,
      gpuFrameMs: this.gpu.supported ? this.gpu.ms : null,
      rafMedianMs: raf.median,
      rafP95Ms: raf.p95,
      rafP99Ms: raf.p99,
      cpuMedianMs: cpu.median,
      cpuP95Ms: cpu.p95,
      cpuP99Ms: cpu.p99,
      gpuMedianMs: hasGpu ? gpu.median : null,
      gpuP95Ms: hasGpu ? gpu.p95 : null,
      gpuP99Ms: hasGpu ? gpu.p99 : null,
      ...input,
    }
  }
}
