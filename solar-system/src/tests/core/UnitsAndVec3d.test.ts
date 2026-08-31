import {
  ASTRONOMICAL_UNIT_M,
  DAYS_PER_JULIAN_YEAR,
  DAYS_PER_MEAN_MONTH,
  GRAVITATIONAL_CONSTANT_M3_KG_S2,
  METERS_PER_KILOMETER,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_JULIAN_YEAR,
  SECONDS_PER_MEAN_MONTH,
  SECONDS_PER_MINUTE,
  SPEED_OF_LIGHT_MPS,
  daysToSeconds,
  kilometersToMeters,
  metersToKilometers,
  secondsToDays,
} from '../../simulation/core/Units';
import {
  addScaledVec3d,
  addVec3d,
  copyVec3d,
  createVec3d,
  crossVec3d,
  distanceSquaredVec3d,
  dotVec3d,
  isFiniteVec3d,
  lengthSquaredVec3d,
  lengthVec3d,
  normalizeVec3d,
  scaleVec3d,
  setVec3d,
  subtractVec3d,
  type Vec3d,
} from '../../simulation/core/Vec3d';

function components(value: Readonly<Vec3d>): readonly number[] {
  return [value.x, value.y, value.z];
}

describe('Units', () => {
  it('exposes the exact and derived Phase 1 constants', () => {
    expect(METERS_PER_KILOMETER).toBe(1_000);
    expect(SECONDS_PER_MINUTE).toBe(60);
    expect(SECONDS_PER_HOUR).toBe(3_600);
    expect(SECONDS_PER_DAY).toBe(86_400);
    expect(DAYS_PER_JULIAN_YEAR).toBe(365.25);
    expect(DAYS_PER_MEAN_MONTH).toBe(30.4375);
    expect(SECONDS_PER_JULIAN_YEAR).toBe(31_557_600);
    expect(SECONDS_PER_MEAN_MONTH).toBe(2_629_800);
    expect(ASTRONOMICAL_UNIT_M).toBe(149_597_870_700);
    expect(GRAVITATIONAL_CONSTANT_M3_KG_S2).toBe(6.674_3e-11);
    expect(SPEED_OF_LIGHT_MPS).toBe(299_792_458);
  });

  it.each([
    [0, 0],
    [1, 1_000],
    [-2.5, -2_500],
    [123_456.789, 123_456_789],
  ])('converts %s kilometers to meters and back', (kilometers, meters) => {
    expect(kilometersToMeters(kilometers)).toBeCloseTo(meters, 9);
    expect(metersToKilometers(meters)).toBeCloseTo(kilometers, 12);
    expect(metersToKilometers(kilometersToMeters(kilometers))).toBeCloseTo(kilometers, 12);
  });

  it.each([
    [0, 0],
    [1, 86_400],
    [-0.5, -43_200],
    [365.25, 31_557_600],
  ])('converts %s days to seconds and back', (days, seconds) => {
    expect(daysToSeconds(days)).toBeCloseTo(seconds, 9);
    expect(secondsToDays(seconds)).toBeCloseTo(days, 12);
    expect(secondsToDays(daysToSeconds(days))).toBeCloseTo(days, 12);
  });
});

describe('Vec3d allocation and scalar queries', () => {
  it('creates zero and explicitly initialized vectors', () => {
    expect(createVec3d()).toEqual({ x: 0, y: 0, z: 0 });
    expect(createVec3d(1, -2, 3.5)).toEqual({ x: 1, y: -2, z: 3.5 });
  });

  it('computes dot products, lengths, and distances without mutation', () => {
    const left = createVec3d(1, 2, 3);
    const right = createVec3d(4, -5, 6);

    expect(dotVec3d(left, right)).toBe(12);
    expect(lengthSquaredVec3d(left)).toBe(14);
    expect(lengthVec3d(createVec3d(3, 4, 12))).toBe(13);
    expect(distanceSquaredVec3d(left, right)).toBe(67);
    expect(left).toEqual({ x: 1, y: 2, z: 3 });
    expect(right).toEqual({ x: 4, y: -5, z: 6 });
  });

  it('recognizes finite and non-finite vectors', () => {
    expect(isFiniteVec3d(createVec3d(1, -2, 3))).toBe(true);
    expect(isFiniteVec3d(createVec3d(Number.NaN, 0, 0))).toBe(false);
    expect(isFiniteVec3d(createVec3d(0, Number.POSITIVE_INFINITY, 0))).toBe(false);
    expect(isFiniteVec3d(createVec3d(0, 0, Number.NEGATIVE_INFINITY))).toBe(false);
  });
});

