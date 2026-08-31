import type { Vector3 } from 'three';

import { mapCameraRelativePosition } from './CameraRelativeTransform';
import type { DebugBodyRenderState, PhysicalPosition } from './RenderContext';
import type { RenderScaleModel } from './RenderScaleModel';
import { ASTRONOMICAL_UNIT_M } from '../simulation/core/Units';

/**
 * A single linear conversion is used for positions and radii. Consequently,
 * the rendered radius-to-distance ratio is exactly the physical SI ratio.
 */
export class TrueRenderScale implements RenderScaleModel {
  public readonly id = 'true-physical-scale';
  public readonly label = 'True physical scale';
  public readonly mode = 'true' as const;
  public readonly radiiAreExaggerated = false;
  public readonly presentationWarningRequired = false;
  public readonly minimumOverviewRadiusWorld = 0;

  public constructor(
    public readonly metersPerRenderUnit = ASTRONOMICAL_UNIT_M,
  ) {
    assertMetersPerRenderUnit(metersPerRenderUnit);
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
    return body.meanRadiusM * this.metersToRenderUnits;
  }
}

export function assertMetersPerRenderUnit(metersPerRenderUnit: number): void {
  if (!Number.isFinite(metersPerRenderUnit) || metersPerRenderUnit <= 0) {
    throw new RangeError('metersPerRenderUnit must be a finite positive number.');
  }
}

export function assertPhysicalRadius(radiusM: number, bodyId: string): void {
  if (!Number.isFinite(radiusM) || radiusM < 0) {
    throw new RangeError(`Body "${bodyId}" must have a finite non-negative physical radius.`);
  }
}
