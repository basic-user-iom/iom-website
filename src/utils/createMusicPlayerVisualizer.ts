import type { MusicPlayerVisualizerLike } from './musicPlayerVisualizerTypes'

import { MusicPlayerVisualizer } from './musicPlayerVisualizer'

import {
  isWebGPUSupported,
  MusicPlayerRagingSeaVisualizer,
} from './musicPlayerRagingSeaVisualizer'

import {
  isFftOceanSupported,
  MusicPlayerFftOceanVisualizer,
} from './musicPlayerFftOceanVisualizer'

export type MusicPlayerVisualizerKind = 'fft-ocean' | 'raging-sea' | 'raymarch'

function readCanvasLumaStats(canvas: HTMLCanvasElement) {
  if (canvas.width < 1 || canvas.height < 1) return { max: 0, avg: 0 }

  const w = Math.min(48, canvas.width)
  const h = Math.min(48, canvas.height)

  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  if (gl) {
    const buf = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    let max = 0
    let sum = 0
    for (let i = 0; i < buf.length; i += 4) {
      const luma = buf[i] + buf[i + 1] + buf[i + 2]
      if (luma > max) max = luma
      sum += luma
    }
    return { max, avg: sum / (w * h) }
  }

  const sample = document.createElement('canvas')
  sample.width = w
  sample.height = h
  const ctx = sample.getContext('2d')
  if (!ctx) return { max: 0, avg: 0 }
  ctx.drawImage(canvas, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  let max = 0
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    const luma = data[i] + data[i + 1] + data[i + 2]
    if (luma > max) max = luma
    sum += luma
  }
  return { max, avg: sum / (w * h) }
}

async function probeVisualizerMount(
  visualizer: MusicPlayerVisualizerLike,
): Promise<{ ok: boolean; max: number; avg: number }> {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:320px;height:240px;opacity:0;pointer-events:none'
  document.body.appendChild(probe)

  try {
    await visualizer.mount(probe)
    visualizer.resize(320, 240)
    for (let i = 0; i < 10; i += 1) {
      visualizer.update(0.016, 0.5 + i * 0.02, false, null)
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    const canvas = probe.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return { ok: false, max: 0, avg: 0 }

    const { max, avg } = readCanvasLumaStats(canvas)
    return { ok: max > 48 && avg > 12, max, avg }
  } catch {
    return { ok: false, max: 0, avg: 0 }
  } finally {
    visualizer.dispose()
    probe.remove()
  }
}

function warnFallback(kind: MusicPlayerVisualizerKind, reason: string) {
  if (import.meta.env.DEV) {
    console.warn(`[music-player] visualizer fallback to ${kind}: ${reason}`)
  }
}

export async function createMusicPlayerVisualizer(): Promise<{
  visualizer: MusicPlayerVisualizerLike
  kind: MusicPlayerVisualizerKind
}> {
  const params = new URLSearchParams(window.location.search)
  const forced = params.get('visualizer')

  if (forced === 'raymarch') {
    return { visualizer: new MusicPlayerVisualizer(), kind: 'raymarch' }
  }

  if (forced === 'fft-ocean' && (await isFftOceanSupported())) {
    return { visualizer: new MusicPlayerFftOceanVisualizer(), kind: 'fft-ocean' }
  }

  if (forced === 'raging-sea' && (await isWebGPUSupported())) {
    try {
      const ragingSea = new MusicPlayerRagingSeaVisualizer()
      const probe = await probeVisualizerMount(ragingSea)
      if (probe.ok) {
        return { visualizer: ragingSea, kind: 'raging-sea' }
      }
      ragingSea.dispose()
      warnFallback('raymarch', `raging-sea probe failed (max=${probe.max}, avg=${probe.avg.toFixed(1)})`)
    } catch (err) {
      warnFallback('raymarch', `raging-sea init failed: ${String(err)}`)
    }
  }

  const fftSupported = await isFftOceanSupported()

  if (forced !== 'raymarch' && fftSupported) {
    if (import.meta.env.DEV) {
      console.info('[music-player] visualizer: fft-ocean (float textures supported)')
    }
    return { visualizer: new MusicPlayerFftOceanVisualizer(), kind: 'fft-ocean' }
  }

  if (forced !== 'raymarch' && !fftSupported) {
    warnFallback('raymarch', 'float textures unsupported')
  }

  return { visualizer: new MusicPlayerVisualizer(), kind: 'raymarch' }
}
