import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

export type RuntimeAntialiasMode = 'MSAA' | 'FXAA' | 'OFF'

/**
 * Context MSAA is immutable after WebGLRenderer construction. This wrapper
 * supplies a cheap runtime FXAA path when a desktop profile is selected after
 * booting with antialias=false. WebXR always renders directly to its swapchain.
 */
export class RuntimeAntialias {
  private composer: EffectComposer | null = null
  private fxaaPass: ShaderPass | null = null
  private requested = false
  private width = 1
  private height = 1
  private pixelRatio = 1

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
  ) {}

  configure(enabled: boolean): void {
    this.requested = enabled
    if (this.shouldUseFxaa()) this.ensureComposer()
    else this.disposeComposer()
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.pixelRatio = Math.max(0.25, pixelRatio)
    if (!this.composer) return
    this.composer.setPixelRatio(this.pixelRatio)
    this.composer.setSize(this.width, this.height)
    this.updateResolution()
  }

  render(xrActive: boolean): void {
    if (!xrActive && this.shouldUseFxaa()) {
      // EffectComposer invokes renderer.render for multiple passes. Preserve
      // aggregate scene + post-pass counters instead of exposing only the last
      // fullscreen pass in renderer.info.
      const autoReset = this.renderer.info.autoReset
      this.renderer.info.autoReset = false
      this.renderer.info.reset()
      try {
        this.ensureComposer().render()
      } finally {
        this.renderer.info.autoReset = autoReset
      }
      return
    }
    this.renderer.render(this.scene, this.camera)
  }

  getMode(xrActive = false): RuntimeAntialiasMode {
    if (this.hasNativeMsaa()) return 'MSAA'
    if (!xrActive && this.requested) return 'FXAA'
    return 'OFF'
  }

  /** Recreate post targets after a WebGL context restoration. */
  resetAfterContextRestore(): void {
    this.disposeComposer()
    if (this.shouldUseFxaa()) this.ensureComposer()
  }

  dispose(): void {
    this.disposeComposer()
  }

  private hasNativeMsaa(): boolean {
    return Boolean(this.renderer.getContext().getContextAttributes()?.antialias)
  }

  private shouldUseFxaa(): boolean {
    return this.requested && !this.hasNativeMsaa()
  }

  private ensureComposer(): EffectComposer {
    if (this.composer) return this.composer
    const composer = new EffectComposer(this.renderer)
    composer.addPass(new RenderPass(this.scene, this.camera))
    const fxaa = new ShaderPass(FXAAShader)
    composer.addPass(fxaa)
    composer.addPass(new OutputPass())
    this.composer = composer
    this.fxaaPass = fxaa
    composer.setPixelRatio(this.pixelRatio)
    composer.setSize(this.width, this.height)
    this.updateResolution()
    return composer
  }

  private updateResolution(): void {
    const resolution = this.fxaaPass?.material.uniforms.resolution?.value as
      | { set: (x: number, y: number) => void }
      | undefined
    resolution?.set(
      1 / Math.max(1, this.width * this.pixelRatio),
      1 / Math.max(1, this.height * this.pixelRatio),
    )
  }

  private disposeComposer(): void {
    this.composer?.dispose()
    this.composer = null
    this.fxaaPass = null
  }
}
