/** Keep pinch centred on the orbit target; retain intentional mouse/right-drag pan. */
export function installTouchPanGuard(element: HTMLElement, controls: { enablePan: boolean }): () => void {
  const touches = new Set<number>();
  let previousPan = controls.enablePan;
  const down = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    if (touches.size === 0) previousPan = controls.enablePan;
    touches.add(event.pointerId);
    controls.enablePan = false;
  };
  const end = (event: PointerEvent) => {
    if (!touches.delete(event.pointerId)) return;
    if (touches.size === 0) controls.enablePan = previousPan;
  };
  const clear = () => {
    if (touches.size) controls.enablePan = previousPan;
    touches.clear();
  };
  element.addEventListener('pointerdown', down, true);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('blur', clear);
  return () => {
    clear();
    element.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    window.removeEventListener('blur', clear);
  };
}
