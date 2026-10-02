import { installWheelZoomModifier } from '../../rendering/camera/WheelZoomModifier';

describe('Shift wheel zoom', () => {
  it('sets the multiplier before controls consume each wheel event and removes it on disposal', () => {
    const canvas = document.createElement('canvas');
    const controls = { zoomSpeed: 1 };
    const received: number[] = [];
    // OrbitControls registers its bubbling listener first in the renderer.
    canvas.addEventListener('wheel', () => received.push(controls.zoomSpeed));
    const dispose = installWheelZoomModifier(canvas, controls);
    canvas.dispatchEvent(new WheelEvent('wheel', { shiftKey: true, deltaY: -120 }));
    canvas.dispatchEvent(new WheelEvent('wheel', { shiftKey: false, deltaY: 120 }));
    canvas.dispatchEvent(new WheelEvent('wheel', { shiftKey: true, deltaY: 120 }));
    expect(received).toEqual([4, 1, 4]);
    dispose();
    canvas.dispatchEvent(new WheelEvent('wheel', { shiftKey: true, deltaY: -120 }));
    expect(received).toEqual([4, 1, 4, 1]);
  });
});
