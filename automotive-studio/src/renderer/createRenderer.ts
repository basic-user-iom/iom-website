import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { probeRenderBackend, type BackendProbe, type RenderBackend } from './backend'
import {
  applyEnvironment,
  attachEnvironmentDecor,
  type EnvironmentHandles,
} from '../environment/applyEnvironment'
import type { EnvironmentState } from '../persistence/schema'
import { createEmptyProject } from '../persistence/schema'

export interface StudioRenderer {
  backend: RenderBackend
  probe: BackendProbe
  canvas: HTMLCanvasElement
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  environment: EnvironmentHandles
  applyEnvironmentState: (env: EnvironmentState) => void
  setOrbitEnabled: (enabled: boolean) => void
  isOrbitEnabled: () => boolean
  frameTo: (center: Vector3, radius: number) => void
  setSize: (width: number, height: number) => void
  render: () => void
  dispose: () => void
}

/**
 * Prefer WebGPU when available; fall back to WebGL2.
 * ?forceWebGL2=1 forces the WebGL path.
 */
export async function createStudioRenderer(
  host: HTMLElement,
): Promise<StudioRenderer> {
  const probe = await probeRenderBackend()
  const canvas = document.createElement('canvas')
  canvas.className = 'as-canvas'
  canvas.setAttribute('aria-label', 'Automotive studio viewport')
  canvas.tabIndex = 0
  host.appendChild(canvas)

  const scene = new Scene()
  scene.background = new Color(0x0c0e12)

  const camera = new PerspectiveCamera(40, 1, 0.1, 200)
  camera.position.set(4.2, 1.8, 5.4)
  camera.lookAt(0, 0.6, 0)

  const floor = new Mesh(
    new PlaneGeometry(24, 24),
    new MeshStandardMaterial({
      color: 0x161a22,
      metalness: 0.35,
      roughness: 0.55,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const pedestal = new Mesh(
    new PlaneGeometry(3.2, 6.4),
    new MeshStandardMaterial({
      color: 0x1c222c,
      metalness: 0.45,
      roughness: 0.4,
    }),
  )
  pedestal.rotation.x = -Math.PI / 2
  pedestal.position.y = 0.002
  scene.add(pedestal)

  const hemi = new HemisphereLight(0xb8c0cc, 0x2a303a, 0.45)
  scene.add(hemi)

  const ambient = new AmbientLight(0xb8c0cc, 0.12)
  scene.add(ambient)

  const sun = new DirectionalLight(0xfff2e0, 1.15)
  sun.position.set(4, 8, 3)
  sun.castShadow = true
  scene.add(sun)
  scene.add(sun.target)

  const fill = new DirectionalLight(0xa8c0ff, 0.32)
  fill.position.set(-5, 3, -2)
  scene.add(fill)

  const { stars, moon } = attachEnvironmentDecor(scene)

  const environment: EnvironmentHandles = {
    scene,
    sun,
    fill,
    hemi,
    floor,
    pedestal,
    stars,
    moon,
  }

  let renderer: WebGLRenderer
  let backend: RenderBackend = probe.preferred

  if (probe.preferred === 'webgpu') {
    try {
      const { WebGPURenderer } = await import('three/webgpu')
      const gpuRenderer = new WebGPURenderer({
        canvas,
        antialias: true,
        forceWebGL: false,
      })
      await gpuRenderer.init()
      renderer = gpuRenderer as unknown as WebGLRenderer
      backend = 'webgpu'
    } catch (err) {
      console.warn('[automotive-studio] WebGPU init failed; falling back to WebGL2', err)
      const { WebGLRenderer } = await import('three')
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
      backend = 'webgl2'
      probe.note = `${probe.note} WebGPU init failed; using WebGL2.`
    }
  } else if (probe.preferred === 'webgl2') {
    const { WebGLRenderer } = await import('three')
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
    backend = 'webgl2'
  } else {
    const { WebGLRenderer } = await import('three')
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false })
    backend = 'unavailable'
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.target.set(0, 0.6, 0)
  controls.minDistance = 1.2
  controls.maxDistance = 40
  controls.maxPolarAngle = Math.PI * 0.49
  controls.enablePan = true
  // Off until author toggles "Free camera" — avoids fighting inspector scrubbing.
  controls.enabled = false

  const applyEnvironmentState = (env: EnvironmentState) => {
    applyEnvironment(environment, env)
  }

  applyEnvironmentState(createEmptyProject().environment)

  const setSize = (width: number, height: number) => {
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }

  const render = () => {
    if (controls.enabled) controls.update()
    renderer.render(scene, camera)
  }

  const dispose = () => {
    controls.dispose()
    floor.geometry.dispose()
    ;(floor.material as MeshStandardMaterial).dispose()
    pedestal.geometry.dispose()
    ;(pedestal.material as MeshStandardMaterial).dispose()
    stars.geometry.dispose()
    ;(stars.material as { dispose: () => void }).dispose()
    moon.geometry.dispose()
    ;(moon.material as { dispose: () => void }).dispose()
    renderer.dispose()
    canvas.remove()
  }

  return {
    backend,
    probe: { ...probe, preferred: backend },
    canvas,
    scene,
    camera,
    renderer,
    controls,
    environment,
    applyEnvironmentState,
    setOrbitEnabled(enabled) {
      controls.enabled = enabled
      canvas.style.cursor = enabled ? 'grab' : ''
      host.dataset.orbit = enabled ? 'on' : 'off'
    },
    isOrbitEnabled: () => controls.enabled,
    frameTo(center, radius) {
      const r = Math.max(1.5, radius)
      camera.position.set(center.x + r * 1.4, center.y + r * 0.55, center.z + r * 1.6)
      controls.target.copy(center).setY(center.y + r * 0.08)
      controls.update()
    },
    setSize,
    render,
    dispose,
  }
}
