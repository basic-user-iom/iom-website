import { Camera, Scene, Vector2, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import type { VisualQuality } from './bodies/VisualQuality';
import {
  BlackHoleLensingPass,
  EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
  type BlackHoleLensingDiagnostics,
  type BlackHoleLensingFrame,
} from './black-hole';

export type SolarExposurePreset = 'deep-space' | 'balanced' | 'solar-closeup';

export interface SolarBloomProfile {
  readonly enabled: boolean;
  readonly strength: number;
  readonly radius: number;
  readonly threshold: number;
  readonly maximumPixelRatio: number;
}

export interface SolarPostProcessingOptions {
  readonly initialQuality?: VisualQuality;
  /** Leaves the renderer's existing exposure unchanged when omitted. */
  readonly initialExposure?: number;
  /** Override only for deterministic tests or an externally probed context. */
  readonly hdrRenderTargetSupported?: boolean;
}

export interface SolarPostProcessingState extends SolarBloomProfile {
  readonly quality: VisualQuality;
  readonly exposure: number;
  readonly width: number;
  readonly height: number;
  readonly requestedPixelRatio: number;
  readonly resolutionScale: number;
  readonly effectivePixelRatio: number;
  readonly hdrRenderTargetSupported: boolean;
  readonly blackHoleLensing: Readonly<BlackHoleLensingDiagnostics>;
}

const BLOOM_PROFILES: Readonly<Record<VisualQuality, Readonly<SolarBloomProfile>>> =
  Object.freeze({
    low: Object.freeze({
      enabled: false,
      strength: 0,
      radius: 0,
      threshold: 1.6,
      maximumPixelRatio: 1,
    }),
    medium: Object.freeze({
      enabled: true,
      strength: 0.2,
      radius: 0.12,
      threshold: 1.35,
      maximumPixelRatio: 1,
    }),
    high: Object.freeze({
      enabled: true,
      strength: 0.3,
      radius: 0.22,
      threshold: 1.2,
      maximumPixelRatio: 1.5,
    }),
    ultra: Object.freeze({
      enabled: true,
      strength: 0.4,
      radius: 0.32,
      threshold: 1.1,
      maximumPixelRatio: 2,
    }),
  });

const EXPOSURE_PRESETS: Readonly<Record<SolarExposurePreset, number>> = Object.freeze({
  'deep-space': 1.12,
  balanced: 1,
  'solar-closeup': 0.62,
});

/**
 * Returns the immutable bloom parameters for a visual-quality tier.
 * Thresholds remain above display white so ordinary lit surfaces do not glow.
 */
export function solarBloomProfile(quality: VisualQuality): Readonly<SolarBloomProfile> {
  return BLOOM_PROFILES[quality];
}

export function solarExposureForPreset(preset: SolarExposurePreset): number {
  return EXPOSURE_PRESETS[preset];
}

/**
 * HDR render/composite adapter for the observatory renderer.
 *
 * Keep the scene's renderer tone mapping enabled. The final OutputPass applies
 * that tone mapping and output color-space conversion after bloom composition.
 */
export class SolarPostProcessing {
  private readonly renderer: WebGLRenderer;
  private readonly composer: EffectComposer | null;
  private readonly renderPass: RenderPass | null;
  private readonly bloomPass: UnrealBloomPass | null;
  private readonly blackHoleLensingPass: BlackHoleLensingPass | null;
  private readonly outputPass: OutputPass | null;
  private readonly hdrRenderTargetSupported: boolean;
  private quality: VisualQuality;
  private width: number;
  private height: number;
  private requestedPixelRatio: number;
  private resolutionScale = 1;
  private effectivePixelRatio: number;
  private disposed = false;

  public constructor(renderer: WebGLRenderer, options: SolarPostProcessingOptions = {}) {
    this.renderer = renderer;
    this.quality = options.initialQuality ?? 'high';
    this.hdrRenderTargetSupported =
      options.hdrRenderTargetSupported ?? supportsHdrRenderTargets(renderer);

    const rendererSize = renderer.getSize(new Vector2());
    this.width = requirePositiveDimension(rendererSize.x, 'width');
    this.height = requirePositiveDimension(rendererSize.y, 'height');
    this.requestedPixelRatio = requirePositiveNumber(
      renderer.getPixelRatio(),
      'pixel ratio',
    );
    this.effectivePixelRatio = this.effectiveRatioForQuality();

    if (this.hdrRenderTargetSupported) {
      const initialScene = new Scene();
      const initialCamera = new Camera();
      const profile = solarBloomProfile(this.quality);
      this.composer = new EffectComposer(renderer);
      this.renderPass = new RenderPass(initialScene, initialCamera);
      this.bloomPass = new UnrealBloomPass(
        new Vector2(this.width, this.height),
        profile.strength,
        profile.radius,
        profile.threshold,
      );
      this.blackHoleLensingPass = new BlackHoleLensingPass({
        initialQuality: this.quality,
        highQualitySupported: true,
      });
      this.outputPass = new OutputPass();
      this.composer.addPass(this.renderPass);
      // Lensing distorts the complete rendered scene/background before bloom
      // and display conversion. It stays isolated from orbital physics.
      this.composer.addPass(this.blackHoleLensingPass.pass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.outputPass);
      this.applyQualityProfile();
      this.composer.setPixelRatio(this.effectivePixelRatio);
      this.composer.setSize(this.width, this.height);
    } else {
      // RGBA16F color attachments are optional in WebGL2. Bypass the composer
      // entirely when unavailable so Low remains a usable direct-render path
      // instead of risking an incomplete framebuffer and a blank canvas.
      this.composer = null;
      this.renderPass = null;
      this.bloomPass = null;
      this.blackHoleLensingPass = null;
      this.outputPass = null;
    }

    if (options.initialExposure !== undefined) {
      this.setExposure(options.initialExposure);
    }
  }

  public render(scene: Scene, camera: Camera, deltaTimeSeconds?: number): void {
    this.assertNotDisposed();
    if (
      deltaTimeSeconds !== undefined &&
      (!Number.isFinite(deltaTimeSeconds) || deltaTimeSeconds < 0)
    ) {
      throw new RangeError('Post-processing delta time must be finite and non-negative.');
    }
    if (this.composer === null || this.renderPass === null) {
      this.renderer.render(scene, camera);
      return;
    }
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render(deltaTimeSeconds);
  }

  /** Resizes composer buffers in logical CSS pixels and applies the tier's DPR cap. */
  public resize(
    width: number,
    height: number,
    pixelRatio: number = this.renderer.getPixelRatio(),
  ): void {
    this.assertNotDisposed();
    this.width = requirePositiveDimension(width, 'width');
    this.height = requirePositiveDimension(height, 'height');
    this.requestedPixelRatio = requirePositiveNumber(pixelRatio, 'pixel ratio');
    this.applyEffectivePixelRatio();
    this.composer?.setSize(this.width, this.height);
  }

  public setQuality(quality: VisualQuality): void {
    this.assertNotDisposed();
    if (quality === this.quality) return;
    this.quality = quality;
    this.blackHoleLensingPass?.setQuality(quality);
    this.applyQualityProfile();
    this.applyEffectivePixelRatio();
  }

  /** Applies a tier-bounded dynamic scale below the quality preset's DPR cap. */
  public setResolutionScale(scale: number): void {
    this.assertNotDisposed();
    const nextScale = requireResolutionScale(scale);
    if (nextScale === this.resolutionScale) return;
    this.resolutionScale = nextScale;
    this.applyEffectivePixelRatio();
  }

  public setExposure(exposure: number): void {
    this.assertNotDisposed();
    this.renderer.toneMappingExposure = requirePositiveNumber(exposure, 'exposure');
  }

  public setExposurePreset(preset: SolarExposurePreset): void {
    this.setExposure(solarExposureForPreset(preset));
  }

  public setBlackHoleLensing(
    frame: Readonly<BlackHoleLensingFrame> | null,
  ): void {
    this.assertNotDisposed();
    if (frame === null) {
      this.blackHoleLensingPass?.reset();
      return;
    }
    this.blackHoleLensingPass?.update(frame);
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.assertNotDisposed();
    this.blackHoleLensingPass?.setReducedMotion(reducedMotion);
  }

  public getState(): Readonly<SolarPostProcessingState> {
    const profile = solarBloomProfile(this.quality);
    return Object.freeze({
      ...profile,
      quality: this.quality,
      exposure: this.renderer.toneMappingExposure,
      width: this.width,
      height: this.height,
      requestedPixelRatio: this.requestedPixelRatio,
      resolutionScale: this.resolutionScale,
      effectivePixelRatio: this.effectivePixelRatio,
      hdrRenderTargetSupported: this.hdrRenderTargetSupported,
      enabled: profile.enabled && this.hdrRenderTargetSupported,
      blackHoleLensing: this.getBlackHoleLensingDiagnostics(),
    });
  }

  public getBlackHoleLensingDiagnostics(): Readonly<BlackHoleLensingDiagnostics> {
    return (
      this.blackHoleLensingPass?.getDiagnostics() ??
      Object.freeze({
        ...EMPTY_BLACK_HOLE_LENSING_DIAGNOSTICS,
        quality: this.quality,
        highQualitySupported: false,
      })
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.blackHoleLensingPass?.dispose();
    this.bloomPass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
  }

  private applyQualityProfile(): void {
    const profile = solarBloomProfile(this.quality);
    if (this.bloomPass === null) return;
    this.bloomPass.enabled = profile.enabled;
    this.bloomPass.strength = profile.strength;
    this.bloomPass.radius = profile.radius;
    this.bloomPass.threshold = profile.threshold;
  }

  private applyEffectivePixelRatio(): void {
    const nextPixelRatio = this.effectiveRatioForQuality();
    if (nextPixelRatio === this.effectivePixelRatio) return;
    this.effectivePixelRatio = nextPixelRatio;
    if (this.composer !== null) {
      this.composer.setPixelRatio(nextPixelRatio);
      return;
    }
    // Without HDR render targets the renderer draws directly to the canvas,
    // so the quality cap and adaptive scale must resize that backbuffer too.
    this.renderer.setPixelRatio(nextPixelRatio);
    this.renderer.setSize(this.width, this.height, false);
  }

  private effectiveRatioForQuality(): number {
    return (
      Math.min(
        this.requestedPixelRatio,
        solarBloomProfile(this.quality).maximumPixelRatio,
      ) * this.resolutionScale
    );
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Solar post-processing pipeline is disposed.');
  }
}

function supportsHdrRenderTargets(renderer: WebGLRenderer): boolean {
  return (
    renderer.capabilities.isWebGL2 &&
    renderer.extensions.has('EXT_color_buffer_float')
  );
}

function requirePositiveDimension(value: number, label: string): number {
  return Math.max(1, Math.floor(requirePositiveNumber(value, label)));
}

function requirePositiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Post-processing ${label} must be finite and positive.`);
  }
  return value;
}

function requireResolutionScale(value: number): number {
  if (!Number.isFinite(value) || value < 0.5 || value > 1) {
    throw new RangeError(
      'Post-processing resolution scale must be finite and between 0.5 and 1.',
    );
  }
  return value;
}
