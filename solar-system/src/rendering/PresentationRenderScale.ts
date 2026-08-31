import type { Vector3 } from 'three';

import { mapCameraRelativePosition } from './CameraRelativeTransform';
import type { DebugBodyRenderState, PhysicalPosition } from './RenderContext';
import type { RenderScaleModel } from './RenderScaleModel';
import { assertMetersPerRenderUnit, assertPhysicalRadius } from './TrueRenderScale';
import { ASTRONOMICAL_UNIT_M } from '../simulation/core/Units';

export interface RadiusExaggerationByKind {
  readonly star: number;
  readonly planet: number;
  readonly moon: number;
  readonly comet: number;
}

export interface PresentationRenderScaleOptions {
  readonly metersPerRenderUnit?: number;
  readonly radiusExaggeration?: Partial<RadiusExaggerationByKind>;
  /**
   * Optional body-specific factors applied after the kind defaults. This is
   * useful for bound systems where unrelated kind factors would make two
   * linearly positioned bodies intersect visually.
   */
  readonly radiusExaggerationByBody?: Readonly<Record<string, number>>;
  /** A marker-size hint only; actual sphere radii are never clamped to it. */
  readonly minimumOverviewRadiusWorld?: number;
}

export const DEFAULT_PRESENTATION_RADIUS_EXAGGERATION: RadiusExaggerationByKind =
  Object.freeze({
    star: 25,
    planet: 250,
    moon: 500,
    comet: 5_000,
  });

/**
 * Earth and Moon share one factor so their relative radii remain physical.
 * Forty times keeps their presentation spheres separate throughout the
 * bundled 2000-2100 ephemeris while leaving every orbital position linear.
 */
export const DEFAULT_PRESENTATION_RADIUS_EXAGGERATION_BY_BODY: Readonly<
  Record<string, number>
> = Object.freeze({
  earth: 40,
  moon: 40,
});

/**
 * Keeps all translational geometry linear and exaggerates only body radii by
 * declared, inspectable factors. It does not alter simulation/collision state.
 */
export class PresentationRenderScale implements RenderScaleModel {
  public readonly id = 'presentation-scale';
  public readonly label = 'Presentation scale — body sizes exaggerated';
  public readonly mode = 'presentation' as const;
  public readonly radiiAreExaggerated = true;
  public readonly presentationWarningRequired = true;
  public readonly metersPerRenderUnit: number;
  public readonly minimumOverviewRadiusWorld: number;
  public readonly radiusExaggeration: RadiusExaggerationByKind;
  public readonly radiusExaggerationByBody: Readonly<Record<string, number>>;

  public constructor(options: PresentationRenderScaleOptions = {}) {
    this.metersPerRenderUnit = options.metersPerRenderUnit ?? ASTRONOMICAL_UNIT_M;
    assertMetersPerRenderUnit(this.metersPerRenderUnit);

    const factors = {
      ...DEFAULT_PRESENTATION_RADIUS_EXAGGERATION,
      ...options.radiusExaggeration,
    };
    assertExaggerationFactor(factors.star, 'star');
    assertExaggerationFactor(factors.planet, 'planet');
    assertExaggerationFactor(factors.moon, 'moon');
    assertExaggerationFactor(factors.comet, 'comet');
    this.radiusExaggeration = Object.freeze(factors);

    const factorsByBody: Record<string, number> = {
      ...DEFAULT_PRESENTATION_RADIUS_EXAGGERATION_BY_BODY,
      ...options.radiusExaggerationByBody,
    };
    if (
      options.radiusExaggeration?.planet !== undefined &&
      options.radiusExaggerationByBody?.earth === undefined
    ) {
      delete factorsByBody.earth;
    }
    if (
      options.radiusExaggeration?.moon !== undefined &&
      options.radiusExaggerationByBody?.moon === undefined
    ) {
      delete factorsByBody.moon;
    }
    for (const [bodyId, factor] of Object.entries(factorsByBody)) {
      if (bodyId.trim().length === 0) {
        throw new RangeError('Presentation body-specific radius IDs cannot be empty.');
      }
      assertBodyExaggerationFactor(factor, bodyId);
    }
    this.radiusExaggerationByBody = Object.freeze(factorsByBody);

    this.minimumOverviewRadiusWorld = options.minimumOverviewRadiusWorld ?? 0.002;
    if (
      !Number.isFinite(this.minimumOverviewRadiusWorld) ||
      this.minimumOverviewRadiusWorld < 0
    ) {
      throw new RangeError('minimumOverviewRadiusWorld must be finite and non-negative.');
    }
  }

  public get metersToRenderUnits(): number {
    return 1 / this.metersPerRenderUnit;
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
    assertPhysicalRadius(body.meanRadiusM, body.bodyId);
    return (
      body.meanRadiusM *
      this.metersToRenderUnits *
      (this.radiusExaggerationByBody[body.bodyId] ?? this.radiusExaggeration[body.kind])
    );
  }
}

function assertExaggerationFactor(value: number, kind: keyof RadiusExaggerationByKind): void {
  if (!Number.isFinite(value) || value <= 1) {
    throw new RangeError(`Presentation ${kind} radius exaggeration must be finite and > 1.`);
  }
}

function assertBodyExaggerationFactor(value: number, bodyId: string): void {
  if (!Number.isFinite(value) || value <= 1) {
    throw new RangeError(
      `Presentation radius exaggeration for "${bodyId}" must be finite and > 1.`,
    );
  }
}
