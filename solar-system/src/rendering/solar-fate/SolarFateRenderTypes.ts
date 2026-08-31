export type SolarFateLifecycleState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'complete'
  | 'error';

export type SolarEvolutionPhase =
  | 'present'
  | 'brightening'
  | 'red-giant'
  | 'mass-loss'
  | 'planetary-nebula'
  | 'white-dwarf'
  | 'cooling';

export interface SolarEvolutionRenderState {
  readonly lifecycleState: SolarFateLifecycleState;
  readonly phase: SolarEvolutionPhase;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  readonly stellarRadiusM: number;
  readonly luminositySolar: number;
  readonly effectiveTemperatureK: number;
  readonly massSolar: number;
  readonly massLossOpacity: number;
  readonly nebulaRadiusM: number;
  readonly nebulaOpacity: number;
  readonly heatingByBody: Readonly<Record<string, number>>;
  readonly engulfmentByBody: Readonly<Record<string, number>>;
  readonly runSignature: string;
}

export type FictionalSupernovaPhase =
  | 'surface-pulse'
  | 'core-flash'
  | 'shock-breakout'
  | 'shock-shell'
  | 'radiation-front'
  | 'debris-nebula'
  | 'remnant';

export interface FictionalSupernovaRenderState {
  readonly lifecycleState: SolarFateLifecycleState;
  readonly phase: FictionalSupernovaPhase;
  readonly scenarioTimeSeconds: number;
  readonly progress: number;
  readonly pulseScale: number;
  readonly flashIntensity: number;
  readonly coreRadiusM: number;
  readonly shockRadiusM: number;
  readonly radiationFrontRadiusM: number;
  readonly debrisRadiusM: number;
  readonly debrisOpacity: number;
  readonly nebulaRadiusM: number;
  readonly nebulaOpacity: number;
  readonly remnantRadiusM: number;
  readonly remnantKind: 'compact-remnant' | 'neutron-star';
  readonly heatingByBody: Readonly<Record<string, number>>;
  readonly runSignature: string;
}

export interface SolarFateScaleContext {
  readonly metersPerRenderUnit: number;
  readonly baseSunRadiusRenderUnits: number;
}

export interface SolarEvolutionDiagnostics {
  readonly active: boolean;
  readonly phase: SolarEvolutionPhase;
  readonly runSignature: string;
  readonly stellarRadiusRenderUnits: number;
  readonly boundingRadiusRenderUnits: number;
  readonly particleCount: number;
  readonly heatedBodyCount: number;
  readonly baseSunHidden: boolean;
}

export interface FictionalSupernovaDiagnostics {
  readonly active: boolean;
  readonly phase: FictionalSupernovaPhase;
  readonly runSignature: string;
  readonly coreRadiusRenderUnits: number;
  readonly boundingRadiusRenderUnits: number;
  readonly debrisPointCount: number;
  readonly heatedBodyCount: number;
  readonly flashVisible: boolean;
  readonly effectiveFlashIntensity: number;
  readonly baseSunHidden: boolean;
}

export interface SolarFateDiagnostics {
  readonly mode: 'none' | 'scientific-solar-evolution' | 'fictional-supernova';
  readonly evolution: Readonly<SolarEvolutionDiagnostics>;
  readonly supernova: Readonly<FictionalSupernovaDiagnostics>;
}

export const EMPTY_SOLAR_EVOLUTION_DIAGNOSTICS: Readonly<SolarEvolutionDiagnostics> =
  Object.freeze({
    active: false,
    phase: 'present',
    runSignature: '',
    stellarRadiusRenderUnits: 0,
    boundingRadiusRenderUnits: 0,
    particleCount: 0,
    heatedBodyCount: 0,
    baseSunHidden: false,
  });

export const EMPTY_SUPERNOVA_DIAGNOSTICS: Readonly<FictionalSupernovaDiagnostics> =
  Object.freeze({
    active: false,
    phase: 'surface-pulse',
    runSignature: '',
    coreRadiusRenderUnits: 0,
    boundingRadiusRenderUnits: 0,
    debrisPointCount: 0,
    heatedBodyCount: 0,
    flashVisible: false,
    effectiveFlashIntensity: 0,
    baseSunHidden: false,
  });
