import type { Vec3d } from '../../simulation/core/Vec3d';
import type { CameraCloseUpPresetId } from './CameraCloseUpPresets';

export const CAMERA_MODES = [
  'overview',
  'free-orbit',
  'body-follow',
  'earth-moon-system',
  'top-down-ecliptic',
  'chase',
] as const;

export type CameraMode = (typeof CAMERA_MODES)[number];

export interface CameraOrientation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

/**
 * Float64 physical state used by the camera. Positions and velocities retain
 * the ephemeris ECLIPTIC axes; conversion to Three.js axes happens only after
 * the floating origin has been subtracted.
 */
export interface CameraBodyTarget {
  readonly bodyId: string;
  readonly positionM: Readonly<Vec3d>;
  readonly velocityMps: Readonly<Vec3d>;
  readonly radiusM: number;
  /**
   * Optional radius after the active render-scale model has been applied.
   * Presentation scale should provide this value so focus distance follows
   * the visibly exaggerated body, rather than its true physical radius.
   */
  readonly radiusRenderUnits?: number;
  /** Visual sphere local (+Y north) to scene rotation, normally the visual root quaternion. */
  readonly visualLocalToScene?: Readonly<CameraOrientation>;
  readonly visible?: boolean;
}

export interface CameraUpdateFrame {
  readonly realDeltaSeconds: number;
  readonly originM: Readonly<Vec3d>;
  readonly originRevision: number;
  readonly metersPerRenderUnit: number;
  readonly bodies: ReadonlyMap<string, CameraBodyTarget>;
  /** Bounding radius of the orbit/trail layer in current render units. */
  readonly overviewRadiusRenderUnits?: number;
  readonly reducedMotion?: boolean;
}

export interface CameraControllerStatus {
  readonly mode: CameraMode;
  readonly targetBodyId: string | null;
  readonly targetAvailable: boolean;
  readonly originRevision: number;
  readonly closeUpPresetId: CameraCloseUpPresetId | null;
}
