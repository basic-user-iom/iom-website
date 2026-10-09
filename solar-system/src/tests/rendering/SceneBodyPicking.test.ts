import { PerspectiveCamera, Vector3 } from 'three';
import { pickSceneBody, type PickableSceneBody } from '../../rendering/SceneBodyPicking';

const camera = new PerspectiveCamera(50, 1, .01, 100);
camera.updateMatrixWorld(true);
const body = (id: string, x: number, z: number, radius: number, allowPointPick = true): PickableSceneBody =>
  ({ id, position: new Vector3(x, 0, z), radius, allowPointPick });
const pick = (bodies: PickableSceneBody[], x = 200, y = 200) => pickSceneBody(camera, bodies, x, y, 400, 400, 22);
it('picks a visible moon dot within a 44-pixel touch target without requiring a text label', () => {
  expect(pick([body('saturn', 4, -10, 1), body('mimas', 0, -10, .001)], 218)).toBe('mimas');
  expect(pick([body('mimas', 0, -10, .001)], 224)).toBeNull();
});
it('selects the closest physical surface when a moon crosses its parent', () => {
  expect(pick([body('saturn', 0, -10, 2), body('titan', 0, -5, .2)])).toBe('titan');
  expect(pick([body('saturn', 0, -5, 2), body('titan', 0, -10, .2)])).toBe('saturn');
});
it('does not pick an occulted dot even when tapping just outside the parent surface', () => {
  expect(pick([body('saturn', 0, -5, .1, false), body('mimas', 0, -10, .001)], 218)).toBeNull();
});
it('preserves body/comet picking and rejects hidden dots and off-canvas taps', () => {
  expect(pick([body('1p-halley', 0, -5, .3)])).toBe('1p-halley');
  expect(pick([body('mimas', 0, -10, .001, false)], 218)).toBeNull();
  expect(pick([body('mimas', 0, 10, .001)], 218)).toBeNull();
  expect(pick([body('mimas', 0, -10, .001)], -1)).toBeNull();
});