describe('Vec3d out parameters', () => {
  it('returns the exact output object for every mutating operation', () => {
    const output = createVec3d();
    const left = createVec3d(1, 2, 3);
    const right = createVec3d(4, 5, 6);

    expect(setVec3d(output, 7, 8, 9)).toBe(output);
    expect(components(output)).toEqual([7, 8, 9]);
    expect(copyVec3d(output, left)).toBe(output);
    expect(components(output)).toEqual([1, 2, 3]);
    expect(addVec3d(output, left, right)).toBe(output);
    expect(components(output)).toEqual([5, 7, 9]);
    expect(subtractVec3d(output, left, right)).toBe(output);
    expect(components(output)).toEqual([-3, -3, -3]);
    expect(scaleVec3d(output, left, 2)).toBe(output);
    expect(components(output)).toEqual([2, 4, 6]);
    expect(addScaledVec3d(output, left, right, 0.5)).toBe(output);
    expect(components(output)).toEqual([3, 4.5, 6]);
    expect(crossVec3d(output, left, right)).toBe(output);
    expect(components(output)).toEqual([-3, 6, -3]);
    expect(normalizeVec3d(output, createVec3d(0, 3, 4))).toBe(output);
    expect(output.x).toBe(0);
    expect(output.y).toBeCloseTo(0.6, 14);
    expect(output.z).toBeCloseTo(0.8, 14);
  });

  it('is safe when an arithmetic output aliases the left or right operand', () => {
    const addLeft = createVec3d(1, 2, 3);
    addVec3d(addLeft, addLeft, createVec3d(4, 5, 6));
    expect(components(addLeft)).toEqual([5, 7, 9]);

    const addRight = createVec3d(4, 5, 6);
    addVec3d(addRight, createVec3d(1, 2, 3), addRight);
    expect(components(addRight)).toEqual([5, 7, 9]);

    const subtractLeft = createVec3d(5, 7, 9);
    subtractVec3d(subtractLeft, subtractLeft, createVec3d(1, 2, 3));
    expect(components(subtractLeft)).toEqual([4, 5, 6]);

    const subtractRight = createVec3d(1, 2, 3);
    subtractVec3d(subtractRight, createVec3d(5, 7, 9), subtractRight);
    expect(components(subtractRight)).toEqual([4, 5, 6]);
  });

  it('is alias-safe for scaling, fused addition, and cross products', () => {
    const scaled = createVec3d(1, -2, 3);
    scaleVec3d(scaled, scaled, -2);
    expect(components(scaled)).toEqual([-2, 4, -6]);

    const baseAlias = createVec3d(1, 2, 3);
    addScaledVec3d(baseAlias, baseAlias, createVec3d(4, 5, 6), 2);
    expect(components(baseAlias)).toEqual([9, 12, 15]);

    const valueAlias = createVec3d(4, 5, 6);
    addScaledVec3d(valueAlias, createVec3d(1, 2, 3), valueAlias, 2);
    expect(components(valueAlias)).toEqual([9, 12, 15]);

    const crossLeft = createVec3d(1, 2, 3);
    crossVec3d(crossLeft, crossLeft, createVec3d(4, 5, 6));
    expect(components(crossLeft)).toEqual([-3, 6, -3]);

    const crossRight = createVec3d(4, 5, 6);
    crossVec3d(crossRight, createVec3d(1, 2, 3), crossRight);
    expect(components(crossRight)).toEqual([-3, 6, -3]);
  });

  it('normalizes in place and collapses zero or non-finite inputs to zero', () => {
    const value = createVec3d(3, 0, 4);
    expect(normalizeVec3d(value, value)).toBe(value);
    expect(value.x).toBeCloseTo(0.6, 14);
    expect(value.y).toBe(0);
    expect(value.z).toBeCloseTo(0.8, 14);

    const output = createVec3d(9, 9, 9);
    normalizeVec3d(output, createVec3d());
    expect(components(output)).toEqual([0, 0, 0]);

    normalizeVec3d(output, createVec3d(Number.POSITIVE_INFINITY, 1, 2));
    expect(components(output)).toEqual([0, 0, 0]);
  });
});
