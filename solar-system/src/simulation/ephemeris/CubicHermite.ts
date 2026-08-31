import type { Vec3d } from '../core/Vec3d';

/**
 * Interpolates position and its time derivative between two state vectors.
 * Time and endpoint velocities are in seconds and units/second respectively.
 * Both output vectors may alias endpoint vectors.
 */
export function interpolateCubicHermiteState(
  outPosition: Vec3d,
  outVelocity: Vec3d,
  position0: Readonly<Vec3d>,
  velocity0: Readonly<Vec3d>,
  position1: Readonly<Vec3d>,
  velocity1: Readonly<Vec3d>,
  fraction: number,
  durationSeconds: number,
): void {
  assertHermiteArguments(fraction, durationSeconds);

  const p0x = position0.x;
  const p0y = position0.y;
  const p0z = position0.z;
  const v0x = velocity0.x;
  const v0y = velocity0.y;
  const v0z = velocity0.z;
  const p1x = position1.x;
  const p1y = position1.y;
  const p1z = position1.z;
  const v1x = velocity1.x;
  const v1y = velocity1.y;
  const v1z = velocity1.z;

  const t2 = fraction * fraction;
  const t3 = t2 * fraction;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10Duration = (t3 - 2 * t2 + fraction) * durationSeconds;
  const h01 = -2 * t3 + 3 * t2;
  const h11Duration = (t3 - t2) * durationSeconds;

  const dh00PerSecond = (6 * t2 - 6 * fraction) / durationSeconds;
  const dh10 = 3 * t2 - 4 * fraction + 1;
  const dh01PerSecond = (-6 * t2 + 6 * fraction) / durationSeconds;
  const dh11 = 3 * t2 - 2 * fraction;

  outPosition.x = h00 * p0x + h10Duration * v0x + h01 * p1x + h11Duration * v1x;
  outPosition.y = h00 * p0y + h10Duration * v0y + h01 * p1y + h11Duration * v1y;
  outPosition.z = h00 * p0z + h10Duration * v0z + h01 * p1z + h11Duration * v1z;

  outVelocity.x =
    dh00PerSecond * p0x + dh10 * v0x + dh01PerSecond * p1x + dh11 * v1x;
  outVelocity.y =
    dh00PerSecond * p0y + dh10 * v0y + dh01PerSecond * p1y + dh11 * v1y;
  outVelocity.z =
    dh00PerSecond * p0z + dh10 * v0z + dh01PerSecond * p1z + dh11 * v1z;
}

/** Allocation-free specialization for interleaved [px, py, pz, vx, vy, vz]. */
export function interpolateCubicHermiteSamples(
  outPosition: Vec3d,
  outVelocity: Vec3d,
  samples: ArrayLike<number>,
  firstOffset: number,
  secondOffset: number,
  fraction: number,
  durationSeconds: number,
): void {
  assertHermiteArguments(fraction, durationSeconds);

  const p0x = sampleComponent(samples, firstOffset);
  const p0y = sampleComponent(samples, firstOffset + 1);
  const p0z = sampleComponent(samples, firstOffset + 2);
  const v0x = sampleComponent(samples, firstOffset + 3);
  const v0y = sampleComponent(samples, firstOffset + 4);
  const v0z = sampleComponent(samples, firstOffset + 5);
  const p1x = sampleComponent(samples, secondOffset);
  const p1y = sampleComponent(samples, secondOffset + 1);
  const p1z = sampleComponent(samples, secondOffset + 2);
  const v1x = sampleComponent(samples, secondOffset + 3);
  const v1y = sampleComponent(samples, secondOffset + 4);
  const v1z = sampleComponent(samples, secondOffset + 5);

  const t2 = fraction * fraction;
  const t3 = t2 * fraction;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10Duration = (t3 - 2 * t2 + fraction) * durationSeconds;
  const h01 = -2 * t3 + 3 * t2;
  const h11Duration = (t3 - t2) * durationSeconds;

  const dh00PerSecond = (6 * t2 - 6 * fraction) / durationSeconds;
  const dh10 = 3 * t2 - 4 * fraction + 1;
  const dh01PerSecond = (-6 * t2 + 6 * fraction) / durationSeconds;
  const dh11 = 3 * t2 - 2 * fraction;

  outPosition.x = h00 * p0x + h10Duration * v0x + h01 * p1x + h11Duration * v1x;
  outPosition.y = h00 * p0y + h10Duration * v0y + h01 * p1y + h11Duration * v1y;
  outPosition.z = h00 * p0z + h10Duration * v0z + h01 * p1z + h11Duration * v1z;

  outVelocity.x =
    dh00PerSecond * p0x + dh10 * v0x + dh01PerSecond * p1x + dh11 * v1x;
  outVelocity.y =
    dh00PerSecond * p0y + dh10 * v0y + dh01PerSecond * p1y + dh11 * v1y;
  outVelocity.z =
    dh00PerSecond * p0z + dh10 * v0z + dh01PerSecond * p1z + dh11 * v1z;
}

function assertHermiteArguments(fraction: number, durationSeconds: number): void {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError('Hermite fraction must be finite and in [0, 1].');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError('Hermite duration must be a finite positive number of seconds.');
  }
}

function sampleComponent(samples: ArrayLike<number>, index: number): number {
  const value = samples[index];
  if (value === undefined) {
    throw new RangeError(`Hermite sample component ${index} is unavailable.`);
  }
  return value;
}
