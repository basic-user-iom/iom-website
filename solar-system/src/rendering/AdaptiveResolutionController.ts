import type { VisualQuality } from './bodies/VisualQuality';

export type HeavyRenderEffect =
  | 'none'
  | 'impact'
  | 'solar-evolution'
  | 'supernova'
  | 'black-hole';

export type AdaptiveResolutionState =
  | 'inactive'
  | 'monitoring'
  | 'degraded'
  | 'recovering';

export interface AdaptiveResolutionProfile {
  readonly targetFps: number;
  readonly minimumScale: number;
  readonly downscaleThreshold: number;
  readonly upscaleThreshold: number;
}

export interface AdaptiveResolutionDiagnostics {
  readonly quality: VisualQuality;
  readonly heavyEffect: HeavyRenderEffect;
  readonly state: AdaptiveResolutionState;
  readonly targetFps: number;
  readonly minimumScale: number;
  readonly resolutionScale: number;
  readonly smoothedFps: number | null;
  readonly sampleCount: number;
  readonly medianFrameMs: number | null;
  readonly p95FrameMs: number | null;
  readonly p99FrameMs: number | null;
  readonly adjustmentCount: number;
}

const PROFILES: Readonly<Record<VisualQuality, Readonly<AdaptiveResolutionProfile>>> =
  Object.freeze({
    low: Object.freeze({
      targetFps: 30,
      minimumScale: 0.75,
      downscaleThreshold: 1.15,
      upscaleThreshold: 0.72,
    }),
    medium: Object.freeze({
      targetFps: 40,
      minimumScale: 0.7,
      downscaleThreshold: 1.14,
      upscaleThreshold: 0.72,
    }),
    high: Object.freeze({
      targetFps: 50,
      minimumScale: 0.6,
      downscaleThreshold: 1.12,
      upscaleThreshold: 0.7,
    }),
    ultra: Object.freeze({
      targetFps: 55,
      minimumScale: 0.5,
      downscaleThreshold: 1.1,
      upscaleThreshold: 0.68,
    }),
  });

const FRAME_SAMPLE_CAPACITY = 240;
const DOWNSCALE_AFTER_SECONDS = 0.75;
const UPSCALE_AFTER_SECONDS = 2.25;
const DOWNSCALE_STEP = 0.1;
const UPSCALE_STEP = 0.05;
const DOWNSCALE_COOLDOWN_SECONDS = 0.65;
const UPSCALE_COOLDOWN_SECONDS = 1.1;
const EPSILON = 1e-9;

export function adaptiveResolutionProfile(
  quality: VisualQuality,
): Readonly<AdaptiveResolutionProfile> {
  return PROFILES[quality];
}

/**
 * Tier-bounded dynamic-resolution governor for the expensive catastrophe passes.
 *
 * It consumes real frame intervals, uses an EMA plus sustained-pressure windows,
 * and deliberately recovers more slowly than it degrades. Ordinary observatory
 * rendering always returns to the tier's full resolution.
 */
export class AdaptiveResolutionController {
  private readonly frameSamplesMs = new Float32Array(FRAME_SAMPLE_CAPACITY);
  private quality: VisualQuality;
  private heavyEffect: HeavyRenderEffect = 'none';
  private resolutionScale = 1;
  private smoothedFrameMs: number | null = null;
  private sampleCount = 0;
  private nextSampleIndex = 0;
  private pressureSeconds = 0;
  private headroomSeconds = 0;
  private cooldownSeconds = 0;
  private adjustmentCount = 0;

  public constructor(initialQuality: VisualQuality = 'high') {
    this.quality = initialQuality;
  }

  public get scale(): number {
    return this.resolutionScale;
  }

  public setQuality(quality: VisualQuality): boolean {
    if (quality === this.quality) return false;
    this.quality = quality;
    const changed = this.resolutionScale !== 1;
    this.resolutionScale = 1;
    this.resetPressure();
    this.resetSamples();
    if (changed) this.adjustmentCount += 1;
    return changed;
  }

  /** Returns true only when the caller must resize render targets. */
  public sampleFrame(
    deltaSeconds: number,
    heavyEffect: HeavyRenderEffect,
  ): boolean {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Frame delta must be finite and non-negative.');
    }
    this.heavyEffect = heavyEffect;

    if (deltaSeconds > 0) this.recordFrame(deltaSeconds * 1_000);
    if (heavyEffect === 'none') {
      this.resetPressure();
      if (this.resolutionScale === 1) return false;
      this.resolutionScale = 1;
      this.adjustmentCount += 1;
      return true;
    }
    if (deltaSeconds <= 0 || this.smoothedFrameMs === null) return false;

