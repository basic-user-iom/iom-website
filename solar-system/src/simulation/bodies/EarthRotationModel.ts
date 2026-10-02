import { approximateTdbToJulianDateUtc, J2000_JD_TDB } from '../core/JulianDate';
import { SECONDS_PER_DAY } from '../core/Units';
import {
  rotateBodyLocalVectorToInertial,
  type RotationModel,
  type RotationSampleInput,
  type RotationState,
} from './RotationModel';

const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
const J2000_OBLIQUITY_RAD = 84381.448 * ARCSEC_TO_RAD;
const NORTH = { x: 0, y: 0, z: 1 };

/**
 * USNO mean sidereal time, using UTC as the UT1 approximation and TDB as TT.
 * https://aa.usno.navy.mil/faq/GAST
 * Returns radians in [0, 2 pi); independent of browser time zone.
 */
export function greenwichMeanSiderealAngle(jdTdb: number): number {
  const jdUtc = approximateTdbToJulianDateUtc(jdTdb);
  const midnight = Math.floor(jdUtc - 0.5) + 0.5;
  const days = jdUtc - J2000_JD_TDB;
  const hours = (jdUtc - midnight) * 24;
  const centuries = (jdTdb - J2000_JD_TDB) / 36525;
  // Keep the fractional day in the slow term instead of rounding the hourly
  // coefficient: this avoids a small discontinuity at each UTC midnight.
  const siderealHours = 6.697375 + 0.065707485828 * days
    + hours + 0.0854103 * centuries
    + 0.0000258 * centuries * centuries;
  return ((siderealHours % 24 + 24) % 24) * Math.PI / 12;
}

/**
 * Geographic +X = Greenwich, +Y = 90 degrees east, +Z = north.
 * Converts the mean equator/equinox of date to the ephemeris ECLIPJ2000 frame.
 * IAU 1976 precession angles: https://github.com/liberfa/erfa/blob/master/src/prec76.c
 * UTC approximates UT1; nutation and polar motion are not modeled.
 */
export class EarthRotationModel implements RotationModel {
  public readonly id = 'earth-utc-gmst-precession';
  public readonly bodyId = 'earth';
  public readonly kind = 'constant-rate' as const;
  public readonly approximation =
    'Greenwich mean sidereal rotation with IAU 1976 precession to ECLIPJ2000; UTC approximates UT1, TDB approximates TT; nutation and polar motion omitted.';

  public sample(input: RotationSampleInput, out: RotationState): RotationState {
    const gmst = greenwichMeanSiderealAngle(input.jdTdb);
    const t = (input.jdTdb - J2000_JD_TDB) / 36525;
    const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * ARCSEC_TO_RAD;
    const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * ARCSEC_TO_RAD;
    const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * ARCSEC_TO_RAD;

    // Active quaternion: Rx(-epsilon) Rz(-zeta) Ry(theta) Rz(GMST-z).
    // The inverse precession removes the date-frame equinox already in GMST.
    const a = -zeta;
    const c = gmst - z;
    const s = Math.sin(theta / 2);
    const b = Math.cos(theta / 2);
    const x = s * Math.sin((c - a) / 2);
    const y = s * Math.cos((a - c) / 2);
    const qz = b * Math.sin((a + c) / 2);
    const w = b * Math.cos((a + c) / 2);
    const ce = Math.cos(J2000_OBLIQUITY_RAD / 2);
    const se = Math.sin(J2000_OBLIQUITY_RAD / 2);
    out.orientation.x = ce * x - se * w;
    out.orientation.y = ce * y + se * qz;
    out.orientation.z = ce * qz - se * y;
    out.orientation.w = ce * w + se * x;

    // Dominant spin around the precessed pole; secular pole drift is negligible
    // for the angular-velocity consumers (about 1e-7 of the spin rate).
    rotateBodyLocalVectorToInertial(out.angularVelocityRadPerSec, NORTH, out.orientation);
    const spinRate = 2 * Math.PI * 1.00273781191135 / SECONDS_PER_DAY;
    out.angularVelocityRadPerSec.x *= spinRate;
    out.angularVelocityRadPerSec.y *= spinRate;
    out.angularVelocityRadPerSec.z *= spinRate;
    out.jdTdb = input.jdTdb;
    return out;
  }
}
