// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type {
  ImpactParameters,
  ImpactPhysicalSummary,
  ImpactStage,
  ImpactScenarioSnapshot,
  ImpactVisualProfile,
} from '../../simulation/scenarios/impact/ImpactTypes';
import type { ScenarioPlaybackState } from '../../simulation/scenarios/ScenarioModule';
import { ImpactLabPanel, type ImpactLabPanelProps } from '../../ui/observatory/ImpactLabPanel';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const PARAMETERS = Object.freeze({
  targetBodyId: 'earth',
  diameterM: 100,
  densityKgM3: 3_000,
  entrySpeedKmps: 20,
  entryAngleDeg: 45,
  entryAzimuthDeg: 90,
  impactLatitudeDeg: 12.5,
  impactLongitudeDeg: -31.25,
  material: 'stone',
  fragmentationEnabled: true,
  atmosphereEnabled: true,
  cameraMode: 'orbital',
  seed: 42,
}) as Readonly<ImpactParameters>;

const SUMMARY = Object.freeze({
  targetBodyId: 'earth',
  targetClass: 'dense-atmosphere-rocky',
  outcomeKind: 'solid-surface-impact',
  targetRadiusM: 6_378_137,
  diameterM: 100,
  densityKgM3: 3_000,
  entryAngleRad: Math.PI / 4,
  radiusM: 50,
  crossSectionAreaM2: Math.PI * 50 * 50,
  massKg: 1_570_796_326.7949,
  entrySpeedMps: 20_000,
  kineticEnergyJ: 3.14159265358979e17,
  tntMegatons: 75.0858664815916,
  reachedSurface: true,
  impactMassKg: 1_400_000_000,
  impactSpeedMps: 18_000,
  impactEnergyJ: 2.268e17,
  atmosphericEnergyLossJ: 8.7359265358979e16,
}) satisfies Readonly<ImpactPhysicalSummary>;

const VISUAL_PROFILE = Object.freeze({
  flashIntensity: 4.5,
  flashRadiusM: 3_600,
  flashDurationSeconds: 1.5,
  flashDecaySeconds: 0.38,
  craterRadiusM: 1_800,
  craterDepthM: 360,
  craterFormationSeconds: 1.2,
  scorchRadiusM: 3_600,
  ejectaRadiusM: 7_200,
  ejectaLaunchSpeedMps: 1_100,
  ejectaLifetimeSeconds: 18,
  plumeHeightM: 24_000,
  plumeRadiusM: 5_400,
  plumeRiseSeconds: 5,
  plumeLifetimeSeconds: 30,
  shockwaveVisualSpeedMps: 1_200,
  groundShockwaveSpeedMps: 1_200,
  groundShockwaveLifetimeSeconds: 12,
  atmosphericShockwaveSpeedMps: 340,
  atmosphericShockwaveLifetimeSeconds: 18,
  cloudScarRadiusM: 0,
  cloudScarGrowthSeconds: 0,
  cloudScarLifetimeSeconds: 0,
  cloudScarAdvectionRateRadPerSecond: 0,
  dustLifetimeSeconds: 30,
  approximationNotes: Object.freeze([
    'Crater radius is a simplified energy scaling.',
    'Plume scale is exaggerated for visibility.',
  ]),
}) as Readonly<ImpactVisualProfile>;

const IDLE_SNAPSHOT = Object.freeze({
  state: 'idle',
  stage: 'idle',
  scenarioTimeSeconds: 0,
  totalDurationSeconds: 30,
  progress: 0,
  playbackRate: 1,
  parameters: null,
  physicalSummary: null,
  visualProfile: null,
  impactFrame: null,
  impactorPosition: null,
  impactorVelocity: null,
  normalizedHeating: 0,
  normalizedDynamicPressure: 0,
  remainingMassFraction: 1,
  eventElapsedSeconds: null,
  craterFormationProgress: 0,
  surfaceScorchOpacity: 0,
  trailPositions: Object.freeze([]),
  fragmentPositions: Object.freeze([]),
  flashIntensity: 0,
  ejectaRadiusM: 0,
  ejectaHeightM: 0,
  ejectaOpacity: 0,
  shockwaveRadiusM: 0,
  groundShockwaveAngularRadiusRad: 0,
  groundShockwaveOpacity: 0,
  atmosphericShockwaveAngularRadiusRad: 0,
  atmosphericShockwaveOpacity: 0,
  plumeHeightM: 0,
  plumeRadiusM: 0,
  plumeOpacity: 0,
  plumeCoolingProgress: 0,
  hazeOpacity: 0,
  cloudScarGrowthProgress: 0,
  cloudScarOpacity: 0,
  cloudScarAdvectionRad: 0,
  runSignature: null,
  fragmentCount: 0,
}) satisfies Readonly<ImpactScenarioSnapshot>;