    const profile = adaptiveResolutionProfile(this.quality);
    const frameBudgetMs = 1_000 / profile.targetFps;
    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - deltaSeconds);

    if (this.smoothedFrameMs > frameBudgetMs * profile.downscaleThreshold) {
      this.pressureSeconds += deltaSeconds;
      this.headroomSeconds = 0;
    } else if (this.smoothedFrameMs < frameBudgetMs * profile.upscaleThreshold) {
      this.headroomSeconds += deltaSeconds;
      this.pressureSeconds = 0;
    } else {
      this.pressureSeconds = 0;
      this.headroomSeconds = 0;
    }

    if (
      this.cooldownSeconds <= 0 &&
      this.pressureSeconds >= DOWNSCALE_AFTER_SECONDS &&
      this.resolutionScale > profile.minimumScale + EPSILON
    ) {
      this.resolutionScale = roundScale(
        Math.max(profile.minimumScale, this.resolutionScale - DOWNSCALE_STEP),
      );
      this.adjustmentCount += 1;
      this.pressureSeconds = 0;
      this.cooldownSeconds = DOWNSCALE_COOLDOWN_SECONDS;
      return true;
    }

    if (
      this.cooldownSeconds <= 0 &&
      this.headroomSeconds >= UPSCALE_AFTER_SECONDS &&
      this.resolutionScale < 1 - EPSILON
    ) {
      this.resolutionScale = roundScale(
        Math.min(1, this.resolutionScale + UPSCALE_STEP),
      );
      this.adjustmentCount += 1;
      this.headroomSeconds = 0;
      this.cooldownSeconds = UPSCALE_COOLDOWN_SECONDS;
      return true;
    }
    return false;
  }

  public reset(): boolean {
    this.heavyEffect = 'none';
    const changed = this.resolutionScale !== 1;
    this.resolutionScale = 1;
    this.resetPressure();
    this.resetSamples();
    if (changed) this.adjustmentCount += 1;
    return changed;
  }

  public getDiagnostics(): Readonly<AdaptiveResolutionDiagnostics> {
    const profile = adaptiveResolutionProfile(this.quality);
    const samples = this.sortedSamples();
    const degraded = this.resolutionScale < 1 - EPSILON;
    const state: AdaptiveResolutionState =
      this.heavyEffect === 'none'
        ? 'inactive'
        : this.headroomSeconds > 0 && degraded
          ? 'recovering'
          : degraded
            ? 'degraded'
            : 'monitoring';
    return Object.freeze({
      quality: this.quality,
      heavyEffect: this.heavyEffect,
      state,
      targetFps: profile.targetFps,
      minimumScale: profile.minimumScale,
      resolutionScale: this.resolutionScale,
      smoothedFps:
        this.smoothedFrameMs === null ? null : 1_000 / this.smoothedFrameMs,
      sampleCount: this.sampleCount,
      medianFrameMs: percentile(samples, 0.5),
      p95FrameMs: percentile(samples, 0.95),
      p99FrameMs: percentile(samples, 0.99),
      adjustmentCount: this.adjustmentCount,
    });
  }

  private recordFrame(frameMs: number): void {
    this.frameSamplesMs[this.nextSampleIndex] = frameMs;
    this.nextSampleIndex = (this.nextSampleIndex + 1) % FRAME_SAMPLE_CAPACITY;
    this.sampleCount = Math.min(this.sampleCount + 1, FRAME_SAMPLE_CAPACITY);
    const smoothing = 0.12;
    this.smoothedFrameMs = this.smoothedFrameMs === null
      ? frameMs
      : this.smoothedFrameMs * (1 - smoothing) + frameMs * smoothing;
  }

  private sortedSamples(): number[] {
    const samples = new Array<number>(this.sampleCount);
    for (let index = 0; index < this.sampleCount; index += 1) {
      samples[index] = this.frameSamplesMs[index] ?? 0;
    }
    samples.sort((left, right) => left - right);
    return samples;
  }

  private resetPressure(): void {
    this.pressureSeconds = 0;
    this.headroomSeconds = 0;
    this.cooldownSeconds = 0;
  }

  private resetSamples(): void {
    this.frameSamplesMs.fill(0);
    this.sampleCount = 0;
    this.nextSampleIndex = 0;
    this.smoothedFrameMs = null;
  }
}

function percentile(sortedSamples: readonly number[], percentileValue: number): number | null {
  if (sortedSamples.length === 0) return null;
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil(sortedSamples.length * percentileValue) - 1),
  );
  return sortedSamples[index] ?? null;
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}
