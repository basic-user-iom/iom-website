import { J2000_JD_TDB } from '../core/JulianDate';
import { SECONDS_PER_DAY } from '../core/Units';
import type { Vec3d } from '../core/Vec3d';
import type { RotationModel, RotationSampleInput, RotationState } from './RotationModel';

/** IAU 2015 Saturn constants, reproduced in NASA/JPL NAIF pck00011.tpc. */
export const SATURN_POLE_SOURCE = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc';
export const SATURN_SPIN_DEG_PER_DAY = 810.7939024;
const DEG = Math.PI / 180;
const OBLIQUITY = 23.439291111111 * DEG; // SPICE ECLIPJ2000, 84381.448 arcseconds.
const CENTURY_SECONDS = 36525 * SECONDS_PER_DAY;

/** North pole in the same ECLIPJ2000 axes as the bundled geometric ephemerides. */
export function saturnPoleEcliptic(jdTdb: number, out: Vec3d): Vec3d {
  if (!Number.isFinite(jdTdb)) throw new RangeError('Saturn orientation epoch must be finite.');
  const centuries = (jdTdb - J2000_JD_TDB) / 36525;
  const ra = (40.589 - 0.036 * centuries) * DEG;
  const dec = (83.537 - 0.004 * centuries) * DEG;
  const yEquatorial = Math.cos(dec) * Math.sin(ra);
  const zEquatorial = Math.sin(dec);
  out.x = Math.cos(dec) * Math.cos(ra);
  out.y = Math.cos(OBLIQUITY) * yEquatorial + Math.sin(OBLIQUITY) * zEquatorial;
  out.z = -Math.sin(OBLIQUITY) * yEquatorial + Math.cos(OBLIQUITY) * zEquatorial;
  return out;
}

/** Analytic IAU orientation, not atmospheric cloud tracking or a SPICE runtime. */
export class SaturnRotationModel implements RotationModel {
  public readonly id = 'iau-2015-naif-pck00011:saturn';
  public readonly bodyId = 'saturn';
  public readonly kind = 'constant-rate' as const;
  public readonly approximation = 'IAU Saturn pole and prime meridian (NAIF pck00011), transformed from ICRF to ECLIPJ2000; dated clouds are illustrative.';

  public sample(input: RotationSampleInput, out: RotationState): RotationState {
    saturnPoleEcliptic(input.jdTdb, out.angularVelocityRadPerSec);
    const days = input.jdTdb - J2000_JD_TDB;
    const centuries = days / 36525;
    const ra = (40.589 - 0.036 * centuries) * DEG;
    const dec = (83.537 - 0.004 * centuries) * DEG;
    const a = (ra + Math.PI / 2) / 2;
    const b = (Math.PI / 2 - dec) / 2;
    const w = ((38.90 + SATURN_SPIN_DEG_PER_DAY * days) % 360) * DEG / 2;
    // Body -> ICRF: Rz(RA+90) Rx(90-Dec) Rz(W), then ICRF -> ecliptic Rx(-epsilon).
    const x = Math.sin(b) * Math.cos(a - w);
    const y = Math.sin(b) * Math.sin(a - w);
    const z = Math.cos(b) * Math.sin(a + w);
    const qw = Math.cos(b) * Math.cos(a + w);
    const c = Math.cos(OBLIQUITY / 2), s = Math.sin(OBLIQUITY / 2);
    out.orientation.x = c * x - s * qw;
    out.orientation.y = c * y + s * z;
    out.orientation.z = c * z - s * y;
    out.orientation.w = c * qw + s * x;
    // Angular velocity includes the small secular pole drift as well as sidereal spin.
    const rate = SATURN_SPIN_DEG_PER_DAY * DEG / SECONDS_PER_DAY;
    const raRate = -0.036 * DEG / CENTURY_SECONDS;
    const tiltRate = 0.004 * DEG / CENTURY_SECONDS;
    const node = ra + Math.PI / 2;
    const driftY = tiltRate * Math.sin(node);
    const angular = out.angularVelocityRadPerSec;
    angular.x = angular.x * rate + tiltRate * Math.cos(node);
    angular.y = angular.y * rate + Math.cos(OBLIQUITY) * driftY + Math.sin(OBLIQUITY) * raRate;
    angular.z = angular.z * rate - Math.sin(OBLIQUITY) * driftY + Math.cos(OBLIQUITY) * raRate;
    out.jdTdb = input.jdTdb;
    return out;
  }
}
