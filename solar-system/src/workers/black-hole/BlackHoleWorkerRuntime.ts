import {
  advanceBlackHoleKernel,
  cloneBlackHoleKernelState,
  computeBlackHoleDiagnostics,
  initializeBlackHoleKernel,
  type BlackHoleKernelConfiguration,
  type BlackHoleKernelState,
} from '../../simulation/scenarios/black-hole/BlackHolePhysicsKernel';
import {
  BLACK_HOLE_WORKER_ADVANCE,
  BLACK_HOLE_WORKER_FAILURE,
  BLACK_HOLE_WORKER_INITIALIZE,
  BLACK_HOLE_WORKER_RESET_COMPLETE,
  BLACK_HOLE_WORKER_RESULT,
  isBlackHoleWorkerRequest,
  type BlackHoleWorkerResponse,
} from './BlackHoleWorkerProtocol';

interface WorkerRun {
  readonly configuration: BlackHoleKernelConfiguration;
  state: BlackHoleKernelState;
}

/** Stateful but deterministic pure handler used by both the module worker and tests. */
export class BlackHoleWorkerRuntime {
  readonly #runs = new Map<string, WorkerRun>();

  public handle(message: unknown): BlackHoleWorkerResponse {
    if (!isBlackHoleWorkerRequest(message)) {
      return failure(message, new TypeError('Invalid black-hole physics worker request.'));
    }
    try {
      if (message.type === BLACK_HOLE_WORKER_INITIALIZE) {
        if (this.#runs.has(message.runId)) {
          throw new Error(`Black-hole worker run "${message.runId}" already exists.`);
        }
        const initialized = initializeBlackHoleKernel(
          message.initialState,
          message.blackHole,
        );
        this.#runs.set(message.runId, {
          configuration: message.configuration,
          state: initialized.state,
        });
        return {
          type: BLACK_HOLE_WORKER_RESULT,
          requestId: message.requestId,
          runId: message.runId,
          result: cloneResult(initialized),
        };
      }
      if (message.type === BLACK_HOLE_WORKER_ADVANCE) {
        const run = this.#runs.get(message.runId);
        if (run === undefined) {
          throw new Error(`Black-hole worker run "${message.runId}" is not initialized.`);
        }
        let advanced = {
          state: run.state,
          diagnostics: computeBlackHoleDiagnostics(run.state),
        };
        for (let tick = 0; tick < message.tickCount; tick += 1) {
          advanced = advanceBlackHoleKernel(
            advanced.state,
            run.configuration,
            message.physicalTickSeconds,
          );
        }
        run.state = advanced.state;
        return {
          type: BLACK_HOLE_WORKER_RESULT,
          requestId: message.requestId,
          runId: message.runId,
          result: cloneResult(advanced),
        };
      }
      this.#runs.delete(message.runId);
      return {
        type: BLACK_HOLE_WORKER_RESET_COMPLETE,
        requestId: message.requestId,
        runId: message.runId,
      };
    } catch (error) {
      return failure(message, error);
    }
  }
}

function cloneResult(result: {
  readonly state: BlackHoleKernelState;
}): {
  readonly state: BlackHoleKernelState;
  readonly diagnostics: ReturnType<typeof computeBlackHoleDiagnostics>;
} {
  const state = cloneBlackHoleKernelState(result.state);
  return { state, diagnostics: computeBlackHoleDiagnostics(state) };
}

function failure(message: unknown, error: unknown): BlackHoleWorkerResponse {
  const envelope = readEnvelope(message);
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    type: BLACK_HOLE_WORKER_FAILURE,
    requestId: envelope.requestId,
    runId: envelope.runId,
    error: { name: normalized.name, message: normalized.message },
  };
}

function readEnvelope(message: unknown): { requestId: string; runId: string } {
  if (typeof message !== 'object' || message === null) {
    return { requestId: 'invalid-request', runId: 'invalid-run' };
  }
  const candidate = message as { readonly requestId?: unknown; readonly runId?: unknown };
  return {
    requestId: typeof candidate.requestId === 'string' && candidate.requestId.length > 0
      ? candidate.requestId
      : 'invalid-request',
    runId: typeof candidate.runId === 'string' && candidate.runId.length > 0
      ? candidate.runId
      : 'invalid-run',
  };
}
