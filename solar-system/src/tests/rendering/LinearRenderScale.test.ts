import { Vector3 } from 'three';

import { LinearRenderScale } from '../../rendering/LinearRenderScale';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

describe('LinearRenderScale', () => {
  it('maps one astronomical unit to one render unit by default', () => {
    const scale = new LinearRenderScale();
    const output = scale.mapPosition(
      new Vector3(),
      { x: ASTRONOMICAL_UNIT_M, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );

    expect(output.x).toBeCloseTo(1, 12);
    expect(output.y).toBe(0);
    expect(output.z).toBe(0);
  });

  it('rejects invalid distance scales', () => {
    expect(() => new LinearRenderScale(0)).toThrow(RangeError);
    expect(() => new LinearRenderScale(Number.NaN)).toThrow(RangeError);
  });
});
