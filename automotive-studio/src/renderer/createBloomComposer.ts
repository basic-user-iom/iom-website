import {
  type Camera,
  type Light,
  type Material,
  type Object3D,
  type Scene,
  type WebGLRenderer,
  Color,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Vector2,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import type { RenderBackend } from './backend'

export type BloomControls = {
  enabled: boolean
  strength: number
  threshold: number
  radius: number
}

const darkMaterial = new MeshBasicMaterial({ color: 0x000000 })
const materialCache = new Map<Mesh, Material | Material[]>()
const lightCache = new Map<Light, number>()
const visibilityCache = new Map<Object3D, boolean>()
const _black = new Color(0x000000)

/** Below this, selective bloom cost outweighs visible glow — plain render. */
const BLOOM_STRENGTH_SKIP = 0.04

/**
 * Selective bloom (WebGL2): only meshes with `userData.selectiveBloom === true`
 * (vehicle lamps) feed the bloom extract. Sun / moon / paint / soft-glow cards stay out.
 * WebGPU: plain render, no bloom.
 */
export function createBloomComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  backend: RenderBackend,
): {
  render: () => void
  setSize: (w: number, h: number) => void
  apply: (cfg: BloomControls) => void
  dispose: () => void
  supported: boolean
} {
  if (backend !== 'webgl2') {
    return {
      supported: false,
      render: () => renderer.render(scene, camera),
      setSize: () => undefined,
      apply: () => undefined,
      dispose: () => undefined,
    }
  }

  const size = new Vector2()
  renderer.getSize(size)
  // Quarter-ish extract: selective darken pass dominates cost; softer blur is fine.
  const BLOOM_SCALE = 0.33
  const bloomW = Math.max(1, Math.floor(size.x * BLOOM_SCALE))
  const bloomH = Math.max(1, Math.floor(size.y * BLOOM_SCALE))
  const prevTone = (renderer as WebGLRenderer & { toneMapping?: number }).toneMapping
  ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = NoToneMapping

  const renderScene = new RenderPass(scene, camera)

  // Tight radius — large radius smears lamp emissives into tall “portal” streaks on the cyclorama.
  const bloomPass = new UnrealBloomPass(new Vector2(bloomW, bloomH), 0.18, 0.12, 1.1)
  bloomPass.threshold = 1.1
  bloomPass.strength = 0.18
  bloomPass.radius = 0.12

  const bloomTarget = new WebGLRenderTarget(bloomW, bloomH, { type: HalfFloatType })
  const bloomComposer = new EffectComposer(renderer, bloomTarget)
  bloomComposer.renderToScreen = false
  bloomComposer.addPass(renderScene)
  bloomComposer.addPass(bloomPass)

  const mixPass = new ShaderPass(
    {
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D( baseTexture, vUv );
          vec4 bloom = texture2D( bloomTexture, vUv );
          // Soft-knee: kill residual haze below a floor so cyclorama ghosts disappear.
          float luma = dot(bloom.rgb, vec3(0.2126, 0.7152, 0.0722));
          float gate = smoothstep(0.02, 0.08, luma);
          gl_FragColor = vec4(base.rgb + bloom.rgb * gate, max(base.a, bloom.a));
        }
      `,
    },
    'baseTexture',
  )
  mixPass.needsSwap = true

  const finalTarget = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType })
  const finalComposer = new EffectComposer(renderer, finalTarget)
  finalComposer.addPass(renderScene)
  finalComposer.addPass(mixPass)
  finalComposer.addPass(new OutputPass())

  let enabled = false
  let strength = 0
  let frame = 0
  let bloomBufferValid = false

  const prepareBloomExtract = (obj: Object3D) => {
    // Soft volumetric cards must never feed the bloom buffer — they read as
    // upright “portals” on the backdrop. Do NOT hide AccentLights / vehicle
    // proxy groups: that changes NUM_*_LIGHTS vs the final pass and thrashes
    // shader variants every frame. Lights are zeroed below instead.
    if (obj.name === 'AccentVolumetrics' || obj.name === 'CycloramaVolumetrics') {
      visibilityCache.set(obj, obj.visible)
      obj.visible = false
      return
    }

    const light = obj as Light
    if ((light as { isLight?: boolean }).isLight) {
      lightCache.set(light, light.intensity)
      light.intensity = 0
      return
    }

    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    if (mesh.userData.selectiveBloom === true) return
    materialCache.set(mesh, mesh.material)
    mesh.material = darkMaterial
  }

  const restoreBloomExtract = (obj: Object3D) => {
    if (visibilityCache.has(obj)) {
      obj.visible = visibilityCache.get(obj)!
      visibilityCache.delete(obj)
    }
    const light = obj as Light
    if ((light as { isLight?: boolean }).isLight && lightCache.has(light)) {
      light.intensity = lightCache.get(light)!
      lightCache.delete(light)
      return
    }
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mat = materialCache.get(mesh)
    if (mat) {
      mesh.material = mat
      materialCache.delete(mesh)
    }
  }

  const clearCaches = () => {
    materialCache.clear()
    lightCache.clear()
    visibilityCache.clear()
  }

  const runBloomExtract = () => {
    mixPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture

    const prevBg = scene.background
    clearCaches()
    scene.traverse(prepareBloomExtract)
    scene.background = _black
    bloomComposer.render()
    scene.background = prevBg
    scene.traverse(restoreBloomExtract)
    clearCaches()
    bloomBufferValid = true
  }

  const plainRender = () => {
    if (prevTone != null) {
      ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = prevTone
    }
    renderer.render(scene, camera)
  }

  return {
    supported: true,
    render() {
      frame++
      // Skip entire selective-bloom pipeline when off or visually negligible.
      if (!enabled || strength < BLOOM_STRENGTH_SKIP) {
        plainRender()
        return
      }

      ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = NoToneMapping

      // Modest strength: refresh extract every other frame (reuse prior bloom RT).
      // High strength (lamp showcases): keep full-rate extract.
      const throttleExtract = strength < 0.45
      const needExtract = !bloomBufferValid || !throttleExtract || frame % 2 === 0
      if (needExtract) {
        runBloomExtract()
      } else {
        mixPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture
      }

      finalComposer.render()
    },
    setSize(w, h) {
      const bw = Math.max(1, Math.floor(w * BLOOM_SCALE))
      const bh = Math.max(1, Math.floor(h * BLOOM_SCALE))
      bloomComposer.setSize(bw, bh)
      bloomPass.resolution.set(bw, bh)
      finalComposer.setSize(w, h)
      bloomBufferValid = false
    },
    apply(cfg) {
      enabled = Boolean(cfg.enabled)
      // Keep strength modest — high values smear into cyclorama ghosts.
      strength = Math.max(0, Math.min(1.2, cfg.strength))
      bloomPass.strength = strength
      bloomPass.threshold = Math.max(0.6, Math.min(1.5, cfg.threshold))
      // Slightly tighter default radius = fewer visible smear mips.
      bloomPass.radius = Math.max(0, Math.min(0.45, cfg.radius ?? 0.12))
      if (!enabled || strength < BLOOM_STRENGTH_SKIP) bloomBufferValid = false
    },
    dispose() {
      if (prevTone != null) {
        ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = prevTone
      }
      darkMaterial.dispose()
      bloomTarget.dispose()
      finalTarget.dispose()
      bloomComposer.dispose()
      finalComposer.dispose()
    },
  }
}
