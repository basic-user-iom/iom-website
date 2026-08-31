import { Vector3 } from 'three';

import {
  calculateRebaseShift,
  mapCameraRelativePosition,
} from '../../rendering/CameraRelativeTransform';

describe('camera-relative transforms', () => {
  it('subtracts Float64 physical coordinates before producing render units', () => {
    const output = new Vector3();
    mapCameraRelativePosition(
      output,
      { x: 1_000_000_010, y: -4_999_999_980, z: 7_000_000_030 },
      { x: 1_000_000_000, y: -5_000_000_000, z: 7_000_000_000 },
      10,
    );

    expect(output.toArray()).toEqual([1, 3, -2]);
  });

  it('preserves the camera-to-body vector across an origin rebase', () => {
    const metersPerUnit = 10;
    const oldOrigin = { x: 0, y: 0, z: 0 };
    const newOrigin = { x: 100, y: -50, z: 20 };
    const physicalBody = { x: 250, y: 80, z: -40 };
    const bodyBefore = mapCameraRelativePosition(
      new Vector3(),
      physicalBody,
      oldOrigin,
      metersPerUnit,
    );
    const cameraBefore = new Vector3(7, 3, 12);
    const vectorBefore = bodyBefore.clone().sub(cameraBefore);

    const shift = calculateRebaseShift(
      new Vector3(),
      oldOrigin,
      newOrigin,
      metersPerUnit,
    );
    const bodyAfter = mapCameraRelativePosition(
      new Vector3(),
      physicalBody,
      newOrigin,
      metersPerUnit,
    );
    const cameraAfter = cameraBefore.clone().add(shift);

    expect(bodyAfter.clone().sub(cameraAfter).toArray()).toEqual(vectorBefore.toArray());
  });
});
