export const IMPACT_VISIBILITY_MODES = ['physical', 'enhanced'] as const;

export type ImpactVisibilityMode = (typeof IMPACT_VISIBILITY_MODES)[number];

export const DEFAULT_IMPACT_VISIBILITY_MODE: ImpactVisibilityMode = 'enhanced';
export const MAXIMUM_IMPACT_VISIBILITY_MULTIPLIER = 16;

export interface ImpactVisibilityDimensions {
  readonly targetRadiusM: number;
  readonly flashRadiusM: number;
  readonly craterRadiusM: number;
  readonly scorchRadiusM: number;
  readonly ejectaRadiusM: number;
  readonly plumeHeightM: number;
  readonly plumeRadiusM: number;
}

/**
 * Returns a rendering-only multiplier. It never feeds simulation state or
 * reported physical quantities. Large events naturally approach 1x so an
 * already planetary-scale effect cannot be expanded beyond the target.
 */
export function impactVisibilityMultiplier(
  mode: ImpactVisibilityMode,
  dimensions: Readonly<ImpactVisibilityDimensions>,
): number {
  if (mode === 'physical') return 1;
  const characteristicSizeM = Math.max(
    dimensions.flashRadiusM,
    dimensions.craterRadiusM * 2.4,
    dimensions.scorchRadiusM,
    dimensions.ejectaRadiusM,
    dimensions.plumeHeightM,
    dimensions.plumeRadiusM,
  );
  if (
    !Number.isFinite(dimensions.targetRadiusM)
    || dimensions.targetRadiusM <= 0
    || !Number.isFinite(characteristicSizeM)
    || characteristicSizeM <= 0
  ) {
    return 1;
  }
  const multiplier = dimensions.targetRadiusM * 0.035 / characteristicSizeM;
  return Math.min(MAXIMUM_IMPACT_VISIBILITY_MULTIPLIER, Math.max(1, multiplier));
}

export function formatImpactVisibilityMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier) || multiplier <= 1) return '1x';
  return `${multiplier >= 10 ? multiplier.toFixed(0) : multiplier.toFixed(1)}x`;
}
