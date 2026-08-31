export type VisualQuality = 'low' | 'medium' | 'high' | 'ultra';

export type VenusSurfaceMode = 'clouds' | 'radar';

export function usesAtmosphereLut(quality: VisualQuality): boolean {
  return quality === 'high' || quality === 'ultra';
}

export function textureAnisotropyCap(quality: VisualQuality): number {
  switch (quality) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 4;
    case 'ultra':
      return 8;
  }
}

export function coronaShellCount(quality: VisualQuality): number {
  switch (quality) {
    case 'low':
      return 0;
    case 'medium':
      return 1;
    case 'high':
      return 2;
    case 'ultra':
      return 3;
  }
}
