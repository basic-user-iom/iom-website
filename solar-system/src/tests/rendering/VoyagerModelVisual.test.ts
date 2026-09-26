import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { VoyagerModelVisual } from '../../rendering/spaceobjects/VoyagerModelVisual';
import { mapCameraRelativePosition } from '../../rendering/CameraRelativeTransform';
import { ASTRONOMICAL_UNIT_M } from '../../simulation/core/Units';

describe('Voyager inspection', () => {
  it('points each dish toward Earth in the same coordinate frame as the scene', () => {
    const models = new VoyagerModelVisual();
    const earth = { x: 1e11, y: -1e11, z: 3e9 };
    const earthRender = mapCameraRelativePosition(new Vector3(), earth, { x: 0, y: 0, z: 0 }, ASTRONOMICAL_UNIT_M);
    for (const [id, position] of [
      ['voyager-1', { x: -3e12, y: -9e12, z: 6e12 }],
      ['voyager-2', { x: 4e12, y: -8e12, z: -5e12 }],
    ] as const) {
      const rendered = mapCameraRelativePosition(new Vector3(), position, { x: 0, y: 0, z: 0 }, ASTRONOMICAL_UNIT_M);
      models.update(id, rendered, earth, position, 1 / ASTRONOMICAL_UNIT_M, true);
      const anchor = models.root.getObjectByName(id + '-nasa-model')!;
      const dishNormal = new Vector3(0, 1, 0).applyQuaternion(anchor.quaternion);
      const toEarth = earthRender.clone().sub(anchor.position).normalize();
      expect(dishNormal.dot(toEarth)).toBeCloseTo(1, 12);
      expect(anchor.scale.x * ASTRONOMICAL_UNIT_M).toBeCloseTo(1, 12);
      expect(anchor.position.toArray()).toEqual(rendered.toArray());
    }
    models.dispose();
  });
});
