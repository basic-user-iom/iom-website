import type { LiveRenderStats } from './PerformanceMonitor'



export type QuestTestSample = {

  t: number

  fps: number

  cpuMs: number

  rafMs?: number

  gpuMs: number | null

  drawCalls: number

  triangles: number

  collisionTris: number

  collisionResidentTris?: number

  xrFrameRate?: number | null

  label: string

}



export type QuestTestMeta = {

  runId: string

  label: string

  href: string

  userAgent: string

  qualityProfile?: string

  xrActive?: boolean

}



export type QuestTestReport = {

  meta: QuestTestMeta

  startedAt: number

  endedAt: number

  durationSec: number

  sampleCount: number

  samples: QuestTestSample[]

  cpuMedian: number

  cpuP95: number

  cpuP99: number

  gpuMedian: number | null

  gpuP95: number | null

  gpuP99: number | null

  gpuAvailable: boolean

  minFps: number

  medianFps: number

  drawCallsP95: number

  trianglesP95: number

  /** 72 Hz Quest bar: min FPS ≥ 72 and CPU p95 ≤ 13.89 ms (GPU p95 too when queries exist). */

  pass72: boolean

  notes: string[]

}



/**

 * In-browser Quest tuning loop (Phase D).

 *

 *   __iomQuestTest.start('lobby')

 *   // walk / orbit / XR …

 *   __iomQuestTest.stop()      // logs + returns report

 *   __iomQuestTest.download()  // writes JSON

 */

export class QuestTestHarness {

  private active = false

  private startedAt = 0

  private samples: QuestTestSample[] = []

  private label = 'sample'

  private sampleIntervalMs = 500

  private lastSample = 0

  private lastReport: QuestTestReport | null = null

  private qualityProfile = ''

  private xrActive = false



  setContext(opts: { qualityProfile?: string; xrActive?: boolean }): void {

    if (opts.qualityProfile != null) this.qualityProfile = opts.qualityProfile

    if (opts.xrActive != null) this.xrActive = opts.xrActive

  }



  start(label = 'route'): void {

    this.active = true

    this.startedAt = performance.now()

    this.samples = []

    this.label = label

    this.lastSample = 0

    this.lastReport = null

    console.info('[QuestTest] recording started:', label)

  }



  stop(): QuestTestReport {

    this.active = false

    const endedAt = performance.now()

    const report = this.buildReport(endedAt)

    this.lastReport = report

    console.info('[QuestTest] report', {

      durationSec: report.durationSec,

      minFps: report.minFps,

      cpuP95: report.cpuP95,

      gpuP95: report.gpuP95,

      gpuAvailable: report.gpuAvailable,

      pass72: report.pass72,

      notes: report.notes,

    })

    return report

  }



  download(report?: QuestTestReport): void {

    const data = report ?? this.lastReport

    if (!data) {

      console.warn('[QuestTest] nothing to download — run start() then stop() first')

      return

    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })

    const a = document.createElement('a')

    a.href = URL.createObjectURL(blob)

    a.download = `iom-quest-test-${data.meta.runId}.json`

    a.click()

    URL.revokeObjectURL(a.href)

    console.info('[QuestTest] downloaded', a.download)

  }



  tick(

    live: LiveRenderStats,

    collisionTris: number,

    now = performance.now(),

    extra?: { collisionResidentTris?: number; xrFrameRate?: number | null },

  ): void {

    if (!this.active) return

    if (now - this.lastSample < this.sampleIntervalMs) return

    this.lastSample = now

    this.samples.push({

      t: (now - this.startedAt) / 1000,

      fps: live.fps,

      cpuMs: live.jsCpuMs,
      rafMs: live.frameTimeMs,

      gpuMs: live.gpuFrameMs,

      drawCalls: live.drawCalls,

      triangles: live.triangles,

      collisionTris,

      collisionResidentTris: extra?.collisionResidentTris,

      xrFrameRate: extra?.xrFrameRate ?? null,

      label: this.label,

    })

  }



  isActive(): boolean {

    return this.active

  }



  getLastReport(): QuestTestReport | null {

    return this.lastReport

  }



  private buildReport(endedAt: number): QuestTestReport {

    const cpu = this.samples.map((s) => s.cpuMs).sort((a, b) => a - b)

    const gpuVals = this.samples.map((s) => s.gpuMs).filter((v): v is number => v != null && v > 0)

    gpuVals.sort((a, b) => a - b)

    const fps = this.samples.map((s) => s.fps).sort((a, b) => a - b)

    const draws = this.samples.map((s) => s.drawCalls).sort((a, b) => a - b)

    const tris = this.samples.map((s) => s.triangles).sort((a, b) => a - b)

    const pct = (arr: number[], p: number) =>

      arr.length ? arr[Math.min(arr.length - 1, Math.ceil(p * arr.length) - 1)]! : 0



    const cpuMedian = pct(cpu, 0.5)

    const cpuP95 = pct(cpu, 0.95)

    const cpuP99 = pct(cpu, 0.99)

    const gpuAvailable = gpuVals.length >= Math.max(3, Math.floor(this.samples.length * 0.3))

    const gpuMedian = gpuAvailable ? pct(gpuVals, 0.5) : null

    const gpuP95 = gpuAvailable ? pct(gpuVals, 0.95) : null

    const gpuP99 = gpuAvailable ? pct(gpuVals, 0.99) : null

    const minFps = fps.length ? fps[0]! : 0

    const medianFps = pct(fps, 0.5)

    const notes: string[] = []

    if (!gpuAvailable) notes.push('GPU timer samples missing or sparse — pass72 uses CPU + FPS only')

    if (this.samples.length < 10) notes.push('short run (<10 samples) — not a thermal/acceptance result')



    const cpuOk = cpuP95 <= 13.89

    const fpsOk = minFps >= 72

    const gpuOk = !gpuAvailable || (gpuP95 != null && gpuP95 <= 13.89)

    const pass72 = fpsOk && cpuOk && gpuOk



    const runId = `${this.label}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`



    return {

      meta: {

        runId,

        label: this.label,

        href: typeof location !== 'undefined' ? location.href : '',

        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',

        qualityProfile: this.qualityProfile || undefined,

        xrActive: this.xrActive,

      },

      startedAt: this.startedAt,

      endedAt,

      durationSec: (endedAt - this.startedAt) / 1000,

      sampleCount: this.samples.length,

      samples: [...this.samples],

      cpuMedian,

      cpuP95,

      cpuP99,

      gpuMedian,

      gpuP95,

      gpuP99,

      gpuAvailable,

      minFps,

      medianFps,

      drawCallsP95: pct(draws, 0.95),

      trianglesP95: pct(tris, 0.95),

      pass72,

      notes,

    }

  }

}

