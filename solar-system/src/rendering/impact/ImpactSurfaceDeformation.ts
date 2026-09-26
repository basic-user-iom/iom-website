import type { ImpactRenderState } from './ImpactRenderTypes';

export function craterDisplacementM(distanceM: number, radiusM: number, depthM: number, formation: number): number {
  if (radiusM <= 0 || formation <= 0) return 0;
  const r = distanceM / radiusM;
  return (-depthM * Math.pow(Math.max(1 - r * r, 0), 2)
    + depthM * 0.18 * Math.exp(-(((r - 1) / 0.16) ** 2))) * formation;
}
export interface OceanEvolution {
  cavityRadiusM: number; cavityDepthM: number; collapseSeconds: number;
  wavelengthM: number; phaseSpeedMps: number; groupSpeedMps: number;
  extentM: number; shallow: boolean;
}
/** Energy-limited cavity and linear gravity-wave dispersion. Educational bounds,
 * not a hydrocode or an inundation prediction. Time and distance are SI units. */
export function oceanEvolution(state: Readonly<ImpactRenderState>): OceanEvolution {
  const g = Math.max(0.1, state.surfaceGravityMps2);
  const depth = Math.max(1, state.earthSurface?.waterDepthM ?? 1000);
  const energy = state.surfaceImpactEnergyJ ?? 0;
  const radius = Math.max(20, Math.min(state.targetRadiusM * 0.025,
    energy > 0 ? Math.pow(4 * 0.08 * energy / (Math.PI * 1000 * g), 0.25) : state.flashRadiusM * 0.8));
  const wavelength = radius * 3;
  const k = 2 * Math.PI / wavelength, kh = k * depth;
  const c = Math.sqrt(g / k * Math.tanh(kh));
  return { cavityRadiusM: radius, cavityDepthM: Math.min(radius * 0.65, depth * 0.85),
    collapseSeconds: Math.max(1, 1.4 * Math.sqrt(radius / g)), wavelengthM: wavelength,
    phaseSpeedMps: c, groupSpeedMps: c * 0.5 * (1 + (kh < 20 ? 2 * kh / Math.sinh(2 * kh) : 0)),
    extentM: Math.min(440000, Math.max(radius * 10, radius * 3 + c * 130)), shallow: depth < radius * 0.65 };
}
export function oceanCavityProgress(time: number, collapse: number): number {
  if (time <= 0 || time >= collapse * 1.8) return 0;
  return Math.sin(Math.PI * Math.min(1, time / (collapse * 1.8))) ** 1.25;
}
export function oceanJetHeightM(time: number, model: OceanEvolution, gravity: number): number {
  const age = Math.max(0, time - model.collapseSeconds * 1.2);
  return Math.max(0, Math.sqrt(2 * gravity * model.cavityDepthM * 1.4) * age - 0.5 * gravity * age * age);
}
export const CRATER_DISPLACEMENT_GLSL = `
  float craterDisplacement(float r, float depth, float formation) {
    return (-depth * pow(max(1.0-r*r,0.0),2.0)
      + depth*0.18*exp(-pow((r-1.0)/0.16,2.0))) * formation;
  }
`;