describe('Phase 8 ImpactLabPanel', () => {
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

  it('labels every parameter and reports raw physical values separately from visual estimates', () => {
    renderPanel();

    expect(requiredElement('[data-testid="impact-lab-panel"]').getAttribute('aria-labelledby'))
      .toBeTruthy();
    expect(requiredElement('[data-testid="impact-educational-badge"]').textContent)
      .toMatch(/Educational approximation/i);

    for (const [testId, label, min, max] of [
      ['impact-diameter', 'Impactor diameter', '1', '5000'],
      ['impact-density', 'Bulk density', '300', '9000'],
      ['impact-speed', 'Entry speed', '5', '72'],
      ['impact-angle', 'Entry angle', '5', '90'],
      ['impact-azimuth', 'Entry azimuth', '0', '360'],
      ['impact-latitude', 'Impact latitude', '-90', '90'],
      ['impact-longitude', 'Impact longitude', '-180', '180'],
      ['impact-seed', 'Deterministic seed', '0', '4294967295'],
    ] as const) {
      const input = requiredElement<HTMLInputElement>(`[data-testid="${testId}"]`);
      expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toContain(label);
      expect(input.min).toBe(min);
      expect(input.max).toBe(max);
      expect(input.getAttribute('aria-describedby')).toBeTruthy();
      expect(input.getAttribute('aria-invalid')).toBe('false');
    }

    expect(requiredElement('[data-testid="impact-mass"]').getAttribute('data-value'))
      .toBe(String(SUMMARY.massKg));
    expect(requiredElement('[data-testid="impact-energy"]').getAttribute('data-value'))
      .toBe(String(SUMMARY.kineticEnergyJ));
    expect(requiredElement('[data-testid="impact-tnt"]').getAttribute('data-value'))
      .toBe(String(SUMMARY.tntMegatons));
    expect(requiredElement('[data-testid="impact-visual-caveat"]').textContent)
      .toMatch(/educational approximations.*exaggerated for visibility/i);
    expect(requiredElement('[data-testid="impact-approximation-notes"]').textContent)
      .toContain('Crater radius is a simplified energy scaling.');
  });

  it('emits controlled parameter and event-camera updates without running a scenario', () => {
    const onParametersChange = vi.fn();
    const onCameraModeChange = vi.fn();
    renderPanel({ onParametersChange, onCameraModeChange });

    changeInput(requiredElement('[data-testid="impact-diameter"]'), '200');
    expect(onParametersChange).toHaveBeenCalledWith({ ...PARAMETERS, diameterM: 200 });

    changeInput(requiredElement('[data-testid="impact-azimuth"]'), '225');
    expect(onParametersChange).toHaveBeenCalledWith({ ...PARAMETERS, entryAzimuthDeg: 225 });

    changeSelect(requiredElement('[data-testid="impact-material"]'), 'iron');
    expect(onParametersChange).toHaveBeenCalledWith({ ...PARAMETERS, material: 'iron' });

    changeCheckbox(requiredElement('[data-testid="impact-fragmentation"]'), false);
    expect(onParametersChange).toHaveBeenCalledWith({
      ...PARAMETERS,
      fragmentationEnabled: false,
    });

    changeSelect(requiredElement('[data-testid="impact-camera-preset"]'), 'chase');
    expect(onParametersChange).toHaveBeenCalledWith({ ...PARAMETERS, cameraMode: 'chase' });
    expect(onCameraModeChange).toHaveBeenCalledWith('chase');
  });

  it('selects target profiles and disables atmospheric effects for airless bodies', () => {
    const onParametersChange = vi.fn();
    renderPanel({ onParametersChange });

    const targetSelect = requiredElement<HTMLSelectElement>('[data-testid="impact-target-body"]');
    expect(document.querySelector(`label[for="${targetSelect.id}"]`)?.textContent)
      .toContain('Target body');
    expect(Array.from(targetSelect.options, (option) => option.value)).toEqual([
      'mercury',
      'venus',
      'earth',
      'moon',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]);

    changeSelect(targetSelect, 'moon');
    expect(onParametersChange).toHaveBeenCalledWith({
      ...PARAMETERS,
      targetBodyId: 'moon',
      atmosphereEnabled: false,
    });

    renderPanel({
      parameters: {
        ...PARAMETERS,
        targetBodyId: 'moon',
        atmosphereEnabled: true,
      },
    });
    const atmosphere = requiredElement<HTMLInputElement>('[data-testid="impact-atmosphere"]');
    expect(atmosphere.disabled).toBe(true);
    expect(atmosphere.checked).toBe(false);
    expect(document.querySelector('h2')?.textContent).toBe('Moon Impact Lab');
    expect(document.getElementById(atmosphere.getAttribute('aria-describedby') ?? '')?.textContent)
      .toMatch(/Moon is modeled as airless/i);
  });

  it('uses the selected target in confirmation copy and labels unsupported craters', () => {
    renderPanel({
      parameters: { ...PARAMETERS, targetBodyId: 'jupiter' },
      summary: {
        ...SUMMARY,
        targetBodyId: 'jupiter',
        targetClass: 'gas-giant',
        outcomeKind: 'deep-atmosphere-breakup',
        targetRadiusM: 69_911_000,
      },
      visualProfile: {
        ...VISUAL_PROFILE,
        craterRadiusM: 0,
        craterDepthM: 0,
        ejectaRadiusM: 0,
        cloudScarRadiusM: 42_000,
        cloudScarGrowthSeconds: 4,
        cloudScarLifetimeSeconds: 50,
        cloudScarAdvectionRateRadPerSecond: 0.001,
      },
    });

    expect(requiredElement('[data-testid="impact-crater-radius"]').textContent)
      .toMatch(/Not applicable for Jupiter/i);
    expect(requiredElement('[data-testid="impact-surface-outcome"]').textContent)
      .toMatch(/Deep-atmosphere cloud-top encounter/i);
    expect(document.querySelector('[data-testid="impact-ejecta-radius"]')).toBeNull();
    expect(requiredElement('[data-testid="impact-shockwave-speed"]').parentElement?.textContent)
      .toMatch(/Cloud-ripple visual speed/i);
    expect(requiredElement('[data-testid="impact-cloud-scar-radius"]').textContent)
      .toContain('m');
    expect(requiredElement('[data-testid="impact-cloud-scar-lifetime"]').textContent)
      .toContain('50');
    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-run"]').click());
    const dialog = requiredElement<HTMLElement>('[data-testid="impact-confirmation"]');
    expect(dialog.textContent).toContain('Confirm Jupiter impact');
    expect(dialog.textContent).toMatch(/Reset restores the pristine Jupiter/i);

    renderPanel({
      parameters: { ...PARAMETERS, targetBodyId: 'jupiter' },
      summary: {
        ...SUMMARY,
        targetBodyId: 'jupiter',
        targetClass: 'gas-giant',
        outcomeKind: 'deep-atmosphere-breakup',
        targetRadiusM: 69_911_000,
      },
      snapshot: scenarioSnapshot('running', 'plume', 0.7),
    });
    expect(requiredElement('[data-testid="impact-active-warning"]').textContent)
      .toMatch(/cloud ripple.*cloud scar/i);
    const giantAftermath = requiredElement('[data-testid="impact-aftermath-badge"]');
    expect(giantAftermath.getAttribute('data-aftermath-kind')).toBe('cloud-scar');
    expect(giantAftermath.textContent).toMatch(/ATMOSPHERIC CLOUD SCAR.*TEMPORARY/i);
  });

  it('requires an accessible flash confirmation and exposes the reduce-flashes preference', () => {
    const onConfirmRun = vi.fn();
    const onReduceFlashesChange = vi.fn();
    renderPanel({ onConfirmRun, onReduceFlashesChange, reduceFlashes: true });

    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-run"]').click());
    const dialog = requiredElement<HTMLElement>('[data-testid="impact-confirmation"]');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-describedby') ?? '')?.textContent)
      .toMatch(/Photosensitivity warning.*impact flash.*exposure changes/i);
    expect(document.activeElement).toBe(
      requiredElement('[data-testid="impact-confirm-cancel"]'),
    );

    const reduceFlashes = requiredElement<HTMLInputElement>(
      '[data-testid="impact-confirmation"] input[type="checkbox"]',
    );
    expect(reduceFlashes.checked).toBe(true);
    changeCheckbox(reduceFlashes, false);
    expect(onReduceFlashesChange).toHaveBeenCalledWith(false);

    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-confirm"]').click());
    expect(onConfirmRun).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-testid="impact-confirmation"]')).toBeNull();
  });

  it('exposes state-appropriate pause, resume, step, replay, and reset controls', () => {
    const actions = {
      onPause: vi.fn(),
      onResume: vi.fn(),
      onFrameStep: vi.fn(),
      onReplay: vi.fn(),
      onReset: vi.fn(),
    };

    renderPanel({
      ...actions,
      snapshot: scenarioSnapshot('running', 'atmospheric-entry', 0.35),
    });
    expect(requiredElement('[data-testid="impact-size-exaggeration-badge"]').textContent)
      .toMatch(/IMPACTOR SIZE EXAGGERATED.*enlarged only for visibility/i);
    expect(requiredElement('[data-testid="impact-active-warning"]').textContent)
      .toMatch(/Educational approximation active/i);
    expect(requiredElement('[data-testid="impact-event-status"]').textContent)
      .toMatch(/Atmospheric Entry.*35%.*Running/i);
    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-pause"]').click());
    expect(actions.onPause).toHaveBeenCalledOnce();
    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-replay"]').click());
    expect(actions.onReplay).toHaveBeenCalledOnce();

    renderPanel({
      ...actions,
      snapshot: scenarioSnapshot('paused', 'fragmentation', 0.48),
    });
    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-resume"]').click());
    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-step"]').click());
    expect(actions.onResume).toHaveBeenCalledOnce();
    expect(actions.onFrameStep).toHaveBeenCalledOnce();

    renderPanel({
      ...actions,
      snapshot: scenarioSnapshot('complete', 'haze', 1),
    });
    expect(requiredElement('[data-testid="impact-size-exaggeration-badge"]')).toBeTruthy();
    const craterAftermath = requiredElement('[data-testid="impact-aftermath-badge"]');
    expect(craterAftermath.getAttribute('data-aftermath-kind')).toBe('crater');
    expect(craterAftermath.textContent).toMatch(/LOCAL CRATER.*PERSISTS UNTIL RESET/i);
    expect(requiredElement('[data-testid="impact-event-status"]').textContent)
      .toMatch(/Haze.*100%.*complete/i);
    act(() => requiredElement<HTMLButtonElement>('[data-testid="impact-reset"]').click());
    expect(actions.onReset).toHaveBeenCalledOnce();
  });

  it('blocks an invalid configuration and leaves active parameters immutable', () => {
    renderPanel({ parameters: { ...PARAMETERS, diameterM: 0 } as ImpactParameters });
    expect(document.querySelector('[data-testid="impact-size-exaggeration-badge"]')).toBeNull();
    expect(requiredElement('[data-testid="impact-diameter"]').getAttribute('aria-invalid'))
      .toBe('true');
    expect(requiredElement<HTMLButtonElement>('[data-testid="impact-run"]').disabled).toBe(true);
    expect(requiredElement('[data-testid="impact-parameter-error"]').getAttribute('role'))
      .toBe('alert');

    renderPanel({ snapshot: scenarioSnapshot('running', 'approach', 0.1) });
    expect(requiredElement<HTMLInputElement>('[data-testid="impact-diameter"]').matches(':disabled'))
      .toBe(true);
    expect(requiredElement<HTMLSelectElement>('[data-testid="impact-material"]').matches(':disabled'))
      .toBe(true);
    expect(requiredElement<HTMLSelectElement>('[data-testid="impact-camera-preset"]').matches(':disabled'))
      .toBe(false);
  });

  function renderPanel(overrides: Partial<ImpactLabPanelProps> = {}) {
    const props: ImpactLabPanelProps = {
      parameters: PARAMETERS,
      summary: SUMMARY,
      visualProfile: VISUAL_PROFILE,
      snapshot: IDLE_SNAPSHOT,
      disabled: false,
      reduceFlashes: true,
      onParametersChange: () => undefined,
      onReduceFlashesChange: () => undefined,
      onConfirmRun: () => undefined,
      onClose: () => undefined,
      onPause: () => undefined,
      onResume: () => undefined,
      onFrameStep: () => undefined,
      onReplay: () => undefined,
      onReset: () => undefined,
      onCameraModeChange: () => undefined,
      ...overrides,
    };
    act(() => root.render(<ImpactLabPanel {...props} />));
  }
});

function scenarioSnapshot(
  state: ScenarioPlaybackState,
  stage: ImpactStage,
  progress: number,
): Readonly<ImpactScenarioSnapshot> {
  return {
    ...IDLE_SNAPSHOT,
    state,
    stage,
    scenarioTimeSeconds: progress * 30,
    progress,
    playbackRate: state === 'paused' ? 0 : 1,
  };
}

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Expected element matching ${selector}.`);
  return element;
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
