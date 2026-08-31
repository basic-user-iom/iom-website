import type { BodyRuntimeState } from '../bodies/BodyRuntimeState';
import type { Vec3d } from '../core/Vec3d';

export interface ForceProvider {
  readonly id: string;
  acceleration(
    body: BodyRuntimeState,
    allBodies: ReadonlyMap<string, BodyRuntimeState>,
    simulationTimeJdTdb: number,
    outAccelerationMps2: Vec3d,
  ): Vec3d;
}
