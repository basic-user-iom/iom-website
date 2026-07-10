import type { MusicPlayerVisualizerLike } from './musicPlayerVisualizerTypes'
import { MusicPlayerVisualizer } from './musicPlayerVisualizer'
import {
  isWebGPUSupported,
  MusicPlayerRagingSeaVisualizer,
} from './musicPlayerRagingSeaVisualizer'

export type MusicPlayerVisualizerKind = 'raging-sea' | 'raymarch'

function readCanvasLumaStats(canvas: HTMLCanvasElement) {
  if (canvas.width < 1 || canvas.height < 1) return { max: 0, avg: 0 }
  const sample = document.createElement('canvas')
  const w = Math.min(48, canvas.width)
  const h = Math.min(48, canvas.height)
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

async function probeRagingSeaMount(): Promise<boolean> {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:240px;opacity:0;pointer-events:none'
  document.body.appendChild(probe)

  const visualizer = new MusicPlayerRagingSeaVisualizer()
  try {
    await visualizer.mount(probe)
    visualizer.resize(320, 240)
    for (let i = 0; i < 4; i += 1) {
      visualizer.update(0.016, 0.5 + i * 0.02, false, null)
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    const canvas = probe.querySelector('canvas')
    if (!(canvas instanceof HTMLCanvasElement)) return false
    const { max, avg } = readCanvasLumaStats(canvas)
    // Require visible water, not just the dark clear color (~50 max luma).
    return max > 72 && avg > 18
  } catch {
    return false
  } finally {
    visualizer.dispose()
    probe.remove()
  }
}

export async function createMusicPlayerVisualizer(): Promise<{
  visualizer: MusicPlayerVisualizerLike
  kind: MusicPlayerVisualizerKind
}> {
  // Raymarch WebGL is the reliable default for the music player.
  // WebGPU raging sea is opt-in via ?visualizer=raging-sea for experiments.
  const params = new URLSearchParams(window.location.search)
  const forceRagingSea = params.get('visualizer') === 'raging-sea'

  if (forceRagingSea && (await isWebGPUSupported())) {
    try {
      if (await probeRagingSeaMount()) {
        return { visualizer: new MusicPlayerRagingSeaVisualizer(), kind: 'raging-sea' }
      }
    } catch {
      // fall through to WebGL raymarch
    }
  }

  return { visualizer: new MusicPlayerVisualizer(), kind: 'raymarch' }
}
