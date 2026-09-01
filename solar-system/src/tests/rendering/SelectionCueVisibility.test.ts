import { PerspectiveCamera, Vector3 } from 'three';

import {
  projectedSphereRadiusPx,
  SELECTION_CUE_FADE_END_PX,
  SELECTION_CUE_FADE_START_PX,
  selectionCueOpacityForProjectedRadius,
} from '../../rendering/SelectionCueVisibility';

describe('distance-aware selection cues', () => {
  it('keeps distant locators, fades during approach, and hides close-up clutter', () => {
    expect(selectionCueOpacityForProjectedRadius(SELECTION_CUE_FADE_START_PX - 1)).toBe(1);
    expect(selectionCueOpacityForProjectedRadius(
      (SELECTION_CUE_FADE_START_PX + SELECTION_CUE_FADE_END_PX) * 0.5,
    )).toBeCloseTo(0.5, 12);
    expect(selectionCueOpacityForProjectedRadius(SELECTION_CUE_FADE_END_PX)).toBe(0);
    expect(selectionCueOpacityForProjectedRadius(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('measures apparent radius from the active perspective camera', () => {
    const camera = new PerspectiveCamera(60, 16 / 9, 0.01, 1_000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const radiusPx = projectedSphereRadiusPx(
      camera,
      new Vector3(0, 0, -10),
      1,
      1_600,
      900,
    );

    expect(radiusPx).toBeCloseTo(77.942286, 5);
    expect(selectionCueOpacityForProjectedRadius(radiusPx)).toBe(0);
  });
});

