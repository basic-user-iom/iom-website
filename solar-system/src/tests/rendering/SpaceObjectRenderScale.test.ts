import { describe, expect, it } from 'vitest';

import {
  bodyRelativePhysicalScale,
  earthSatelliteMarkerRadius,
  physicalModelScale,
} from '../../rendering/spaceobjects/SpaceObjectRenderScale';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

const EARTH_RADIUS_M = 6_371_008.4;

describe('earth satellite render scale', () => {
  it('uses the same presentation meter conversion for Earth-relative geometry and positions', () => {
    const baseMetersToRenderUnits = 1 / ASTRONOMICAL_UNIT_M;
    const earthRenderRadius = EARTH_RADIUS_M * baseMetersToRenderUnits * 40;
    const scale = bodyRelativePhysicalScale(
      earthRenderRadius,
      EARTH_RADIUS_M,
      baseMetersToRenderUnits,
    );

    expect(scale.positionMultiplier).toBeCloseTo(40, 12);
    expect(scale.metersToRenderUnits).toBeCloseTo(baseMetersToRenderUnits * 40, 20);
  });

  it('calibrates the NASA model to 109 m and preserves its physical ratio to Earth', () => {
    const model = physicalModelScale([73.429, 30.628, 108.273], 109);
    const earthRenderRadius = 0.0017035024282601638;
    const metersToRenderUnits = earthRenderRadius / EARTH_RADIUS_M;

    expect(model.authoredSpanMeters).toBe(108.273);
    expect(model.correction).toBeCloseTo(1.0067145087, 10);
    expect((109 * metersToRenderUnits) / (earthRenderRadius * 2))
      .toBeCloseTo(109 / (EARTH_RADIUS_M * 2), 15);
    expect(109 / (EARTH_RADIUS_M * 2)).toBeCloseTo(1 / 116_899.2367, 12);
  });

  it('retains explicit nonphysical markers for satellites without detailed models', () => {
    expect(earthSatelliteMarkerRadius(true, 'presentation')).toBe(0.00018);
    expect(earthSatelliteMarkerRadius(false, 'presentation')).toBe(0.000065);
    expect(earthSatelliteMarkerRadius(false, 'true')).toBe(0.00000008);
  });
});
