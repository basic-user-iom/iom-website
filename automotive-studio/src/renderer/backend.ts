export type RenderBackend = 'webgpu' | 'webgl2' | 'unavailable'

export interface BackendProbe {
  preferred: RenderBackend
  webgpu: boolean
  webgl2: boolean
  forcedWebGL2: boolean
  note: string
}

export function readForceWebGL2Flag(): boolean {
  const params = new URLSearchParams(location.search)
  return params.get('forceWebGL2') === '1' || params.get('webgl2') === '1'
}

export async function probeRenderBackend(): Promise<BackendProbe> {
  const forcedWebGL2 = readForceWebGL2Flag()
  const webgpu =
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    !forcedWebGL2

  let webgpuAdapter = false
  if (webgpu) {
    try {
      const adapter = await (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu?.requestAdapter()
      webgpuAdapter = Boolean(adapter)
    } catch {
      webgpuAdapter = false
    }
  }

  const canvas = document.createElement('canvas')
  const webgl2 = Boolean(canvas.getContext('webgl2'))

  if (forcedWebGL2 && webgl2) {
    return {
      preferred: 'webgl2',
      webgpu: webgpuAdapter,
      webgl2,
      forcedWebGL2: true,
      note: 'Forced WebGL2 via ?forceWebGL2=1 — intentional reduced/fallback path for corporate devices.',
    }
  }

  if (webgpuAdapter) {
    return {
      preferred: 'webgpu',
      webgpu: true,
      webgl2,
      forcedWebGL2: false,
      note: 'WebGPU adapter available. Visual parity with WebGL2 is not implied until Phase 5+ measured.',
    }
  }

  if (webgl2) {
    return {
      preferred: 'webgl2',
      webgpu: false,
      webgl2: true,
      forcedWebGL2: false,
      note: 'WebGL2 fallback selected. Volumetrics/TSL features may run at a reduced quality tier.',
    }
  }

  return {
    preferred: 'unavailable',
    webgpu: false,
    webgl2: false,
    forcedWebGL2,
    note: 'No WebGPU or WebGL2 — Presentation must show poster/video fallback (not implemented in Phase 1 shell).',
  }
}
