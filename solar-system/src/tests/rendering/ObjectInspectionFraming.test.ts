import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { inspectionDistance, sunlitInspectionDirection } from '../../rendering/camera/ObjectInspectionFraming';

describe('object inspection framing', () => {
  it('frames kilometre-sized moons and spacecraft without a planet-sized distance floor', () => {
    for (const radius of [1e-10, 1e-8, 1e-5, 0.01]) {
      for (const aspect of [0.5, 1, 2]) {
        const distance = inspectionDistance(radius, 50, aspect);
        const limitingAngle = Math.min(25 * Math.PI / 180, Math.atan(Math.tan(25 * Math.PI / 180) * aspect));
        expect(Math.asin(radius / distance)).toBeLessThan(limitingAngle);
        expect(distance / radius).toBeLessThan(6);
      }
    }
  });
  it('keeps the camera on the lit hemisphere even when the parent lies toward the Sun', () => {
    const moon = new Vector3(8, 2, 1);
    const sun = new Vector3();
    const sunward = sun.clone().sub(moon).normalize();
    for (const parent of [new Vector3(7, 1, 1), new Vector3(9, 3, 1), undefined]) {
      const offset = sunlitInspectionDirection(moon, sun, parent);
      expect(offset.length()).toBeCloseTo(1, 12);
      expect(offset.dot(sunward)).toBeGreaterThan(0.7);
    }
  });
});
