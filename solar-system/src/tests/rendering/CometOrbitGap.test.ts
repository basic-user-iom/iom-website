import { PerspectiveCamera, Vector3 } from 'three';
import { PrecisionPath } from '../../rendering/PrecisionPath';

describe('physical nucleus gap in a comet orbit', () => {
  const camera = new PerspectiveCamera(60, 1, 1e-12, 800);
  camera.updateMatrixWorld();
  it.each([1, 1e-8])('clips only the nucleus interior at scale %s', scale => {
    const path = new PrecisionPath(2);
    path.positions.set([-2*scale,0,-4*scale,2*scale,0,-4*scale]);
    path.colors.fill(1);
    path.exclusionSphere = {center:new Vector3(0,0,-4*scale),radius:scale};
    expect(path.prepare(camera)).toBe(2);
    expect(path.segments[0]!/scale).toBeCloseTo(-2,5);
    expect(path.segments[3]!/scale).toBeCloseTo(-1,5);
    expect(path.segments[6]!/scale).toBeCloseTo(1,5);
    expect(path.segments[9]!/scale).toBeCloseTo(2,5);
  });
  it('preserves an unrelated planet path and segments missing the nucleus', () => {
    const path = new PrecisionPath(2);
    path.positions.set([-1,1,-4,1,1,-4]);
    expect(path.prepare(camera)).toBe(1);
    const original = path.segments.slice(0,6);
    path.exclusionSphere = {center:new Vector3(0,0,-4),radius:0.5};
    expect(path.prepare(camera)).toBe(1);
    expect(path.segments.slice(0,6)).toEqual(original);
  });
  it('removes a segment entirely inside the nucleus and handles one endpoint inside', () => {
    const path = new PrecisionPath(2);
    path.exclusionSphere = {center:new Vector3(0,0,-4),radius:1};
    path.positions.set([-.5,0,-4,.5,0,-4]);
    expect(path.prepare(camera)).toBe(0);
    path.positions.set([0,0,-4,2,0,-4]);
    expect(path.prepare(camera)).toBe(1);
    expect(path.segments[0]).toBeCloseTo(1);
    expect(path.segments[3]).toBeCloseTo(2);
  });
});
