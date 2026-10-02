import { SelectionGesture } from '../../rendering/SelectionGesture';
describe('SelectionGesture', () => {
  it('accepts a click or a slightly moving tap', () => {
    const gesture = new SelectionGesture();
    gesture.down(1, 10, 10, 0);
    expect(gesture.up(1, 13, 12, 150)).toBe(true);
  });
  it('rejects drags even when the pointer returns to its start', () => {
    const gesture = new SelectionGesture();
    gesture.down(1, 10, 10, 0);
    gesture.move(1, 30, 10);
    expect(gesture.up(1, 10, 10, 150)).toBe(false);
  });
  it('rejects both fingers of a pinch, then permits the next tap', () => {
    const gesture = new SelectionGesture();
    gesture.down(1, 10, 10, 0);
    gesture.down(2, 30, 10, 10, false);
    expect(gesture.up(2, 30, 10, 100)).toBe(false);
    expect(gesture.up(1, 10, 10, 150)).toBe(false);
    gesture.down(3, 10, 10, 200);
    expect(gesture.up(3, 10, 10, 250)).toBe(true);
  });
  it('rejects right clicks, cancellations, long presses, and interrupted wheel gestures', () => {
    const gesture = new SelectionGesture();
    gesture.down(1, 0, 0, 0, false);
    expect(gesture.up(1, 0, 0, 10)).toBe(false);
    gesture.down(1, 0, 0, 0);
    gesture.cancel(1);
    expect(gesture.up(1, 0, 0, 10)).toBe(false);
    gesture.down(1, 0, 0, 0);
    expect(gesture.up(1, 0, 0, 900)).toBe(false);
    gesture.down(1, 0, 0, 0);
    gesture.cancel();
    expect(gesture.up(1, 0, 0, 10)).toBe(false);
  });
});
