import type { DataProvenance } from './DataProvenance';

export type BodyKind =
  | 'star'
  | 'planet'
  | 'dwarfPlanet'
  | 'moon'
  | 'comet'
  | 'asteroid'
  | 'blackHole';

export interface AtmosphereDefinition {
  readonly outerRadiusM: number;
  readonly surfacePressurePa?: number;
  readonly renderProfile: string;
}
export interface RingDefinition {
  readonly innerRadiusM: number;
  readonly outerRadiusM: number;
  readonly renderProfile: string;
}

export interface BodyDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly kind: BodyKind;
  readonly parentId?: string;
  readonly massKg: number;
  readonly meanRadiusM: number;
  readonly equatorialRadiusM?: number;
  readonly polarRadiusM?: number;
  readonly rotationPeriodSeconds: number;
  readonly retrogradeRotation?: boolean;
  readonly axialTiltRad?: number;
  readonly orientationModelId?: string;
  readonly atmosphere?: AtmosphereDefinition;
  readonly rings?: readonly RingDefinition[];
  readonly renderProfile: string;
  readonly provenance: readonly DataProvenance[];
}
