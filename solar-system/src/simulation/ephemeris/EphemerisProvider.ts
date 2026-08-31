import type { DataProvenance } from '../bodies/DataProvenance';
import type { EphemerisCoverage, EphemerisStateVector } from './EphemerisTypes';

/** Runtime source of barycentric or center-relative position and velocity. */
export interface EphemerisProvider {
  readonly id: string;
  readonly bodyIds: readonly string[];

  hasBody(bodyId: string): boolean;
  getCoverage(bodyId: string): EphemerisCoverage | undefined;
  getProvenance(bodyId: string): DataProvenance | undefined;

  /** Writes into and returns `out`; implementations should not allocate here. */
  sample(bodyId: string, jdTdb: number, out: EphemerisStateVector): EphemerisStateVector;
}
