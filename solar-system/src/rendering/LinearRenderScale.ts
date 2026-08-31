import type { Vector3 } from 'three';

import type { DebugBodyRenderState, PhysicalPosition } from './RenderContext';
import type { RenderScaleModel } from './RenderScaleModel';
import { mapCameraRelativePosition } from './CameraRelativeTransform';
import { ASTRONOMICAL_UNIT_M } from '../simulation/core/Units';

/**
 * Phase 2 uses a linear heliocentric distance scale and deliberately
 * exaggerated debug marker radii. It is not the presentation-scale implementation planned for
 * Phase 3, so callers must keep the debug/exaggeration badges visible.
 */
export class LinearRenderScale implements RenderScaleModel {
  public readonly id = 'phase-2-linear-debug';
  public readonly label = 'Linear distance / exaggerated markers';
  public readonly mode = 'presentation' as const;
  public readonly radiiAreExaggerated = true;
  public readonly presentationWarningRequired = true;
  public readonly minimumOverviewRadiusWorld = 0.09;

  public constructor(
    public readonly metersPerRenderUnit = ASTRONOMICAL_UNIT_M,
  ) {
    if (!Number.isFinite(metersPerRenderUnit) || metersPerRenderUnit <= 0) {
      throw new RangeError('metersPerRenderUnit must be a finite positive number.');
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
    if (body.kind === 'star') {
      return 0.48;
    }
    return body.kind === 'moon' ? 0.09 : 0.16;
  }
}
