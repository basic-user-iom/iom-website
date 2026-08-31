import type { Vector3 } from 'three';

import type { DebugBodyRenderState, PhysicalPosition } from './RenderContext';

export type RenderScaleMode = 'true' | 'presentation';

export interface RenderScaleModel {
  readonly id: string;
  readonly label: string;
  /** The mode selected by the user, including while a transition is active. */
  readonly mode: RenderScaleMode;
  readonly metersPerRenderUnit: number;
  readonly metersToRenderUnits: number;
  readonly radiiAreExaggerated: boolean;
  /**
   * Remains true for the whole interval in which exaggerated radii contribute
   * to the frame. UI code should use this for the persistent scale warning.
   */
  readonly presentationWarningRequired: boolean;
  /** Screen-space markers may use this hint; it never changes physical radii. */
  readonly minimumOverviewRadiusWorld: number;
  mapPosition(
    output: Vector3,
    physicalPositionM: PhysicalPosition,
    renderOriginM: PhysicalPosition,
  ): Vector3;
  radiusFor(body: DebugBodyRenderState): number;
}
