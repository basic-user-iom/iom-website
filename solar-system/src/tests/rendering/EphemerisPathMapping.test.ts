import {
  calculateDistantPathIntensity,
  writeCameraRelativePathPositions,
  writeDistanceFadedPathColors,
} from '../../rendering/EphemerisPathMapping';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

describe('camera-relative ephemeris path mapping', () => {
  it('preserves metre offsets in source-frame paths at Neptune distance', () => {
    const neptuneDistanceM = 30 * ASTRONOMICAL_UNIT_M;
    // The former GPU-side +30 AU/-30 AU composition loses this metre entirely.
    expect(
      Math.fround(neptuneDistanceM + 1) - Math.fround(neptuneDistanceM),
    ).toBe(0);
    const positionsM = new Float64Array([
      neptuneDistanceM + 1,
      -2,
      3,
      neptuneDistanceM + 4,
      -5,
      6,
    ]);
    const output = new Float32Array(positionsM.length);

    writeCameraRelativePathPositions(
      output,
      positionsM,
      { x: 0, y: 0, z: 0 },
      { x: neptuneDistanceM, y: 0, z: 0 },
      1,
    );

    expect([...output]).toEqual([1, 3, 2, 4, 6, 5]);

    writeCameraRelativePathPositions(
      output,
      positionsM,
      { x: 0, y: 0, z: 0 },
      { x: neptuneDistanceM, y: 0, z: 0 },
      ASTRONOMICAL_UNIT_M,
    );
    expect(output[0]).toBe(Math.fround(1 / ASTRONOMICAL_UNIT_M));
    expect(output[0]).toBeGreaterThan(0);
  });

  it('preserves center-relative metre detail through repeated Neptune-scale rebases', () => {
    const relativePathM = new Float64Array([1.25, -2.5, 3.75, 4.5, -5.25, 6.75]);
    const output = new Float32Array(relativePathM.length);
    const centerM = {
      x: 29.8 * ASTRONOMICAL_UNIT_M,
      y: -0.7 * ASTRONOMICAL_UNIT_M,
      z: 0.4 * ASTRONOMICAL_UNIT_M,
    };

    for (let frame = 0; frame < 600; frame += 1) {
      centerM.x += 83.125;
      centerM.y -= 41.5;
      centerM.z += 9.75;
      writeCameraRelativePathPositions(output, relativePathM, centerM, centerM, 1);
      expect([...output]).toEqual([1.25, 3.75, 2.5, 4.5, 6.75, 5.25]);
    }
  });

  it('preserves Earth-relative Moon path semantics after an Earth/Moon rebase', () => {
    const earthM = { x: ASTRONOMICAL_UNIT_M, y: -2_000_000, z: 900_000 };
    const moonRelativeM = new Float64Array([
      384_400_001,
      2,
      3,
      384_400_004,
      5,
      6,
    ]);
    const output = new Float32Array(moonRelativeM.length);
    const moonOriginM = {
      x: earthM.x + 384_400_000,
      y: earthM.y,
      z: earthM.z,
    };

    writeCameraRelativePathPositions(output, moonRelativeM, earthM, moonOriginM, 1);

    expect([...output]).toEqual([1, 3, -2, 4, 6, -5]);
  });
});

describe('distance-based path fading', () => {
  it('is monotonic and keeps selected trails clearer than orbit lines', () => {
    expect(calculateDistantPathIntensity(0, 'orbit')).toBe(1);
    expect(calculateDistantPathIntensity(1, 'orbit')).toBeCloseTo(0.08, 12);
    expect(calculateDistantPathIntensity(1, 'trail')).toBeCloseTo(0.42, 12);
    expect(calculateDistantPathIntensity(0.75, 'orbit')).toBeLessThan(
      calculateDistantPathIntensity(0.25, 'orbit'),
    );
  });

  it('writes the closest vertex bright and fades the most distant vertex', () => {
    const positionsM = new Float64Array([0, 0, 0, 5, 0, 0, 10, 0, 0]);
    const colors = new Float32Array(positionsM.length);

    writeDistanceFadedPathColors(
      colors,
      positionsM,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { r: 1, g: 0.5, b: 0.25 },
      'orbit',
    );

    expect(colors[0]).toBe(1);
    expect(colors[1]).toBe(0.5);
    expect(colors[2]).toBe(0.25);
    expect(colors[6]).toBeCloseTo(0.08, 6);
    expect(colors[7]).toBeCloseTo(0.04, 6);
    expect(colors[8]).toBeCloseTo(0.02, 6);
  });
});
