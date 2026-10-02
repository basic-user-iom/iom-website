/** Capture runs before OrbitControls consumes the same wheel event. */
export function installWheelZoomModifier(
  canvas: HTMLElement,
  controls: { zoomSpeed: number },
): () => void {
  const onWheel = (event: WheelEvent): void => {
    controls.zoomSpeed = event.shiftKey ? 4 : 1;
  };
  canvas.addEventListener('wheel', onWheel, { capture: true, passive: true });
  return () => {
    canvas.removeEventListener('wheel', onWheel, true);
    controls.zoomSpeed = 1;
  };
}
