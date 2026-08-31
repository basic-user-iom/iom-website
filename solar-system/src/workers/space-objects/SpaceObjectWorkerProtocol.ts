import type { EarthSatelliteDataAgeState } from '../../simulation/artificial';
import type { EarthSatellitePropagationStatus } from '../../simulation/artificial';

export const SPACE_OBJECT_WORKER_SAMPLE = 'space-objects/sample' as const;
export const SPACE_OBJECT_WORKER_RESULT = 'space-objects/result' as const;
export const SPACE_OBJECT_WORKER_FAILURE = 'space-objects/failure' as const;

export interface SpaceObjectWorkerRequest {
  readonly type: typeof SPACE_OBJECT_WORKER_SAMPLE;
  readonly requestId: string;
  readonly jdTdb: number;
  readonly earthSatelliteIds?: readonly string[];
  readonly spacecraftIds?: readonly string[];
}

export interface SpaceObjectWorkerEarthSatelliteSample {
  readonly id: string;
  readonly positionM: readonly [number, number, number];
  readonly velocityMps: readonly [number, number, number];
  readonly dataAgeDays: number;
  readonly dataAgeState: EarthSatelliteDataAgeState;
  readonly propagationStatus: EarthSatellitePropagationStatus;
  readonly propagationError: string | null;
}

export interface SpaceObjectWorkerSpacecraftSample {
  readonly id: string;
  readonly valid: boolean;
  readonly positionM: readonly [number, number, number];
  readonly velocityMps: readonly [number, number, number];
}

export interface SpaceObjectWorkerResultResponse {
  readonly type: typeof SPACE_OBJECT_WORKER_RESULT;
  readonly requestId: string;
  readonly jdTdb: number;
  readonly earthSatellites: readonly SpaceObjectWorkerEarthSatelliteSample[];
  readonly spacecraft: readonly SpaceObjectWorkerSpacecraftSample[];
}

export interface SpaceObjectWorkerFailureResponse {
  readonly type: typeof SPACE_OBJECT_WORKER_FAILURE;
  readonly requestId: string;
  readonly error: { readonly name: string; readonly message: string };
}

export type SpaceObjectWorkerResponse = SpaceObjectWorkerResultResponse | SpaceObjectWorkerFailureResponse;

export function isSpaceObjectWorkerRequest(value: unknown): value is SpaceObjectWorkerRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SpaceObjectWorkerRequest>;
  return candidate.type === SPACE_OBJECT_WORKER_SAMPLE &&
    typeof candidate.requestId === 'string' && candidate.requestId.length > 0 &&
    Number.isFinite(candidate.jdTdb);
}

export function isSpaceObjectWorkerResponse(value: unknown): value is SpaceObjectWorkerResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SpaceObjectWorkerResponse>;
  return typeof candidate.requestId === 'string' &&
    (candidate.type === SPACE_OBJECT_WORKER_RESULT || candidate.type === SPACE_OBJECT_WORKER_FAILURE);
}
