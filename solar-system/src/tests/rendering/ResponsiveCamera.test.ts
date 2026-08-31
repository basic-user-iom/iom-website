import {
  LANDSCAPE_VERTICAL_FOV_DEG,
  PORTRAIT_VERTICAL_FOV_DEG,
  verticalFovForViewport,
} from '../../rendering/ResponsiveCamera';

describe('responsive camera framing', () => {
  it('widens the vertical field of view in a narrow portrait viewport', () => {
    expect(verticalFovForViewport(390, 640)).toBe(PORTRAIT_VERTICAL_FOV_DEG);
    expect(PORTRAIT_VERTICAL_FOV_DEG).toBeGreaterThan(LANDSCAPE_VERTICAL_FOV_DEG);
  });

  it('keeps the restrained field of view on landscape canvases', () => {
    expect(verticalFovForViewport(1440, 720)).toBe(LANDSCAPE_VERTICAL_FOV_DEG);
  });

  it('rejects unusable viewport dimensions', () => {
    expect(() => verticalFovForViewport(0, 500)).toThrow(RangeError);
  });
});
