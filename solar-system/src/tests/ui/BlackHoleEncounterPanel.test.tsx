// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  BLACK_HOLE_CINEMATIC_PHOTOSENSITIVITY_WARNING,
  BLACK_HOLE_EQUAL_MASS_NOTE,
  BLACK_HOLE_PHYSICS_CAVEAT,
  BlackHoleEncounterPanel,
  COMPLETE_CONSUMPTION_CINEMATIC_WARNING,
  type BlackHoleEncounterPanelProps,
  type BlackHoleFlybyPanelParameters,
  type BlackHolePhysicsFlybyPanelState,
  type CompleteConsumptionPanelState,
} from '../../ui/observatory/BlackHoleEncounterPanel';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const AU_M = 149_597_870_700;

const PARAMETERS = Object.freeze({
  massSolarMasses: 10,
  initialPositionM: Object.freeze([120 * AU_M, -4 * AU_M, 2 * AU_M] as const),
  initialVelocityMps: Object.freeze([-52_000, 1_500, -250] as const),
  closestApproachTargetM: Object.freeze([0, 0.25 * AU_M, 0] as const),
  closestApproachTimeSeconds: 3_155_760,
  spinVisualization: -0.65,
  accretionDiskEnabled: true,
  captureRadiusMultiple: 3,
  accuracy: 'high',
  seed: 4_242,
}) satisfies Readonly<BlackHoleFlybyPanelParameters>;

const DIAGNOSTICS = Object.freeze({
  kineticEnergyJ: 5.2e42,
  potentialEnergyJ: -5.1e42,
  totalEnergyJ: 1e41,
  linearMomentumMagnitudeKgMps: 8.5e35,
  angularMomentumMagnitudeKgM2ps: 7.4e51,
  relativeEnergyDrift: 2.4e-8,
  relativeLinearMomentumDrift: 1.1e-12,
  relativeAngularMomentumDrift: 4.2e-10,
  minimumPairDistanceM: 4.3e10,
  chosenSubstepSeconds: 120,
  completedSubsteps: 12_500,
  finite: true,
});

const PHYSICS_RUNNING = Object.freeze({
  mode: 'physics-flyby',
  state: 'running',
  stage: 'closest-approach',
  scenarioTimeSeconds: 18,
  totalDurationSeconds: 60,
  progress: 0.3,
  diagnostics: DIAGNOSTICS,
  bodyStates: Object.freeze([
    Object.freeze({
      bodyId: 'earth',
      outcome: 'intact',
      tidalStress: 0.2,
      streamProgress: 0,
      captureProgress: 0,
    }),
    Object.freeze({
      bodyId: 'neptune',
      outcome: 'ejected',
      tidalStress: 0.05,
      streamProgress: 0,
      captureProgress: 0,
    }),
  ]),
  captureCount: 0,
  ejectionCount: 1,
  survivorCount: 8,
  allBodiesCaptured: false,
}) satisfies Readonly<BlackHolePhysicsFlybyPanelState>;

const CINEMATIC_RUNNING = Object.freeze({
  mode: 'complete-consumption-cinematic',
  state: 'running',
  stage: 'accretion',
  scenarioTimeSeconds: 24,
  totalDurationSeconds: 72,
  progress: 1 / 3,
  diagnostics: DIAGNOSTICS,
  bodyStates: Object.freeze([
    Object.freeze({
      bodyId: 'sun',
      outcome: 'captured',
      tidalStress: 1,
      streamProgress: 1,
      captureProgress: 1,
    }),
    Object.freeze({
      bodyId: 'earth',
      outcome: 'accretion-stream',
      tidalStress: 0.75,
      streamProgress: 0.6,
      captureProgress: 0.4,
    }),
  ]),
  captureCount: 1,
  ejectionCount: 0,
  survivorCount: 1,
  allBodiesCaptured: false,
}) satisfies Readonly<CompleteConsumptionPanelState>;

