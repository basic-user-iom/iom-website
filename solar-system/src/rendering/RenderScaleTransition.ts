import type { Vector3 } from 'three';

import { mapCameraRelativePosition } from './CameraRelativeTransform';
import type { DebugBodyRenderState, PhysicalPosition } from './RenderContext';
import type { RenderScaleMode, RenderScaleModel } from './RenderScaleModel';

export interface RenderScaleTransitionOptions {
  readonly durationSeconds?: number;
  readonly initialMode?: RenderScaleMode;
}

/**
 * A reversible transition between two linear render boundaries. `mode` is the
 * selected target, while `presentationMix` describes the current rendered
 * contribution. This distinction makes warning behavior unambiguous.
 */
export class RenderScaleTransition implements RenderScaleModel {
  public readonly id = 'render-scale-transition';
  public readonly durationSeconds: number;

  readonly #trueScale: RenderScaleModel;
  readonly #presentationScale: RenderScaleModel;
  #targetMode: RenderScaleMode;
  #rawPresentationMix: number;

  public constructor(
    trueScale: RenderScaleModel,
    presentationScale: RenderScaleModel,
    options: RenderScaleTransitionOptions = {},
  ) {
    if (trueScale.mode !== 'true') {
      throw new TypeError('RenderScaleTransition requires a true-scale source model.');
    }
    if (presentationScale.mode !== 'presentation') {
      throw new TypeError('RenderScaleTransition requires a presentation-scale target model.');
    }
    if (!nearlyEqual(trueScale.metersPerRenderUnit, presentationScale.metersPerRenderUnit)) {
      throw new RangeError(
        'True and presentation scales must share one orbit-distance conversion.',
      );
    }
    this.durationSeconds = options.durationSeconds ?? 0.7;
    if (!Number.isFinite(this.durationSeconds) || this.durationSeconds <= 0) {
      throw new RangeError('Scale transition durationSeconds must be finite and positive.');
    }

    this.#trueScale = trueScale;
    this.#presentationScale = presentationScale;
    this.#targetMode = options.initialMode ?? 'true';
    this.#rawPresentationMix = this.#targetMode === 'presentation' ? 1 : 0;
  }

  public get mode(): RenderScaleMode {
    return this.#targetMode;
  }

  public get label(): string {
    if (this.isTransitioning) {
      return this.#targetMode === 'presentation'
        ? 'Transitioning to presentation scale — body sizes exaggerated'
        : 'Transitioning to true physical scale';
    }
    return this.#targetMode === 'presentation'
      ? this.#presentationScale.label
      : this.#trueScale.label;
  }

  /** Smoothstep-eased contribution used by positions and radii. */
  public get presentationMix(): number {
    return smoothstep(this.#rawPresentationMix);
  }

  public get isTransitioning(): boolean {
    return this.#targetMode === 'presentation'
      ? this.#rawPresentationMix < 1
      : this.#rawPresentationMix > 0;
  }

  public get presentationWarningRequired(): boolean {
    // Appear immediately on opt-in; remain until exaggerated geometry is gone.
    return this.#targetMode === 'presentation' || this.#rawPresentationMix > 0;
  }

  public get radiiAreExaggerated(): boolean {
    return this.presentationWarningRequired;
  }

  public get metersToRenderUnits(): number {
    return interpolate(
      this.#trueScale.metersToRenderUnits,
      this.#presentationScale.metersToRenderUnits,
      this.presentationMix,
    );
  }

  public get metersPerRenderUnit(): number {
    return 1 / this.metersToRenderUnits;
  }

  public get minimumOverviewRadiusWorld(): number {
    return interpolate(
      this.#trueScale.minimumOverviewRadiusWorld,
      this.#presentationScale.minimumOverviewRadiusWorld,
      this.presentationMix,
    );
  }

  public setMode(mode: RenderScaleMode, immediate = false): void {
    if (mode !== 'true' && mode !== 'presentation') {
      throw new TypeError(`Unknown render scale mode "${String(mode)}".`);
    }
    this.#targetMode = mode;
    if (immediate) {
      this.#rawPresentationMix = mode === 'presentation' ? 1 : 0;
    }
  }

  public advance(realDeltaSeconds: number): boolean {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('Scale transition delta must be finite and non-negative.');
    }
    const previousMix = this.#rawPresentationMix;
    const deltaMix = realDeltaSeconds / this.durationSeconds;
    this.#rawPresentationMix =
      this.#targetMode === 'presentation'
        ? Math.min(1, previousMix + deltaMix)
        : Math.max(0, previousMix - deltaMix);
    return this.#rawPresentationMix !== previousMix;
  }

  public mapPosition(
    output: Vector3,
    physicalPositionM: PhysicalPosition,
    renderOriginM: PhysicalPosition,
  ): Vector3 {
    return mapCameraRelativePosition(
      output,
      physicalPositionM,
      renderOriginM,
      this.metersPerRenderUnit,
    );
  }

  public radiusFor(body: DebugBodyRenderState): number {
    return interpolate(
      this.#trueScale.radiusFor(body),
      this.#presentationScale.radiusFor(body),
      this.presentationMix,
    );
  }
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function nearlyEqual(first: number, second: number): boolean {
  const tolerance = Math.max(Math.abs(first), Math.abs(second), 1) * Number.EPSILON * 8;
  return Math.abs(first - second) <= tolerance;
}
