import type {
  BlackHoleKernelAdvanceResult,
  BlackHoleKernelConfiguration,
} from '../../simulation/scenarios/black-hole/BlackHolePhysicsKernel';
import type {
  BlackHoleCapturedInitialState,
  ExternalBlackHoleInitialConditions,
} from '../../simulation/scenarios/black-hole/BlackHoleTypes';

export const BLACK_HOLE_WORKER_INITIALIZE = 'black-hole/initialize' as const;
export const BLACK_HOLE_WORKER_ADVANCE = 'black-hole/advance' as const;
export const BLACK_HOLE_WORKER_RESET = 'black-hole/reset' as const;
export const BLACK_HOLE_WORKER_RESULT = 'black-hole/result' as const;
export const BLACK_HOLE_WORKER_RESET_COMPLETE = 'black-hole/reset-complete' as const;
export const BLACK_HOLE_WORKER_FAILURE = 'black-hole/failure' as const;

interface BlackHoleWorkerRequestBase {
  readonly requestId: string;
  readonly runId: string;
}

export interface BlackHoleWorkerInitializeRequest
  extends BlackHoleWorkerRequestBase {
  readonly type: typeof BLACK_HOLE_WORKER_INITIALIZE;
  readonly initialState: BlackHoleCapturedInitialState;
  readonly blackHole: ExternalBlackHoleInitialConditions;
  readonly configuration: BlackHoleKernelConfiguration;
}

export interface BlackHoleWorkerAdvanceRequest extends BlackHoleWorkerRequestBase {
  readonly type: typeof BLACK_HOLE_WORKER_ADVANCE;
  readonly physicalTickSeconds: number;
  readonly tickCount: number;
}

export interface BlackHoleWorkerResetRequest extends BlackHoleWorkerRequestBase {
  readonly type: typeof BLACK_HOLE_WORKER_RESET;
}

export type BlackHoleWorkerRequest =
  | BlackHoleWorkerInitializeRequest
  | BlackHoleWorkerAdvanceRequest
  | BlackHoleWorkerResetRequest;

export interface BlackHoleWorkerResultResponse {
  readonly type: typeof BLACK_HOLE_WORKER_RESULT;
  readonly requestId: string;
  readonly runId: string;
  readonly result: BlackHoleKernelAdvanceResult;
}

export interface BlackHoleWorkerResetResponse {
  readonly type: typeof BLACK_HOLE_WORKER_RESET_COMPLETE;
  readonly requestId: string;
  readonly runId: string;
}

export interface BlackHoleWorkerFailureResponse {
  readonly type: typeof BLACK_HOLE_WORKER_FAILURE;
  readonly requestId: string;
  readonly runId: string;
  readonly error: {
    readonly name: string;
    readonly message: string;
  };
}

export type BlackHoleWorkerResponse =
  | BlackHoleWorkerResultResponse
  | BlackHoleWorkerResetResponse
  | BlackHoleWorkerFailureResponse;

export function isBlackHoleWorkerRequest(
  message: unknown,
): message is BlackHoleWorkerRequest {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Partial<BlackHoleWorkerRequest>;
  if (
    typeof candidate.requestId !== 'string' || candidate.requestId.length === 0 ||
    typeof candidate.runId !== 'string' || candidate.runId.length === 0
  ) {
    return false;
  }
  if (candidate.type === BLACK_HOLE_WORKER_RESET) return true;
  if (candidate.type === BLACK_HOLE_WORKER_ADVANCE) {
    return Number.isFinite(candidate.physicalTickSeconds) &&
      (candidate.physicalTickSeconds ?? 0) > 0 &&
      Number.isSafeInteger(candidate.tickCount) && (candidate.tickCount ?? 0) > 0;
  }
  if (candidate.type !== BLACK_HOLE_WORKER_INITIALIZE) return false;
  const initial = candidate.initialState;
  return initial !== undefined &&
    Array.isArray(initial.bodyIds) &&
    initial.positionsM instanceof Float64Array &&
    initial.velocitiesMps instanceof Float64Array &&
    initial.massesKg instanceof Float64Array &&
    initial.radiiM instanceof Float64Array &&
    typeof candidate.blackHole === 'object' && candidate.blackHole !== null &&
    typeof candidate.configuration === 'object' && candidate.configuration !== null;
}

export function blackHoleInitializeTransferables(
  request: BlackHoleWorkerInitializeRequest,
): readonly ArrayBuffer[] {
  return uniqueArrayBuffers([
    request.initialState.positionsM,
    request.initialState.velocitiesMps,
    request.initialState.massesKg,
    request.initialState.radiiM,
  ]);
}

export function blackHoleResponseTransferables(
  response: BlackHoleWorkerResponse,
): readonly ArrayBuffer[] {
  if (response.type !== BLACK_HOLE_WORKER_RESULT) return [];
  const state = response.result.state;
  return uniqueArrayBuffers([
    state.positionsM,
    state.velocitiesMps,
    state.massesKg,
    state.radiiM,
    state.outcomeCodes,
    state.originM,
    state.originVelocityMps,
  ]);
}

function uniqueArrayBuffers(
  views: readonly ArrayBufferView[],
): readonly ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  for (const view of views) {
    if (view.buffer instanceof ArrayBuffer) buffers.add(view.buffer);
  }
  return [...buffers];
}
