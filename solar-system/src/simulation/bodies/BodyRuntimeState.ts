import type { Vec3d } from '../core/Vec3d';

export type QuaternionTuple = readonly [number, number, number, number];

export interface BodyRuntimeState {
  readonly bodyId: string;
  jdTdb: number;
  readonly positionM: Vec3d;
  readonly velocityMps: Vec3d;
  orientation: QuaternionTuple;
  readonly angularVelocityRadPerSec?: Vec3d;
  visible: boolean;
}
