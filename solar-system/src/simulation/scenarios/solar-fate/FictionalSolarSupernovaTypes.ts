import type { ScenarioPlaybackState } from '../ScenarioModule';
import type {
  SolarFateCameraMode,
  SolarFatePlanetId,
} from './SolarFateTypes';

export const FICTIONAL_SOLAR_SUPERNOVA_WARNING =
  'Cinematic scenario: the real Sun is not massive enough to explode as a supernova.';

export const FICTIONAL_SOLAR_SUPERNOVA_TIMING_NOTICE =
  'Fictional timing and propagation are compressed for cinematic display; this is not radiation transport or a physically possible solar event.';

export const FICTIONAL_SOLAR_SUPERNOVA_REMNANT_KINDS = [
  'compact-remnant',
  'neutron-star',
] as const;

export type FictionalSolarSupernovaRemnantKind =
  (typeof FICTIONAL_SOLAR_SUPERNOVA_REMNANT_KINDS)[number];

export type FictionalSolarSupernovaStage =
  | 'idle'
  | 'surface-pulse'
  | 'core-flash'
  | 'shock-breakout'
  | 'radiation-front'
  | 'debris-nebula'
  | 'fictional-remnant'
  | 'complete';

export interface FictionalSolarSupernovaParameters {
  readonly cameraMode: SolarFateCameraMode;
  readonly playbackRate: number;
  readonly remnantKind: FictionalSolarSupernovaRemnantKind;
  readonly seed: number;
}

export interface FictionalRadiationArrival {
  readonly bodyId: SolarFatePlanetId;
  readonly distanceM: number;
  readonly arrivalTimeSeconds: number;
  readonly reached: boolean;
  readonly progress: number;
}

export interface FictionalSolarSupernovaSnapshot {
  readonly state: ScenarioPlaybackState;
  readonly stage: FictionalSolarSupernovaStage;
  readonly classification: 'cinematic';
  readonly title: 'Fictional Solar Supernova';
  readonly warning: typeof FICTIONAL_SOLAR_SUPERNOVA_WARNING;
  readonly timingCompressionNotice: typeof FICTIONAL_SOLAR_SUPERNOVA_TIMING_NOTICE;
  readonly scenarioTimeSeconds: number;
  readonly totalDurationSeconds: number;
  readonly progress: number;
  readonly playbackRate: number;
  readonly parameters: Readonly<FictionalSolarSupernovaParameters> | null;
  readonly pulseScale: number;
  readonly pulseIntensity: number;
  readonly flashIntensity: number;
  readonly coreRadiusM: number;
  readonly shockProgress: number;
  readonly shockRadiusM: number;
  readonly radiationFrontProgress: number;
  readonly radiationFrontRadiusM: number;
  readonly radiationArrivals: readonly Readonly<FictionalRadiationArrival>[];
  readonly heatingByBody: Readonly<Record<SolarFatePlanetId, number>>;
  readonly debrisProgress: number;
  readonly debrisRadiusM: number;
  readonly debrisOpacity: number;
  readonly nebulaRadiusM: number;
  readonly nebulaOpacity: number;
  readonly remnantBlend: number;
  readonly remnantRadiusM: number;
  readonly remnantKind: FictionalSolarSupernovaRemnantKind;
  readonly runSignature: string | null;
}

export const DEFAULT_FICTIONAL_SOLAR_SUPERNOVA_PARAMETERS: Readonly<
  FictionalSolarSupernovaParameters
> = Object.freeze({
  cameraMode: 'solar-closeup',
  playbackRate: 1,
  remnantKind: 'compact-remnant',
  seed: 0x46_5353_4e,
});
