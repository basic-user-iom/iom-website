import {
  type Camera,
  type Material,
  type Object3D,
  type Scene,
  type WebGLRenderer,
  Color,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  Vector2,
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
const _black = new Color(0x000000)

/**
 * Selective bloom (WebGL2): only meshes with `userData.selectiveBloom === true`
 * (vehicle lamps) feed the bloom extract. Sun / moon / paint stay sharp.
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
  const prevTone = (renderer as WebGLRenderer & { toneMapping?: number }).toneMapping
  ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = NoToneMapping

  const renderScene = new RenderPass(scene, camera)

  const bloomPass = new UnrealBloomPass(new Vector2(size.x, size.y), 0.28, 0.35, 1.0)
  bloomPass.threshold = 1.0
  bloomPass.strength = 0.28
  bloomPass.radius = 0.35

  const bloomComposer = new EffectComposer(renderer)
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
          gl_FragColor = vec4( base.rgb + bloom.rgb, max( base.a, bloom.a ) );
        }
      `,
    },
    'baseTexture',
  )
  mixPass.needsSwap = true

  const finalComposer = new EffectComposer(renderer)
  finalComposer.addPass(renderScene)
  finalComposer.addPass(mixPass)
  finalComposer.addPass(new OutputPass())

  let enabled = false

  const darkenNonBloomed = (obj: Object3D) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || mesh.userData.selectiveBloom === true) return
    materialCache.set(mesh, mesh.material)
    mesh.material = darkMaterial
  }

  const restoreMaterial = (obj: Object3D) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mat = materialCache.get(mesh)
    if (mat) mesh.material = mat
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
      scene.traverse(darkenNonBloomed)
      scene.background = _black
      bloomComposer.render()
      scene.background = prevBg
      scene.traverse(restoreMaterial)
      materialCache.clear()

      finalComposer.render()
    },
    setSize(w, h) {
      bloomComposer.setSize(w, h)
      finalComposer.setSize(w, h)
      bloomPass.resolution.set(w, h)
    },
    apply(cfg) {
      enabled = Boolean(cfg.enabled)
      bloomPass.strength = Math.max(0, Math.min(2.5, cfg.strength))
      bloomPass.threshold = Math.max(0, Math.min(1.5, cfg.threshold))
      bloomPass.radius = Math.max(0, Math.min(1.5, cfg.radius ?? 0.35))
    },
    dispose() {
      if (prevTone != null) {
        ;(renderer as WebGLRenderer & { toneMapping?: number }).toneMapping = prevTone
      }
      darkMaterial.dispose()
      bloomComposer.dispose()
      finalComposer.dispose()
    },
  }
}
