import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  bodyRelativePhysicalScale,
  earthSatelliteMarkerRadius,
  physicalModelScale,
  screenAwareMarkerRadius,
  spacecraftMarkerRadius,
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
    expect(earthSatelliteMarkerRadius(true, 'presentation')).toBe(0.0004);
    expect(earthSatelliteMarkerRadius(false, 'presentation')).toBe(0.00018);
    expect(earthSatelliteMarkerRadius(false, 'true')).toBe(0.00000008);
  });

  it('keeps spacecraft locators larger than satellite beads but still compact', () => {
    expect(spacecraftMarkerRadius(true, 'presentation')).toBe(0.0009);
    expect(spacecraftMarkerRadius(false, 'presentation')).toBe(0.00045);
    expect(spacecraftMarkerRadius(false, 'true')).toBe(0.00016);
  });

  it('keeps locators within 1.25-2 CSS pixels through zoom, resize, and scale changes', () => {
    for (const height of [280, 768, 2160]) {
      for (const fov of [30, 50, 90]) {
        const camera = new PerspectiveCamera(fov, 1, 0.0001, 100);
        camera.position.set(0, 0, 1);
        camera.updateMatrixWorld();
        for (const depth of [0.00001, 0.05, 5, 80]) {
          for (const baseRadius of [0.00000008, 0.00018, 0.00045, 0.0009]) {
            const position = new Vector3(0, 0, 1 - depth);
            const radius = screenAwareMarkerRadius(baseRadius, position, camera, height);
            const center = position.clone().project(camera);
            const edge = position.clone().add(new Vector3(0, radius, 0)).project(camera);
            const pixels = (edge.y - center.y) * height / 2;
            expect(pixels).toBeGreaterThanOrEqual(1.25 - 1e-8);
            expect(pixels).toBeLessThanOrEqual(2 + 1e-8);
          }
        }
      }
    }
  });

  it('gives selected locators a compact three-pixel radius, including orthographic views', () => {
    for (const camera of [new PerspectiveCamera(50, 1, 0.001, 100), new OrthographicCamera(-2, 2, 2, -2)]) {
      camera.position.set(2, 3, 8);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const position = new Vector3();
      const radius = screenAwareMarkerRadius(0.00045, position, camera, 800, true);
      const cameraUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const center = position.clone().project(camera);
      const edge = position.clone().addScaledVector(cameraUp, radius).project(camera);
      expect((edge.y - center.y) * 400).toBeCloseTo(3, 8);
    }
  });

  it('hides markers at or behind a perspective camera and in a collapsed viewport', () => {
    const camera = new PerspectiveCamera();
    camera.updateMatrixWorld();
    expect(screenAwareMarkerRadius(0.001, new Vector3(0, 0, 1), camera, 800)).toBe(0);
    expect(screenAwareMarkerRadius(0.001, new Vector3(), camera, 800)).toBe(0);
    expect(screenAwareMarkerRadius(0.001, new Vector3(0, 0, -1), camera, 0)).toBe(0);
  });
});
