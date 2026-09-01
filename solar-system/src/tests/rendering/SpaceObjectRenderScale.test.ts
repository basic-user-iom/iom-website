import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_ISS_MODEL_RADIUS_RENDER_UNITS,
  SELECTED_ISS_MODEL_RADIUS_RENDER_UNITS,
  earthSatelliteRenderRadius,
} from '../../rendering/spaceobjects/SpaceObjectRenderScale';

describe('earth satellite render scale', () => {
  it('keeps the selected ISS model much smaller than a generic selected marker', () => {
    const station = earthSatelliteRenderRadius(true, true, 'presentation');
    const generic = earthSatelliteRenderRadius(false, true, 'presentation');

    expect(station).toBe(SELECTED_ISS_MODEL_RADIUS_RENDER_UNITS);
    expect(station).toBeLessThanOrEqual(generic / 5);
  });

  it('uses a compact overview model and preserves the true-scale marker floor', () => {
    expect(earthSatelliteRenderRadius(true, false, 'presentation'))
      .toBe(PRESENTATION_ISS_MODEL_RADIUS_RENDER_UNITS);
    expect(PRESENTATION_ISS_MODEL_RADIUS_RENDER_UNITS)
      .toBeLessThan(SELECTED_ISS_MODEL_RADIUS_RENDER_UNITS);
    expect(earthSatelliteRenderRadius(true, false, 'true')).toBe(0.00000008);
  });
});
