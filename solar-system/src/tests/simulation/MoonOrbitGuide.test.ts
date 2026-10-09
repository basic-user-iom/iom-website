import { Vector3 } from 'three';
import { NATURAL_SATELLITE_DEFINITIONS } from '../../simulation/satellites/NaturalSatelliteCatalog';
import { sampleNaturalSatellite, sampleNaturalSatelliteOrbitGuide } from '../../simulation/satellites/NaturalSatelliteProvider';

const moons = NATURAL_SATELLITE_DEFINITIONS.filter(moon => moon.tier === 'major' && moon.id !== 'moon');
for (const moon of moons) {
  it(`${moon.id} has a closed guide, one complete winding and the correct current tangent`, () => {
    for (const jd of [2451545, 2451545.125, 2461323.3, 2461500.5, 2488068.5]) {
      const state = sampleNaturalSatellite(moon, jd);
      const points = sampleNaturalSatelliteOrbitGuide(moon, jd, 384);
      expect([...points].every(Number.isFinite)).toBe(true);
      const current = new Vector3(state.positionM.x, state.positionM.y, state.positionM.z);
      const velocity = new Vector3(state.velocityMps.x, state.velocityMps.y, state.velocityMps.z);
      expect([...points.slice(0, 3)]).toEqual(current.toArray());
      expect([...points.slice(-3)]).toEqual(current.toArray());
      const normal = current.clone().cross(velocity).normalize();
      let winding = 0;
      for (let i = 0; i < points.length - 3; i += 3) {
        const a = new Vector3().fromArray(points, i), b = new Vector3().fromArray(points, i + 3);
        expect(Math.abs(normal.dot(a)) / a.length()).toBeLessThan(1e-9);
        winding += Math.atan2(normal.dot(a.clone().cross(b)), a.dot(b));
      }
      expect(winding).toBeCloseTo(2 * Math.PI, 8);
      const tangent = new Vector3().fromArray(points, 3).sub(new Vector3().fromArray(points, points.length - 6)).normalize();
      expect(tangent.dot(velocity.normalize())).toBeGreaterThan(.99999);
      expect(sampleNaturalSatellite(moon, jd)).toEqual(state);
    }
  });
}
it('rejects an invalid guide resolution', () => {
  expect(() => sampleNaturalSatelliteOrbitGuide(moons[0]!, 2461323, 3)).toThrow(RangeError);
});
