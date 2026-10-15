// Use the window's short side, not the 3D panel's height: a phone stays within
// its GPU budget when rotated or expanded. A short desktop panel is not mobile.
// Mobile budgets preserve all studies; desktop keeps its original assets and quality.
const coarsePointer = window.matchMedia('(pointer: coarse)');

export function getGalleryQuality(canvas = null) {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const mobile = coarsePointer.matches && Math.min(width, height) <= 900;
  const compact = width <= 700;
  const canvasWidth = canvas?.clientWidth || width;
  return {
    profile: mobile ? 'mobile' : compact ? 'compact' : 'desktop',
    mobile,
    pixelRatioCap: mobile ? 1.25 : 1.75,
    transmissionScale: mobile ? .35 : 1,
    shadowMapSize: mobile ? 1024 : canvasWidth <= 700 ? 2048 : 4096,
    reflectionCap: mobile ? 256 : compact ? 512 : 1024,
  };
}

export function applyGalleryQuality(renderer) {
  const quality = getGalleryQuality(renderer.domElement);
  const ratio = Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap);
  if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
  // Supported by the bundled Three.js renderer. Guard it for alternate builds.
  if ('transmissionResolutionScale' in renderer) {
    renderer.transmissionResolutionScale = quality.transmissionScale;
  }
  return { ...quality, pixelRatio: ratio };
}
