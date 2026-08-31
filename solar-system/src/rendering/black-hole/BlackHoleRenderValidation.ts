import type {
  BlackHoleBodyOutcome,
  BlackHoleRenderStage,
  BlackHoleRenderState,
  BlackHoleVectorTuple,
  BlackHoleVisualFrame,
} from './BlackHoleRenderTypes';

const STAGES: readonly BlackHoleRenderStage[] = Object.freeze([
  'idle',
  'approach',
  'closest-approach',
  'aftermath',
  'disruption',
  'accretion',
  'consumption',
  'remnant',
  'complete',
]);
const BODY_OUTCOMES: readonly BlackHoleBodyOutcome[] = Object.freeze([
  'intact',
  'tidally-stressed',
  'disrupted',
  'accretion-stream',
  'captured',
  'ejected',
]);
const MAX_RENDER_MAGNITUDE = 1e30;

export function validateBlackHoleRenderState(
  state: Readonly<BlackHoleRenderState>,
): void {
  if (!['physics-flyby', 'complete-consumption-cinematic'].includes(state.mode)) {
    throw new RangeError(`Unsupported black-hole render mode "${String(state.mode)}".`);
  }
  if (!['idle', 'running', 'paused', 'complete', 'error'].includes(state.lifecycleState)) {
    throw new RangeError(
      `Unsupported black-hole lifecycle "${String(state.lifecycleState)}".`,
    );
  }
  if (!STAGES.includes(state.stage)) {
    throw new RangeError(`Unsupported black-hole stage "${String(state.stage)}".`);
  }
  const physicsStages: readonly BlackHoleRenderStage[] = [
    'idle',
    'approach',
    'closest-approach',
    'aftermath',
    'complete',
  ];
  const cinematicStages: readonly BlackHoleRenderStage[] = [
    'idle',
    'approach',
    'disruption',
    'accretion',
    'consumption',
    'remnant',
    'complete',
  ];
  const allowedStages = state.mode === 'physics-flyby'
    ? physicsStages
    : cinematicStages;
  if (!allowedStages.includes(state.stage)) {
    throw new RangeError(
      `Black-hole stage "${state.stage}" does not belong to ${state.mode}.`,
    );
  }
  requireFiniteNonNegative(state.scenarioTimeSeconds, 'scenario time');
  requireUnitInterval(state.progress, 'progress');
  requireVector(state.scenarioOriginM, 'scenario origin');
  requireVector(state.scenarioOriginVelocityMps, 'scenario-origin velocity');
  if (state.runSignature.trim().length === 0) {
    throw new RangeError('Black-hole run signature cannot be empty.');
  }

  const source = state.blackHole;
  requirePositive(source.massKg, 'mass');
  requirePositive(source.massSolarMasses, 'solar mass');
  requirePositive(source.schwarzschildRadiusM, 'Schwarzschild radius');
  requirePositive(source.captureRadiusM, 'capture radius');
  if (source.captureRadiusM < source.schwarzschildRadiusM) {
    throw new RangeError(
      'Black-hole capture radius cannot be smaller than the Schwarzschild radius.',
    );
  }
  requireVector(source.positionLocalM, 'position');
  requireVector(source.velocityLocalMps, 'velocity');
  requireSignedUnitInterval(source.spinVisualization, 'spin visualization');

  const bodyIds = new Set<string>();
  for (const body of state.bodyStates) {
    if (body.bodyId.trim().length === 0) {
      throw new RangeError('Black-hole body ID cannot be empty.');
    }
    if (bodyIds.has(body.bodyId)) {
      throw new RangeError(`Duplicate black-hole body ID "${body.bodyId}".`);
    }
    bodyIds.add(body.bodyId);
    requirePositive(body.massKg, `mass for ${body.bodyId}`);
    requirePositive(body.radiusM, `radius for ${body.bodyId}`);
    requireVector(body.positionLocalM, `position for ${body.bodyId}`);
    requireVector(body.velocityLocalMps, `velocity for ${body.bodyId}`);
    if (!BODY_OUTCOMES.includes(body.outcome)) {
      throw new RangeError(
        `Unsupported black-hole body outcome "${String(body.outcome)}".`,
      );
    }
    requireFiniteNonNegative(body.tidalStress, `tidal stress for ${body.bodyId}`);
    requireUnitInterval(body.streamProgress, `stream progress for ${body.bodyId}`);
    requireUnitInterval(body.captureProgress, `capture progress for ${body.bodyId}`);
  }
}

export function validateBlackHoleVisualFrame(
  frame: Readonly<BlackHoleVisualFrame>,
): void {
  requireVector(frame.positionRenderUnits, 'render position');
  requireRenderableNonNegative(
    frame.eventHorizonRadiusRenderUnits,
    'event-horizon render radius',
  );
  requireRenderableNonNegative(
    frame.minimumVisualRadiusRenderUnits,
    'minimum visual radius',
  );
  requireSignedUnitInterval(frame.spinVisualization, 'spin visualization');
  for (const body of frame.bodies) {
    requireVector(body.positionRenderUnits, `render position for ${body.bodyId}`);
    requireRenderableNonNegative(body.radiusRenderUnits, `render radius for ${body.bodyId}`);
  }
}

export function isBlackHoleRenderActive(
  lifecycleState: BlackHoleRenderState['lifecycleState'],
): boolean {
  return lifecycleState === 'running' || lifecycleState === 'paused' || lifecycleState === 'complete';
}

export function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function requireVector(value: BlackHoleVectorTuple, label: string): void {
  if (
    value.length !== 3 ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    !Number.isFinite(value[2])
  ) {
    throw new RangeError(`Black-hole ${label} must be a finite xyz tuple.`);
  }
}

export function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Black-hole ${label} must be finite and non-negative.`);
  }
}

export function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Black-hole ${label} must be finite and positive.`);
  }
}

export function requireUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Black-hole ${label} must be in the interval [0, 1].`);
  }
}

export function requireSignedUnitInterval(value: number, label: string): void {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    throw new RangeError(`Black-hole ${label} must be in the interval [-1, 1].`);
  }
}

function requireRenderableNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > MAX_RENDER_MAGNITUDE) {
    throw new RangeError(
      `Black-hole ${label} exceeds the finite renderer-safe magnitude.`,
    );
  }
}
