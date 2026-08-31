import {
  calculateScaleAwareNavigation,
  dollyDistanceForWheel,
  panDistanceForPixels,
} from '../../rendering/camera/ScaleAwareNavigation';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

describe('scale-aware navigation', () => {
  it('derives pan and physical sensitivity from the visible camera frustum', () => {
    const metrics = calculateScaleAwareNavigation({
      cameraDistanceRenderUnits: 2,
      targetRadiusM: 6_371_008.4,
      metersPerRenderUnit: ASTRONOMICAL_UNIT_M,
      verticalFovDeg: 44,
      viewportWidthPx: 1_440,
      viewportHeightPx: 720,
      systemRadiusRenderUnits: 32,
    });

    expect(metrics.renderUnitsPerPixel).toBeGreaterThan(0);
    expect(metrics.physicalMetersPerPixel).toBeCloseTo(
      metrics.renderUnitsPerPixel * ASTRONOMICAL_UNIT_M,
      6,
    );
    expect(panDistanceForPixels(20, metrics)).toBeCloseTo(
      20 * metrics.renderUnitsPerPixel,
      12,
    );
  });

  it('uses the presentation radius for navigation limits when supplied', () => {
    const trueScale = calculateScaleAwareNavigation({
      cameraDistanceRenderUnits: 1,
      targetRadiusM: 6_371_008.4,
      metersPerRenderUnit: ASTRONOMICAL_UNIT_M,
      verticalFovDeg: 44,
      viewportWidthPx: 1_280,
      viewportHeightPx: 720,
      systemRadiusRenderUnits: 32,
    });
    const presentationScale = calculateScaleAwareNavigation({
      cameraDistanceRenderUnits: 1,
      targetRadiusM: 6_371_008.4,
      targetRadiusRenderUnits: 0.2,
      metersPerRenderUnit: ASTRONOMICAL_UNIT_M,
      verticalFovDeg: 44,
      viewportWidthPx: 1_280,
      viewportHeightPx: 720,
      systemRadiusRenderUnits: 32,
    });

    expect(presentationScale.minimumDistanceRenderUnits).toBeCloseTo(0.24, 12);
    expect(presentationScale.minimumDistanceRenderUnits).toBeGreaterThan(
      trueScale.minimumDistanceRenderUnits,
    );
  });

  it('dollies multiplicatively and clamps at body/system limits', () => {
    const metrics = calculateScaleAwareNavigation({
      cameraDistanceRenderUnits: 5,
      targetRadiusM: 1,
      targetRadiusRenderUnits: 0.5,
      metersPerRenderUnit: 1,
      verticalFovDeg: 50,
      viewportWidthPx: 1_000,
      viewportHeightPx: 500,
      systemRadiusRenderUnits: 10,
    });

    expect(dollyDistanceForWheel(5, -1_000_000, metrics)).toBe(
      metrics.minimumDistanceRenderUnits,
    );
    expect(dollyDistanceForWheel(5, 1_000_000, metrics)).toBe(
      metrics.maximumDistanceRenderUnits,
    );
    expect(dollyDistanceForWheel(5, 100, metrics)).toBeGreaterThan(5);
  });

  it('rejects unusable scale and viewport inputs', () => {
    expect(() =>
      calculateScaleAwareNavigation({
        cameraDistanceRenderUnits: 1,
        targetRadiusM: 1,
        metersPerRenderUnit: 0,
        verticalFovDeg: 44,
        viewportWidthPx: 800,
        viewportHeightPx: 600,
        systemRadiusRenderUnits: 10,
      }),
    ).toThrow(RangeError);
  });
});