describe('Phase 10 BlackHoleEncounterPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('separates educational Physics Flyby from guaranteed cinematic consumption', () => {
    renderPanel();

    const panel = requiredElement('[data-testid="black-hole-encounter-panel"]');
    expect(panel.getAttribute('data-black-hole-mode')).toBe('idle');
    expect(requiredElement('[data-testid="black-hole-mode-distinction"]').textContent)
      .toMatch(/mutually exclusive.*educational physics flyby.*nonphysical cinematic.*guarantees/i);

    const physics = requiredElement('[data-testid="black-hole-physics-option"]');
    expect(physics.getAttribute('data-classification')).toBe('educational-approximation');
    expect(labelledText(physics)).toBe('Physics Flyby');
    expect(physics.textContent).toContain(BLACK_HOLE_PHYSICS_CAVEAT);
    expect(physics.textContent).toContain(BLACK_HOLE_EQUAL_MASS_NOTE);
    expect(physics.textContent).toMatch(/survival, ejection, and capture.*never guaranteed/i);
    expect(physics.textContent).not.toContain(COMPLETE_CONSUMPTION_CINEMATIC_WARNING);

    const cinematic = requiredElement('[data-testid="black-hole-cinematic-option"]');
    expect(cinematic.getAttribute('data-classification')).toBe('cinematic');
    expect(labelledText(cinematic)).toBe('Complete Consumption — Cinematic');
    expect(cinematic.textContent).toContain(COMPLETE_CONSUMPTION_CINEMATIC_WARNING);
    expect(cinematic.textContent).toMatch(/damping.*artistic/i);

    for (const testId of [
      'black-hole-mass',
      'black-hole-position-x',
      'black-hole-position-y',
      'black-hole-position-z',
      'black-hole-velocity-x',
      'black-hole-velocity-y',
      'black-hole-velocity-z',
      'black-hole-target-x',
      'black-hole-target-y',
      'black-hole-target-z',
      'black-hole-closest-time',
      'black-hole-spin',
      'black-hole-accretion-disk',
      'black-hole-capture-radius-multiple',
      'black-hole-accuracy',
      'black-hole-seed',
    ]) {
      expect(requiredElement(`[data-testid="${testId}"]`)).toBeTruthy();
    }

    const spin = requiredElement<HTMLInputElement>('[data-testid="black-hole-spin"]');
    expect(spin.valueAsNumber).toBe(-0.65);
    expect(spin.min).toBe('-1');
    expect(spin.max).toBe('1');
    const captureMultiple = requiredElement<HTMLInputElement>(
      '[data-testid="black-hole-capture-radius-multiple"]',
    );
    expect(captureMultiple.min).toBe('1');
    expect(captureMultiple.max).toBe('10000');

    const schwarzschildRadius = numericDataValue('black-hole-schwarzschild-radius');
    const captureRadius = numericDataValue('black-hole-capture-radius');
    expect(schwarzschildRadius).toBeGreaterThan(0);
    expect(captureRadius).toBeCloseTo(schwarzschildRadius * 3, 8);
    expect(requiredElement('[data-testid="black-hole-capture-radius-note"]').textContent)
      .toMatch(/2GM\/c².*scenario removal threshold.*not.*orbital-GR/i);
  });

  it('validates and reports signed spin, capture boundary, vectors, accuracy, and seed changes', () => {
    const actions = actionSpies();
    renderPanel(actions);

    changeInput(requiredElement('[data-testid="black-hole-spin"]'), '-0.4');
    expect(actions.onParametersChange).toHaveBeenLastCalledWith({
      ...PARAMETERS,
      spinVisualization: -0.4,
    });

    changeInput(requiredElement('[data-testid="black-hole-capture-radius-multiple"]'), '8');
    expect(actions.onParametersChange).toHaveBeenLastCalledWith({
      ...PARAMETERS,
      captureRadiusMultiple: 8,
    });

    changeInput(requiredElement('[data-testid="black-hole-position-x"]'), '150');
    const positionUpdate = actions.onParametersChange.mock.calls.at(-1)?.[0];
    expect(positionUpdate?.initialPositionM[0]).toBeCloseTo(150 * AU_M, 3);
    expect(positionUpdate?.initialPositionM.slice(1)).toEqual(PARAMETERS.initialPositionM.slice(1));
    expect(positionUpdate?.initialVelocityMps).not.toEqual(PARAMETERS.initialVelocityMps);

    changeInput(requiredElement('[data-testid="black-hole-velocity-y"]'), '-32.5');
    const velocityUpdate = actions.onParametersChange.mock.calls.at(-1)?.[0];
    expect(velocityUpdate?.initialVelocityMps[1]).toBe(-32_500);
    expect(velocityUpdate?.closestApproachTargetM[1]).toBe(
      PARAMETERS.initialPositionM[1] - 32_500 * PARAMETERS.closestApproachTimeSeconds,
    );

    changeSelect(requiredElement('[data-testid="black-hole-accuracy"]'), 'ultra');
    expect(actions.onParametersChange).toHaveBeenLastCalledWith({
      ...PARAMETERS,
      accuracy: 'ultra',
    });

    renderPanel({ ...actions, parameters: { ...PARAMETERS, captureRadiusMultiple: 10_001 } });
    expect(requiredElement('[data-testid="black-hole-parameter-error"]')).toBeTruthy();
    expect(requiredElement<HTMLButtonElement>('[data-testid="black-hole-physics-start"]').disabled)
      .toBe(true);
  });

  it('requires an accessible confirmation before starting Physics Flyby', () => {
    const actions = actionSpies();
    renderPanel(actions);

    click('[data-testid="black-hole-physics-start"]');
    expect(actions.onStartPhysicsFlyby).not.toHaveBeenCalled();
    const dialog = requiredElement<HTMLElement>(
      '[data-testid="black-hole-physics-confirmation"]',
    );
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(describedText(dialog)).toMatch(/destructive scenario.*Reset restores.*ephemeris/i);
    expect(dialog.textContent).toContain(BLACK_HOLE_PHYSICS_CAVEAT);
    expect(dialog.textContent).toContain(BLACK_HOLE_EQUAL_MASS_NOTE);
    expect(document.activeElement).toBe(
      requiredElement('[data-testid="black-hole-physics-confirm-cancel"]'),
    );

    pressDocumentKey('Escape');
    expect(document.querySelector('[data-testid="black-hole-physics-confirmation"]')).toBeNull();
    expect(document.activeElement).toBe(
      requiredElement('[data-testid="black-hole-encounter-panel"] h2'),
    );
    expect(actions.onStartPhysicsFlyby).not.toHaveBeenCalled();

    click('[data-testid="black-hole-physics-start"]');
    click('[data-testid="black-hole-physics-confirm"]');
    expect(actions.onStartPhysicsFlyby).toHaveBeenCalledOnce();
    expect(actions.onStartPhysicsFlyby).toHaveBeenCalledWith(PARAMETERS);
  });

  it('requires photosensitivity confirmation and keeps cinematic flash preference accessible', () => {
    const actions = actionSpies();
    renderPanel({ ...actions, reduceFlashes: true });

    click('[data-testid="black-hole-cinematic-start"]');
    const dialog = requiredElement<HTMLElement>(
      '[data-testid="black-hole-cinematic-confirmation"]',
    );
    expect(describedText(dialog)).toBe(BLACK_HOLE_CINEMATIC_PHOTOSENSITIVITY_WARNING);
    expect(requiredElement('[data-testid="black-hole-cinematic-confirmation-warning"]').textContent)
      .toBe(COMPLETE_CONSUMPTION_CINEMATIC_WARNING);
    expect(document.activeElement).toBe(
      requiredElement('[data-testid="black-hole-cinematic-confirm-cancel"]'),
    );

    const reduceFlashes = requiredElement<HTMLInputElement>(
      '[data-testid="black-hole-cinematic-confirm-reduce-flashes"]',
    );
    expect(reduceFlashes.checked).toBe(true);
    changeCheckbox(reduceFlashes, false);
    expect(actions.onReduceFlashesChange).toHaveBeenCalledWith(false);

    const confirm = requiredElement<HTMLButtonElement>(
      '[data-testid="black-hole-cinematic-confirm"]',
    );
    act(() => confirm.focus());
    pressDocumentKey('Tab');
    expect(document.activeElement).toBe(
      dialog.querySelector(
        'button[aria-label="Cancel: Confirm Complete Consumption — Cinematic"]',
      ),
    );

    click('[data-testid="black-hole-cinematic-confirm"]');
    expect(actions.onStartCompleteConsumption).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-testid="black-hole-cinematic-confirmation"]')).toBeNull();
  });

  it('shows finite Physics Flyby diagnostics, open outcomes, and deterministic transport', () => {
    const actions = actionSpies();
    renderPanel({ ...actions, activeScenario: PHYSICS_RUNNING });

    const active = requiredElement('[data-testid="black-hole-physics-active"]');
    expect(active.textContent).toContain(BLACK_HOLE_PHYSICS_CAVEAT);
    expect(active.textContent).toContain(BLACK_HOLE_EQUAL_MASS_NOTE);
    expect(active.textContent).not.toContain(COMPLETE_CONSUMPTION_CINEMATIC_WARNING);
    expect(requiredElement('[data-testid="black-hole-encounter-panel"]')
      .getAttribute('data-black-hole-mode')).toBe('physics-flyby');
    expect(requiredElement('[data-testid="black-hole-physics-diagnostics"]')
      .getAttribute('data-finite')).toBe('true');

    for (const testId of [
      'black-hole-kinetic-energy',
      'black-hole-potential-energy',
      'black-hole-total-energy',
      'black-hole-energy-drift',
      'black-hole-linear-momentum',
      'black-hole-linear-momentum-drift',
      'black-hole-angular-momentum',
      'black-hole-angular-momentum-drift',
      'black-hole-minimum-distance',
      'black-hole-chosen-substep',
      'black-hole-completed-substeps',
      'black-hole-physics-survivors',
      'black-hole-physics-ejected',
      'black-hole-physics-captured',
    ]) {
      expect(Number.isFinite(numericDataValue(testId)), `${testId} should be finite`).toBe(true);
    }
    expect(requiredElement('[data-testid="black-hole-physics-outcome-note"]').textContent)
      .toMatch(/may leave survivors, eject bodies, or capture bodies.*No particular result.*promised/i);

    click('[data-testid="black-hole-physics-pause"]');
    click('[data-testid="black-hole-physics-skip"]');
    click('[data-testid="black-hole-physics-replay"]');
    click('[data-testid="black-hole-physics-reset"]');
    expect(actions.onPause).toHaveBeenCalledOnce();
    expect(actions.onSkip).toHaveBeenCalledOnce();
    expect(actions.onReplay).toHaveBeenCalledOnce();
    expect(actions.onReset).toHaveBeenCalledOnce();

    renderPanel({ ...actions, activeScenario: { ...PHYSICS_RUNNING, state: 'paused' } });
    click('[data-testid="black-hole-physics-resume"]');
    click('[data-testid="black-hole-physics-step"]');
    expect(actions.onResume).toHaveBeenCalledOnce();
    expect(actions.onFrameStep).toHaveBeenCalledOnce();
  });

  it('keeps the exact cinematic warning, artistic caveat, and per-body progress until completion', () => {
    const actions = actionSpies();
    renderPanel({
      ...actions,
      activeScenario: CINEMATIC_RUNNING,
      reduceFlashes: true,
    });

    expect(requiredElement('[data-testid="black-hole-cinematic-active-warning"]').textContent)
      .toBe(COMPLETE_CONSUMPTION_CINEMATIC_WARNING);
    expect(requiredElement('[data-testid="black-hole-cinematic-artistic-caveat"]').textContent)
      .toMatch(/damping.*order.*timing.*artistic.*compressed/i);
    expect(requiredElement<HTMLInputElement>(
      '[data-testid="black-hole-cinematic-active-reduce-flashes"]',
    ).checked).toBe(true);

    const sun = requiredElement('[data-testid="black-hole-body-state-sun"]');
    expect(sun.getAttribute('data-outcome')).toBe('captured');
    expect(sun.getAttribute('data-capture-progress')).toBe('1.000000');
    const earth = requiredElement('[data-testid="black-hole-body-state-earth"]');
    expect(earth.getAttribute('data-outcome')).toBe('accretion-stream');
    expect(earth.textContent).toMatch(/capture 40%.*stream 60%.*tidal stress 75%/i);

    renderPanel({
      ...actions,
      activeScenario: {
        ...CINEMATIC_RUNNING,
        state: 'complete',
        stage: 'complete',
        progress: 1,
        bodyStates: CINEMATIC_RUNNING.bodyStates.map((bodyState) => ({
          ...bodyState,
          outcome: 'captured' as const,
          streamProgress: 1,
          captureProgress: 1,
        })),
        captureCount: CINEMATIC_RUNNING.bodyStates.length,
        survivorCount: 0,
        allBodiesCaptured: true,
      },
    });
    expect(requiredElement('[data-testid="black-hole-cinematic-active-warning"]').textContent)
      .toBe(COMPLETE_CONSUMPTION_CINEMATIC_WARNING);
    expect(requiredElement('[data-testid="black-hole-all-bodies-captured"]').textContent)
      .toMatch(/Every staged body is captured.*complete/i);
    expect(document.querySelector('[data-testid="black-hole-cinematic-skip"]')).toBeNull();
    expect(document.querySelector('[data-testid="black-hole-cinematic-pause"]')).toBeNull();
    click('[data-testid="black-hole-cinematic-replay"]');
    click('[data-testid="black-hole-cinematic-reset"]');
    expect(actions.onReplay).toHaveBeenCalledOnce();
    expect(actions.onReset).toHaveBeenCalledOnce();
  });

  function renderPanel(overrides: Partial<BlackHoleEncounterPanelProps> = {}) {
    const props: BlackHoleEncounterPanelProps = {
      parameters: PARAMETERS,
      activeScenario: null,
      disabled: false,
      reduceFlashes: true,
      onParametersChange: () => undefined,
      onReduceFlashesChange: () => undefined,
      onStartPhysicsFlyby: () => undefined,
      onStartCompleteConsumption: () => undefined,
      onClose: () => undefined,
      onPause: () => undefined,
      onResume: () => undefined,
      onFrameStep: () => undefined,
      onSkip: () => undefined,
      onReplay: () => undefined,
      onReset: () => undefined,
      ...overrides,
    };
    act(() => root.render(<BlackHoleEncounterPanel {...props} />));
  }
});

