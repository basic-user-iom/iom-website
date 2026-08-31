import {
  solarExposureForPreset,
  type SolarExposurePreset,
} from './SolarPostProcessing';

export interface ExposureAdaptationOptions {
  readonly initialPreset?: SolarExposurePreset;
  readonly darkenTimeConstantSeconds?: number;
  readonly brightenTimeConstantSeconds?: number;
  readonly minimumExposure?: number;
  readonly maximumExposure?: number;
}

export interface ExposureAdaptationSnapshot {
  readonly preset: SolarExposurePreset;
  readonly currentExposure: number;
  readonly baseTargetExposure: number;
  readonly targetExposure: number;
  readonly protectiveCeiling: number | null;
}

/** Frame-rate-independent exposure transition with a faster protective darken path. */
export class ExposureAdaptation {
  private readonly darkenTimeConstantSeconds: number;
  private readonly brightenTimeConstantSeconds: number;
  private readonly minimumExposure: number;
  private readonly maximumExposure: number;
  private targetPreset: SolarExposurePreset;
  private baseTargetValue: number;
  private protectiveCeiling: number | null = null;
  private targetValue: number;
  private currentValue: number;

  public constructor(options: ExposureAdaptationOptions = {}) {
    this.darkenTimeConstantSeconds = requirePositive(
      options.darkenTimeConstantSeconds ?? 0.28,
      'darken time constant',
    );
    this.brightenTimeConstantSeconds = requirePositive(
      options.brightenTimeConstantSeconds ?? 0.9,
      'brighten time constant',
    );
    this.minimumExposure = requirePositive(options.minimumExposure ?? 0.45, 'minimum exposure');
    this.maximumExposure = requirePositive(options.maximumExposure ?? 1.2, 'maximum exposure');
    if (this.maximumExposure <= this.minimumExposure) {
      throw new RangeError('Maximum exposure must exceed minimum exposure.');
    }
    this.targetPreset = options.initialPreset ?? 'balanced';
    this.baseTargetValue = this.clamp(solarExposureForPreset(this.targetPreset));
    this.targetValue = this.baseTargetValue;
    this.currentValue = this.targetValue;
  }

  public setPreset(preset: SolarExposurePreset, immediate = false): void {
    this.targetPreset = preset;
    this.baseTargetValue = this.clamp(solarExposureForPreset(preset));
    this.resolveTargetValue();
    if (immediate) this.currentValue = this.targetValue;
  }

  /**
   * Temporarily prevents a scenario flash from using the brighter base
   * camera exposure. Clearing the ceiling restores the preset target without
   * forcing an abrupt bright step.
   */
  public setProtectiveCeiling(
    exposure: number | null,
    immediateDarken = false,
  ): void {
    if (exposure !== null && (!Number.isFinite(exposure) || exposure <= 0)) {
      throw new RangeError('Exposure protective ceiling must be finite and positive.');
    }
    this.protectiveCeiling = exposure === null ? null : this.clamp(exposure);
    this.resolveTargetValue();
    if (immediateDarken && this.targetValue < this.currentValue) {
      this.currentValue = this.targetValue;
    }
  }

  public advance(deltaSeconds: number, reduceFlashes = false): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('Exposure delta must be finite and non-negative.');
    }
    if (deltaSeconds === 0 || this.currentValue === this.targetValue) return this.currentValue;
    const baseTimeConstant =
      this.targetValue < this.currentValue
        ? this.darkenTimeConstantSeconds
        : this.brightenTimeConstantSeconds;
    // Keep the protective darken path responsive, but slow any brightening
    // when the user asks to reduce flashes. The smaller catch-up cap also
    // prevents a restored/background tab from applying a large bright step.
    const reducingBrightnessFlash = reduceFlashes && this.targetValue > this.currentValue;
    const timeConstant = reducingBrightnessFlash
      ? Math.max(baseTimeConstant, 2.4)
      : baseTimeConstant;
    const maximumStepSeconds = reducingBrightnessFlash ? 0.05 : 0.25;
    const blend = 1 - Math.exp(-Math.min(deltaSeconds, maximumStepSeconds) / timeConstant);
    this.currentValue = this.clamp(
      this.currentValue + (this.targetValue - this.currentValue) * blend,
    );
    if (Math.abs(this.currentValue - this.targetValue) < 1e-5) {
      this.currentValue = this.targetValue;
    }
    return this.currentValue;
  }

  public get state(): Readonly<{
    preset: SolarExposurePreset;
    exposure: number;
    targetExposure: number;
  }> {
    return Object.freeze({
      preset: this.targetPreset,
      exposure: this.currentValue,
      targetExposure: this.targetValue,
    });
  }

  public captureState(): Readonly<ExposureAdaptationSnapshot> {
    return Object.freeze({
      preset: this.targetPreset,
      currentExposure: this.currentValue,
      baseTargetExposure: this.baseTargetValue,
      targetExposure: this.targetValue,
      protectiveCeiling: this.protectiveCeiling,
    });
  }

  public restoreState(snapshot: Readonly<ExposureAdaptationSnapshot>): void {
    if (!['deep-space', 'balanced', 'solar-closeup'].includes(snapshot.preset)) {
      throw new RangeError(`Unsupported exposure preset "${String(snapshot.preset)}".`);
    }
    const currentExposure = this.requireInRange(
      snapshot.currentExposure,
      'snapshot current exposure',
    );
    const baseTargetExposure = this.requireInRange(
      snapshot.baseTargetExposure,
      'snapshot base target exposure',
    );
    const targetExposure = this.requireInRange(
      snapshot.targetExposure,
      'snapshot target exposure',
    );
    const protectiveCeiling = snapshot.protectiveCeiling === null
      ? null
      : this.requireInRange(
          snapshot.protectiveCeiling,
          'snapshot protective ceiling',
        );

    const resolvedTarget = protectiveCeiling === null
      ? baseTargetExposure
      : Math.min(baseTargetExposure, protectiveCeiling);
    if (Math.abs(resolvedTarget - targetExposure) > 1e-9) {
      throw new RangeError(
        'Exposure snapshot target does not match its base target and protective ceiling.',
      );
    }
    this.targetPreset = snapshot.preset;
    this.baseTargetValue = baseTargetExposure;
    this.protectiveCeiling = protectiveCeiling;
    this.targetValue = resolvedTarget;
    this.currentValue = currentExposure;
  }

  private clamp(value: number): number {
    return Math.min(Math.max(value, this.minimumExposure), this.maximumExposure);
  }

  private resolveTargetValue(): void {
    this.targetValue = this.protectiveCeiling === null
      ? this.baseTargetValue
      : Math.min(this.baseTargetValue, this.protectiveCeiling);
  }

  private requireInRange(value: number, label: string): number {
    if (
      !Number.isFinite(value) ||
      value < this.minimumExposure ||
      value > this.maximumExposure
    ) {
      throw new RangeError(
        `Exposure ${label} must be finite and within the configured exposure range.`,
      );
    }
    return value;
  }
}

export function aggregateProtectiveExposureCeilings(
  ceilings: readonly (number | null)[],
): number | null {
  let result: number | null = null;
  for (const ceiling of ceilings) {
    if (ceiling === null) continue;
    requirePositive(ceiling, 'protective ceiling');
    result = result === null ? ceiling : Math.min(result, ceiling);
  }
  return result;
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Exposure ${label} must be finite and positive.`);
  }
  return value;
}
