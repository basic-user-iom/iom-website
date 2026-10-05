import { installTouchPanGuard } from '../../rendering/camera/TouchPanGuard';

function pointer(target: EventTarget, type: string, id: number, pointerType = 'touch') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType } });
  target.dispatchEvent(event);
}

describe('pinch target stability', () => {
  it('suppresses pan across both fingers and restores mouse pan after cancellation', () => {
    const frame = document.createElement('div');
    const label = frame.appendChild(document.createElement('button'));
    const controls = { enablePan: true };
    const dispose = installTouchPanGuard(frame, controls);
    pointer(label, 'pointerdown', 1);
    pointer(frame, 'pointerdown', 2);
    pointer(window, 'pointerup', 1);
    expect(controls.enablePan).toBe(false);
    pointer(window, 'pointercancel', 2);
    expect(controls.enablePan).toBe(true);
    pointer(frame, 'pointerdown', 3, 'mouse');
    expect(controls.enablePan).toBe(true);
    dispose();
  });

  it('preserves a pre-existing pan lock and cleans up an interrupted gesture', () => {
    const frame = document.createElement('div');
    const controls = { enablePan: false };
    const dispose = installTouchPanGuard(frame, controls);
    pointer(frame, 'pointerdown', 1);
    pointer(window, 'pointerup', 1);
    expect(controls.enablePan).toBe(false);
    controls.enablePan = true;
    pointer(frame, 'pointerdown', 2);
    window.dispatchEvent(new Event('blur'));
    expect(controls.enablePan).toBe(true);
    pointer(frame, 'pointerdown', 3);
    dispose();
    expect(controls.enablePan).toBe(true);
    pointer(frame, 'pointerdown', 4);
    expect(controls.enablePan).toBe(true);
  });
});