function actionSpies() {
  return {
    onParametersChange: vi.fn<(parameters: Readonly<BlackHoleFlybyPanelParameters>) => void>(),
    onReduceFlashesChange: vi.fn<(reduceFlashes: boolean) => void>(),
    onStartPhysicsFlyby: vi.fn<(parameters: Readonly<BlackHoleFlybyPanelParameters>) => void>(),
    onStartCompleteConsumption: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
    onPause: vi.fn<() => void>(),
    onResume: vi.fn<() => void>(),
    onFrameStep: vi.fn<() => void>(),
    onSkip: vi.fn<() => void>(),
    onReplay: vi.fn<() => void>(),
    onReset: vi.fn<() => void>(),
  };
}

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Expected element matching ${selector}.`);
  return element;
}

function labelledText(element: Element): string {
  const id = element.getAttribute('aria-labelledby');
  if (id === null) throw new Error('Expected aria-labelledby.');
  return document.getElementById(id)?.textContent?.trim() ?? '';
}

function describedText(element: Element): string {
  const id = element.getAttribute('aria-describedby');
  if (id === null) throw new Error('Expected aria-describedby.');
  return document.getElementById(id)?.textContent?.trim() ?? '';
}

function numericDataValue(testId: string): number {
  const raw = requiredElement(`[data-testid="${testId}"]`).getAttribute('data-value');
  if (raw === null) throw new Error(`Expected finite data-value for ${testId}.`);
  return Number(raw);
}

function click(selector: string): void {
  act(() => requiredElement<HTMLButtonElement>(selector).click());
}

function changeInput(input: HTMLInputElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function changeCheckbox(input: HTMLInputElement, checked: boolean): void {
  act(() => {
    if (input.checked !== checked) input.click();
  });
}

function pressDocumentKey(key: string, shiftKey = false): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }));
  });
}
