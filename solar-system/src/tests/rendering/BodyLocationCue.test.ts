import { bodyLocationCueOpacity, bodyLocationOccluded } from '../../rendering/BodyLocationCue';

describe('distant body location cues', () => {
  it('shows unresolved bodies and fades continuously into the physical surface', () => {
    expect(bodyLocationCueOpacity(0.0001)).toBe(1);
    expect(bodyLocationCueOpacity(2)).toBe(1);
    expect(bodyLocationCueOpacity(3.5)).toBeCloseTo(0.5);
    expect(bodyLocationCueOpacity(5)).toBe(0);
    expect(bodyLocationCueOpacity(200)).toBe(0);
    expect(bodyLocationCueOpacity(Infinity)).toBe(0);
  });
  it('hides a point behind a foreground planet but keeps transiting points', () => {
    const camera = { x: 0, y: 0, z: 0 };
    const planet = { x: 0, y: 0, z: -5 };
    expect(bodyLocationOccluded(camera, { x: 0, y: 0, z: -10 }, planet, 1)).toBe(true);
    expect(bodyLocationOccluded(camera, { x: 0, y: 0, z: -2 }, planet, 1)).toBe(false);
    expect(bodyLocationOccluded(camera, { x: 5, y: 0, z: -10 }, planet, 1)).toBe(false);
  });
  it('does not let a body behind the camera or target hide a dot', () => {
    const camera = { x: 0, y: 0, z: 0 }, target = { x: 0, y: 0, z: -10 };
    expect(bodyLocationOccluded(camera, target, { x: 0, y: 0, z: 5 }, 1)).toBe(false);
    expect(bodyLocationOccluded(camera, target, { x: 0, y: 0, z: -15 }, 1)).toBe(false);
  });
  it('uses the same relative geometry at tiny AU render scales', () => {
    expect(bodyLocationOccluded({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -0.001 }, { x: 0, y: 0, z: -0.0005 }, 0.0001)).toBe(true);
    expect(bodyLocationOccluded({ x: 0, y: 0, z: 0 }, { x: 0.0005, y: 0, z: -0.001 }, { x: 0, y: 0, z: -0.0005 }, 0.0001)).toBe(false);
  });
});
