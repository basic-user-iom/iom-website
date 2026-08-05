export type RenderBackend = 'webgpu' | 'webgl2' | 'unavailable'

export interface BackendProbe {
  preferred: RenderBackend
  webgpu: boolean
  webgl2: boolean
  forcedWebGL2: boolean
  /** Explicit QA opt-in for WebGPU (`?webgpu=1`). */
  allowWebGPU: boolean
  note: string
}

export function readForceWebGL2Flag(): boolean {
  const params = new URLSearchParams(location.search)
  return params.get('forceWebGL2') === '1' || params.get('webgl2') === '1'
}

export function readAllowWebGPUFlag(): boolean {
  const params = new URLSearchParams(location.search)
  return params.get('webgpu') === '1'
}

/**
 * Production default is validated WebGL2 (audit Phase B).
 * WebGPU remains behind `?webgpu=1` until IBL/shadow parity goldens pass.
 * `?forceWebGL2=1` still forces WebGL2 even if webgpu=1 is also present.
 */
export async function probeRenderBackend(): Promise<BackendProbe> {
  const forcedWebGL2 = readForceWebGL2Flag()
  const allowWebGPU = readAllowWebGPUFlag() && !forcedWebGL2

  let webgpuAdapter = false
  if (allowWebGPU && typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await (
        navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }
      ).gpu?.requestAdapter()
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
      allowWebGPU: false,
      note: 'Forced WebGL2 via ?forceWebGL2=1.',
    }
  }

  if (allowWebGPU && webgpuAdapter) {
    return {
      preferred: 'webgpu',
      webgpu: true,
      webgl2,
      forcedWebGL2: false,
      allowWebGPU: true,
      note: 'WebGPU QA path (?webgpu=1). Prefer WebGL2 for client presentations until parity is certified.',
    }
  }

  if (webgl2) {
    return {
      preferred: 'webgl2',
      webgpu: false,
      webgl2: true,
      forcedWebGL2: false,
      allowWebGPU,
      note: allowWebGPU
        ? 'WebGPU requested but unavailable; using validated WebGL2.'
        : 'WebGL2 (production default). Append ?webgpu=1 to try WebGPU QA path.',
    }
  }

  if (webgpuAdapter) {
    return {
      preferred: 'webgpu',
      webgpu: true,
      webgl2: false,
      forcedWebGL2: false,
      allowWebGPU: true,
      note: 'WebGL2 unavailable — falling back to WebGPU.',
    }
  }

  return {
    preferred: 'unavailable',
    webgpu: false,
    webgl2: false,
    forcedWebGL2,
    allowWebGPU,
    note: 'No WebGPU or WebGL2 — Presentation must show poster/video fallback.',
  }
}
