import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PrecisionPath } from '../../rendering/PrecisionPath';
import { createReferenceGrid } from '../../rendering/ReferenceGrid';

describe('reference grid clipping', () => {
  it('clips independent guide segments without drawing links across the scene', () => {
    const camera = new PerspectiveCamera(50, 1, 1e-12, 800);
    camera.updateMatrixWorld();
    const path = new PrecisionPath(4, 'segments');
    path.positions.set([-1, 0, -4, 1, 0, -4, 0, -1, -4, 0, 1, -4]);
    expect(path.prepare(camera)).toBe(2);
    expect(Array.from(path.segments.slice(0, 12))).toEqual([-1, 0, -4, 1, 0, -4, 0, -1, -4, 0, 1, -4]);
  });
  it('clips AU-sized grid geometry in doubles for a metre-scale near plane', () => {
    const grid = createReferenceGrid();
    try {
      const camera = new PerspectiveCamera(50, 1.2, 1e-12, 800);
      camera.position.set(0, 3e-10, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(new Vector3());
      camera.updateMatrixWorld();
      const count = grid.path.prepare(camera);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(grid.path.pointCount / 2);
      for (let i = 0; i < count * 6; i += 3) {
        const view = new Vector3().fromArray(grid.path.segments, i);
        expect(view.z).toBeLessThan(0);
        view.applyMatrix4(camera.projectionMatrix);
        expect(Number.isFinite(view.x + view.y + view.z)).toBe(true);
        expect(Math.abs(view.x)).toBeLessThan(1.011);
        expect(Math.abs(view.y)).toBeLessThan(1.011);
      }
      expect(grid.material.vertexColors).toBe(true);
    } finally { grid.geometry.dispose(); grid.material.dispose(); }
  });
});
