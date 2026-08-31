export const LANDSCAPE_VERTICAL_FOV_DEG = 44;
export const PORTRAIT_VERTICAL_FOV_DEG = 58;

export function verticalFovForViewport(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Viewport dimensions must be finite positive numbers.');
  }
  return width / height < 1 ? PORTRAIT_VERTICAL_FOV_DEG : LANDSCAPE_VERTICAL_FOV_DEG;
}
