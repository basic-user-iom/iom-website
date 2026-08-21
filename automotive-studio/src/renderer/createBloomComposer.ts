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
  // Bloom extract at half res — selective darken pass is the heavy cost; blur is fine softer.
  const BLOOM_SCALE = 0.5
  const bloomW = Math.max(1, Math.floor(size.x * BLOOM_SCALE))
  const bloomH = Math.max(1, Math.floor(size.y * BLOOM_SCALE))
  const prevTone = (renderer as WebGLRenderer & { toneMapping?: number }).toneMapping
  ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = NoToneMapping

  const renderScene = new RenderPass(scene, camera)

  // Tight radius — large radius smears lamp emissives into tall “portal” streaks on the cyclorama.
  const bloomPass = new UnrealBloomPass(new Vector2(bloomW, bloomH), 0.22, 0.18, 1.05)
  bloomPass.threshold = 1.05
  bloomPass.strength = 0.22
  bloomPass.radius = 0.18

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

  return {
    supported: true,
    render() {
      if (!enabled) {
        if (prevTone != null) {
          ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = prevTone
        }
        renderer.render(scene, camera)
        return
      }

      ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = NoToneMapping

      mixPass.material.uniforms.bloomTexture.value = bloomComposer.renderTarget2.texture

      const prevBg = scene.background
      materialCache.clear()
      lightCache.clear()
      visibilityCache.clear()
      scene.traverse(prepareBloomExtract)
      scene.background = _black
      bloomComposer.render()
      scene.background = prevBg
      scene.traverse(restoreBloomExtract)
      materialCache.clear()
      lightCache.clear()
      visibilityCache.clear()

      finalComposer.render()
    },
    setSize(w, h) {
      const bw = Math.max(1, Math.floor(w * BLOOM_SCALE))
      const bh = Math.max(1, Math.floor(h * BLOOM_SCALE))
      bloomComposer.setSize(bw, bh)
      bloomPass.resolution.set(bw, bh)
      finalComposer.setSize(w, h)
    },
    apply(cfg) {
      enabled = Boolean(cfg.enabled)
      // Keep strength modest — high values smear into cyclorama ghosts.
      bloomPass.strength = Math.max(0, Math.min(1.2, cfg.strength))
      bloomPass.threshold = Math.max(0.6, Math.min(1.5, cfg.threshold))
      bloomPass.radius = Math.max(0, Math.min(0.55, cfg.radius ?? 0.18))
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
