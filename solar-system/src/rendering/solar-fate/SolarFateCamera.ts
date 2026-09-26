import type { FictionalSupernovaRenderState, SolarEvolutionRenderState } from './SolarFateRenderTypes';

export type SolarFateCameraView = 'auto' | 'wide' | 'star';

/** CameraController follows at eight times this radius; 0.42 fits an envelope
 * inside the vertical field of view. Radii remain physical, in metres. */
export function solarFateFramingRadius(
  view: SolarFateCameraView,
  evolution: Readonly<SolarEvolutionRenderState> | null,
  nova: Readonly<FictionalSupernovaRenderState> | null,
): number {
  if (evolution !== null) {
    const core = evolution.stellarRadiusM;
    const wide = Math.max(core, evolution.nebulaRadiusM * 0.46);
    if (view === 'star') return core;
    if (view === 'wide') return wide;
    if (evolution.phase === 'mass-loss' || evolution.phase === 'planetary-nebula') return wide;
    if (evolution.phase === 'white-dwarf') {
      const t = Math.max(0, Math.min(1, ((evolution.phaseProgress ?? 1) - 0.15) / 0.7));
      const blend = t * t * (3 - 2 * t);
      return Math.exp(Math.log(Math.max(core, wide)) * (1 - blend) + Math.log(core) * blend);
    }
    return core;
  }
  if (nova !== null) {
    const core = nova.phase === 'remnant' ? nova.remnantRadiusM : nova.coreRadiusM;
    const wide = Math.max(core, nova.shockRadiusM * 0.42, nova.radiationFrontRadiusM * 0.42,
      nova.debrisRadiusM * 0.62, nova.nebulaRadiusM * 0.46);
    if (view === 'star') return core;
    if (view === 'wide') return wide;
    if (nova.phase === 'remnant') return core * (nova.remnantKind === 'neutron-star' ? 4 : 1.5);
    if (nova.phase === 'debris-nebula') {
      return Math.max(core, nova.debrisRadiusM * 0.62, nova.nebulaRadiusM * 0.46);
    }
    return wide;
  }
  return 0;
}
