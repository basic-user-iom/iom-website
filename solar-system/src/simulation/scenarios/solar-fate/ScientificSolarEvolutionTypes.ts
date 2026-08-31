import type { ScenarioPlaybackState } from '../ScenarioModule';
import type {
  SolarFateCameraMode,
  SolarFatePlanetId,
} from './SolarFateTypes';

export const SOLAR_EVOLUTION_PHASE_IDS = [
  'present',
  'red-giant',
  'inner-system-heating',
  'mass-loss-nebular',
  'white-dwarf',
  'cooling-remnant',
] as const;

export type SolarEvolutionPhaseId = (typeof SOLAR_EVOLUTION_PHASE_IDS)[number];

export type ScientificSolarEvolutionStage =
  | 'idle'
  | SolarEvolutionPhaseId
  | 'complete';

export interface SolarEvolutionProvenance {
  readonly provider: 'NASA';
  readonly sourceName: string;
  readonly url: string;
  readonly retrievedAtIso: string;
  readonly notes: string;
}

export interface SolarEvolutionPhaseProfile {
  readonly id: SolarEvolutionPhaseId;
  readonly label: string;
  readonly durationSeconds: number;
  readonly radiusSolarRadii: number;
  readonly luminositySolar: number;
  readonly massSolarMasses: number;
  readonly effectiveTemperatureK: number;
  readonly radiusLabel: string;
  readonly luminosityLabel: string;
  readonly massLossLabel: string;
  readonly innerSystemHeating: number;
  readonly massLossShellOpacity: number;
  readonly nebulaOpacity: number;
  readonly nebulaDisplayRadiusSolarRadii: number;
  readonly whiteDwarfBlend: number;
  readonly engulfedBodyIds: readonly SolarFatePlanetId[];
  readonly uncertainBodyIds: readonly SolarFatePlanetId[];
  readonly caveats: readonly string[];
}

export interface SolarEvolutionProfile {
  readonly schemaVersion: 1;
  readonly profileId: 'sun-1-solar-mass-v1';
  readonly modelVersion: 'solar-evolution-narrative-v1';
  readonly title: 'Scientific Solar Evolution';
  readonly classification: 'educational-approximation';
  readonly timeCompressionNotice: string;
  readonly valuesAreIllustrative: true;
  readonly provenance: readonly Readonly<SolarEvolutionProvenance>[];
  readonly globalCaveats: readonly string[];
  readonly phases: readonly Readonly<SolarEvolutionPhaseProfile>[];
  readonly totalDurationSeconds: number;
}

export interface SolarEvolutionSample {
  readonly phaseId: SolarEvolutionPhaseId;
  readonly phaseLabel: string;
  readonly phaseProgress: number;
  readonly radiusSolarRadii: number;
  readonly luminositySolar: number;
  readonly massSolarMasses: number;
  readonly effectiveTemperatureK: number;
  readonly radiusLabel: string;
  readonly luminosityLabel: string;
  readonly massLossLabel: string;
  readonly innerSystemHeating: number;
  readonly massLossShellOpacity: number;
  readonly nebulaOpacity: number;
  readonly nebulaDisplayRadiusSolarRadii: number;
  readonly whiteDwarfBlend: number;
  readonly engulfedBodyIds: readonly SolarFatePlanetId[];
  readonly uncertainBodyIds: readonly SolarFatePlanetId[];
  readonly caveats: readonly string[];
}

export interface ScientificSolarEvolutionParameters {
  readonly profileId: 'sun-1-solar-mass-v1';
  readonly cameraMode: SolarFateCameraMode;
  readonly playbackRate: number;
  readonly seed: number;
}

export interface ScientificSolarEvolutionSnapshot {
  readonly state: ScenarioPlaybackState;
  readonly stage: ScientificSolarEvolutionStage;
  readonly classification: 'educational-approximation';
  readonly title: 'Scientific Solar Evolution';
  readonly scenarioTimeSeconds: number;
  readonly totalDurationSeconds: number;
  readonly progress: number;
  readonly normalizedEvolutionProgress: number;
  readonly phaseId: SolarEvolutionPhaseId | null;
  readonly phaseLabel: string;
  readonly phaseProgress: number;
  readonly playbackRate: number;
  readonly parameters: Readonly<ScientificSolarEvolutionParameters> | null;
  readonly radiusSolarRadii: number;
  readonly physicalRadiusM: number;
  readonly luminositySolar: number;
  readonly massSolarMasses: number;
  readonly effectiveTemperatureK: number;
  readonly radiusLabel: string;
  readonly luminosityLabel: string;
  readonly massLossLabel: string;
  readonly innerSystemHeating: number;
  readonly massLossShellOpacity: number;
  readonly nebulaOpacity: number;
  readonly nebulaDisplayRadiusSolarRadii: number;
  readonly nebulaDisplayRadiusM: number;
  readonly whiteDwarfBlend: number;
  readonly heatingByBody: Readonly<Record<SolarFatePlanetId, number>>;
  readonly engulfmentByBody: Readonly<Record<SolarFatePlanetId, number>>;
  readonly engulfedBodyIds: readonly SolarFatePlanetId[];
  readonly uncertainBodyIds: readonly SolarFatePlanetId[];
  readonly caveats: readonly string[];
  readonly timeCompressionNotice: string;
  readonly compactRemnantSizeExaggerationRequired: boolean;
  readonly runSignature: string | null;
}

export const DEFAULT_SCIENTIFIC_SOLAR_EVOLUTION_PARAMETERS: Readonly<
  ScientificSolarEvolutionParameters
> = Object.freeze({
  profileId: 'sun-1-solar-mass-v1',
  cameraMode: 'solar-closeup',
  playbackRate: 1,
  seed: 0x50_4c_4152,
});
