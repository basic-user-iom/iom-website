import {
  interpolateCubicHermiteSamples,
  interpolateCubicHermiteState,
} from '../../simulation/ephemeris/CubicHermite';
import { createVec3d } from '../../simulation/core/Vec3d';

function cubic(seconds: number): number {
  return 2 + 3 * seconds - 0.5 * seconds ** 2 + 0.25 * seconds ** 3;
}

function cubicDerivative(seconds: number): number {
  return 3 - seconds + 0.75 * seconds ** 2;
}

describe('cubic Hermite ephemeris interpolation', () => {
  it('recovers a cubic position and its derivative', () => {
    const duration = 4;
    const position0 = createVec3d(cubic(0), 2 * cubic(0), -cubic(0));
    const velocity0 = createVec3d(
      cubicDerivative(0),
      2 * cubicDerivative(0),
      -cubicDerivative(0),
    );
    const position1 = createVec3d(cubic(duration), 2 * cubic(duration), -cubic(duration));
    const velocity1 = createVec3d(
      cubicDerivative(duration),
      2 * cubicDerivative(duration),
      -cubicDerivative(duration),
    );
    const outPosition = createVec3d();
    const outVelocity = createVec3d();
    const seconds = 1.25;

    interpolateCubicHermiteState(
      outPosition,
      outVelocity,
      position0,
      velocity0,
      position1,
      velocity1,
      seconds / duration,
      duration,
    );

    expect(outPosition.x).toBeCloseTo(cubic(seconds), 13);
    expect(outPosition.y).toBeCloseTo(2 * cubic(seconds), 13);
    expect(outPosition.z).toBeCloseTo(-cubic(seconds), 13);
    expect(outVelocity.x).toBeCloseTo(cubicDerivative(seconds), 13);
    expect(outVelocity.y).toBeCloseTo(2 * cubicDerivative(seconds), 13);
    expect(outVelocity.z).toBeCloseTo(-cubicDerivative(seconds), 13);
  });

  it('reproduces both endpoints exactly', () => {
    const position0 = createVec3d(1, 2, 3);
    const velocity0 = createVec3d(4, 5, 6);
    const position1 = createVec3d(7, 8, 9);
    const velocity1 = createVec3d(10, 11, 12);
    const outPosition = createVec3d();
    const outVelocity = createVec3d();

    interpolateCubicHermiteState(
      outPosition,
      outVelocity,
      position0,
      velocity0,
      position1,
      velocity1,
      0,
      60,
    );
    expect(outPosition).toEqual(position0);
    expect(outVelocity).toEqual(velocity0);

    interpolateCubicHermiteState(
      outPosition,
      outVelocity,
      position0,
      velocity0,
      position1,
      velocity1,
      1,
      60,
    );
    expect(outPosition).toEqual(position1);
    expect(outVelocity).toEqual(velocity1);
  });

  it('supports aliased vector outputs and interleaved sample storage', () => {
    const samples = new Float64Array([
      1, 2, 3, 4, 5, 6,
      9, 12, 15, 4, 5, 6,
    ]);
    const position = createVec3d(100, 200, 300);
    const velocity = createVec3d(-1, -2, -3);

    interpolateCubicHermiteSamples(position, velocity, samples, 0, 6, 0.5, 2);

    expect(position).toEqual({ x: 5, y: 7, z: 9 });
    expect(velocity).toEqual({ x: 4, y: 5, z: 6 });

    const firstPosition = createVec3d(1, 2, 3);
    const firstVelocity = createVec3d(4, 5, 6);
    interpolateCubicHermiteState(
      firstPosition,
      firstVelocity,
      firstPosition,
      firstVelocity,
      createVec3d(9, 12, 15),
      createVec3d(4, 5, 6),
      0.5,
      2,
    );
    expect(firstPosition).toEqual(position);
    expect(firstVelocity).toEqual(velocity);
  });

  it('rejects extrapolation, invalid durations, and missing components', () => {
    const output = createVec3d();
    expect(() =>
      interpolateCubicHermiteSamples(output, output, [], 0, 6, 0.5, 1),
    ).toThrow(RangeError);
    expect(() =>
      interpolateCubicHermiteState(
        output,
        output,
        output,
        output,
        output,
        output,
        -0.1,
        1,
      ),
    ).toThrow(/fraction/);
    expect(() =>
      interpolateCubicHermiteState(
        output,
        output,
        output,
        output,
        output,
        output,
        0.5,
        0,
      ),
    ).toThrow(/duration/);
  });
});
