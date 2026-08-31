import {
  EARTH_SATELLITE_DEFINITIONS,
  sampleEarthSatellite,
} from '../../simulation/artificial';
import {
  SPACE_OBJECT_WORKER_FAILURE,
  SPACE_OBJECT_WORKER_RESULT,
  isSpaceObjectWorkerRequest,
  type SpaceObjectWorkerRequest,
  type SpaceObjectWorkerResponse,
} from './SpaceObjectWorkerProtocol';

/** Pure worker-side catalog sampling; no Three.js or DOM dependencies. */
export class SpaceObjectWorkerRuntime {
  public handle(message: unknown): SpaceObjectWorkerResponse {
    if (!isSpaceObjectWorkerRequest(message)) {
      return {
        type: SPACE_OBJECT_WORKER_FAILURE,
        requestId: typeof (message as { requestId?: unknown })?.requestId === 'string' ? (message as { requestId: string }).requestId : 'unknown',
        error: { name: 'TypeError', message: 'Invalid space-object worker request.' },
      };
    }
    try {
      return this.sample(message);
    } catch (error) {
      return {
        type: SPACE_OBJECT_WORKER_FAILURE,
        requestId: message.requestId,
        error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private sample(message: SpaceObjectWorkerRequest): SpaceObjectWorkerResponse {
    const earthIds = message.earthSatelliteIds === undefined ? null : new Set(message.earthSatelliteIds);
    const earthSatellites = EARTH_SATELLITE_DEFINITIONS
      .filter((item) => earthIds === null || earthIds.has(item.id))
      .map((item) => {
        const state = sampleEarthSatellite(item, message.jdTdb);
        return {
          id: item.id,
          positionM: [state.positionEarthCenteredM.x, state.positionEarthCenteredM.y, state.positionEarthCenteredM.z] as const,
          velocityMps: [state.velocityEarthCenteredMps.x, state.velocityEarthCenteredMps.y, state.velocityEarthCenteredMps.z] as const,
          dataAgeDays: state.dataAgeDays,
          dataAgeState: state.dataAgeState,
          propagationStatus: state.propagationStatus,
          propagationError: state.propagationError,
        };
      });
    return {
      type: SPACE_OBJECT_WORKER_RESULT,
      requestId: message.requestId,
      jdTdb: message.jdTdb,
      earthSatellites: Object.freeze(earthSatellites),
      // Avoid loading the 1.7 MB Horizons bundle twice. Deep-space Hermite
      // sampling is cheap on the main thread; this worker remains dedicated
      // to the heavier SGP4/SDP4 Earth-orbit propagation.
      spacecraft: Object.freeze([]),
    };
  }
}
