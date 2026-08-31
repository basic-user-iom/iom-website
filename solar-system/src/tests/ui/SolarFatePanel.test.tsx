// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  FICTIONAL_SOLAR_SUPERNOVA_PHOTOSENSITIVITY_WARNING,
  FICTIONAL_SOLAR_SUPERNOVA_WARNING,
  SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT,
  SolarFatePanel,
  type FictionalSolarSupernovaPanelState,
  type ScientificSolarEvolutionPanelState,
  type SolarFatePanelProps,
} from '../../ui/observatory/SolarFatePanel';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const SCIENTIFIC_RUNNING = Object.freeze({
  mode: 'scientific-evolution',
  playbackState: 'running',
  stageId: 'red-giant',
  phaseName: 'Red-giant expansion',
  scenarioTimeSeconds: 7.25,
  progress: 0.42,
  radiusLabel: 'Strongly expanded',
  luminosityLabel: 'Greatly increased',
  massLossLabel: 'Increasing',
  timeCompressionNotice: 'Billions of years are compressed into seconds.',
  caveats: Object.freeze([
    'This is a source-informed educational narrative.',
    'Earth remains uncertain.',
  ]),
  uncertainBodyIds: Object.freeze(['earth']),
  compactRemnantSizeExaggerationRequired: false,
}) satisfies Readonly<ScientificSolarEvolutionPanelState>;

const FICTIONAL_RUNNING = Object.freeze({
  mode: 'fictional-supernova',
  playbackState: 'running',
  stageId: 'shock-shell',
  stageName: 'Expanding shock shell',
  scenarioTimeSeconds: 5.5,
  progress: 0.31,
}) satisfies Readonly<FictionalSolarSupernovaPanelState>;

describe('Phase 9 SolarFatePanel', () => {
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

  it('presents two independently named and text-classified scenario regions', () => {
    renderPanel();

    const panel = requiredElement('[data-testid="solar-fate-panel"]');
    expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
    expect(panel.getAttribute('data-solar-fate-mode')).toBe('idle');
    expect(requiredElement('[data-testid="solar-fate-distinction"]').textContent)
      .toMatch(/mutually exclusive.*compressed educational.*deliberately fictional cinema/i);

    const scientific = requiredElement('[data-testid="solar-evolution-option"]');
    expect(scientific.getAttribute('data-classification')).toBe('scientific');
    expect(labelledText(scientific)).toBe('Scientific Solar Evolution');
    expect(scientific.textContent).toContain('Scientific · compressed educational visualization');
    expect(scientific.textContent).toContain(SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT);
    expect(scientific.textContent).not.toMatch(/supernova/i);
    const scientificStart = requiredElement<HTMLButtonElement>(
      '[data-testid="solar-evolution-start"]',
    );
    expect(scientificStart.textContent?.trim()).toBe('Scientific Solar Evolution');
    expect(describedText(scientificStart)).toBe(SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT);

    const fictional = requiredElement('[data-testid="fictional-supernova-option"]');
    expect(fictional.getAttribute('data-classification')).toBe('fictional-cinematic');
    expect(labelledText(fictional)).toBe('Fictional Solar Supernova');
    expect(fictional.textContent).toContain('Fictional · cinematic · impossible for the Sun');
    expect(fictional.textContent).toContain(FICTIONAL_SOLAR_SUPERNOVA_WARNING);
    const fictionalStart = requiredElement<HTMLButtonElement>(
      '[data-testid="fictional-supernova-start"]',
    );
    expect(fictionalStart.textContent?.trim()).toBe('Fictional Solar Supernova');
    expect(describedText(fictionalStart)).toBe(FICTIONAL_SOLAR_SUPERNOVA_WARNING);
  });

  it('starts the scientific narrative directly and renders only its caveat and telemetry', () => {
    const actions = actionSpies();
    renderPanel({ ...actions });

    act(() => requiredElement<HTMLButtonElement>('[data-testid="solar-evolution-start"]').click());
    expect(actions.onStartScientificEvolution).toHaveBeenCalledOnce();
    expect(actions.onStartFictionalSupernova).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="fictional-supernova-confirmation"]')).toBeNull();

    renderPanel({ ...actions, activeScenario: SCIENTIFIC_RUNNING });
    const active = requiredElement('[data-testid="solar-evolution-active"]');
    expect(requiredElement('[data-testid="solar-fate-panel"]').getAttribute('data-solar-fate-mode'))
      .toBe('scientific-evolution');
    expect(active.textContent).toContain(SCIENTIFIC_SOLAR_EVOLUTION_CAVEAT);
    expect(active.textContent).toContain('Billions of years are compressed into seconds.');
    expect(active.textContent).toContain('Outcome explicitly uncertain: Earth.');
    expect(active.textContent).toContain('Earth remains uncertain.');
    expect(active.textContent).not.toMatch(/supernova/i);
    expect(requiredElement<HTMLProgressElement>(
      'progress[aria-label="Scientific Solar Evolution progress"]',
    ).value).toBe(0.42);
    const scientificStatus = requiredElement(
      '[data-testid="solar-evolution-status"]',
    ).textContent;
    for (const value of [
      'Red-giant expansion',
      '42%',
      'Strongly expanded',
      'Greatly increased',
      'Increasing',
    ]) {
      expect(scientificStatus).toContain(value);
    }
    expect(requiredElement('[role="status"]').textContent)
      .toContain('Scientific Solar Evolution phase: Red-giant expansion.');
    expect(document.querySelector('[data-testid="fictional-supernova-active"]')).toBeNull();

    click('[data-testid="solar-evolution-pause"]');
    click('[data-testid="solar-evolution-skip"]');
    click('[data-testid="solar-evolution-replay"]');
    click('[data-testid="solar-evolution-reset"]');
    expect(actions.onPause).toHaveBeenCalledOnce();
    expect(actions.onSkip).toHaveBeenCalledOnce();
    expect(actions.onReplay).toHaveBeenCalledOnce();
    expect(actions.onReset).toHaveBeenCalledOnce();

    renderPanel({
      ...actions,
      activeScenario: { ...SCIENTIFIC_RUNNING, playbackState: 'paused' },
    });
    click('[data-testid="solar-evolution-resume"]');
    click('[data-testid="solar-evolution-step"]');
    expect(actions.onResume).toHaveBeenCalledOnce();
    expect(actions.onFrameStep).toHaveBeenCalledOnce();
  });

  it('uses an accessible fictional photosensitivity confirmation with trapped and restored focus', () => {
    const actions = actionSpies();
    renderPanel({ ...actions, reduceFlashes: true });

    click('[data-testid="fictional-supernova-start"]');
    const dialog = requiredElement<HTMLElement>(
      '[data-testid="fictional-supernova-confirmation"]',
    );
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(describedText(dialog)).toBe(FICTIONAL_SOLAR_SUPERNOVA_PHOTOSENSITIVITY_WARNING);
    expect(dialog.textContent).toContain(FICTIONAL_SOLAR_SUPERNOVA_WARNING);
    expect(document.activeElement).toBe(
      requiredElement('[data-testid="fictional-supernova-confirm-cancel"]'),
    );

    const confirm = requiredElement<HTMLButtonElement>(
      '[data-testid="fictional-supernova-confirm"]',
    );
    act(() => confirm.focus());
    pressDocumentKey('Tab');
    expect(document.activeElement).toBe(
      dialog.querySelector('button[aria-label="Cancel: Confirm Fictional Solar Supernova"]'),
    );

    pressDocumentKey('Escape');
    expect(document.querySelector('[data-testid="fictional-supernova-confirmation"]')).toBeNull();
    expect(document.activeElement).toBe(
      requiredElement('[data-testid="solar-fate-panel"] h2'),
    );
    expect(actions.onStartFictionalSupernova).not.toHaveBeenCalled();

    click('[data-testid="fictional-supernova-start"]');
    const reduceFlashes = requiredElement<HTMLInputElement>(
      '[data-testid="fictional-supernova-confirm-reduce-flashes"]',
    );
    expect(reduceFlashes.checked).toBe(true);
    changeCheckbox(reduceFlashes, false);
    expect(actions.onReduceFlashesChange).toHaveBeenCalledWith(false);
    click('[data-testid="fictional-supernova-confirm"]');
    expect(actions.onStartFictionalSupernova).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-testid="fictional-supernova-confirmation"]')).toBeNull();
  });

  it('keeps the exact fictional warning and accessibility control through active transport states', () => {
    const actions = actionSpies();
    renderPanel({ ...actions, activeScenario: FICTIONAL_RUNNING, reduceFlashes: true });

    const active = requiredElement('[data-testid="fictional-supernova-active"]');
    expect(requiredElement('[data-testid="solar-fate-panel"]').getAttribute('data-solar-fate-mode'))
      .toBe('fictional-supernova');
    expect(active.textContent).toContain(FICTIONAL_SOLAR_SUPERNOVA_WARNING);
    expect(active.textContent).toContain('Displayed timing and propagation are visually compressed.');
    const fictionalStatus = requiredElement(
      '[data-testid="fictional-supernova-status"]',
    ).textContent;
    for (const value of ['Expanding shock shell', '31%', '5.5 s']) {
      expect(fictionalStatus).toContain(value);
    }
    expect(requiredElement<HTMLInputElement>(
      '[data-testid="fictional-supernova-active-reduce-flashes"]',
    ).checked).toBe(true);
    expect(document.querySelector('[data-testid="solar-evolution-active"]')).toBeNull();

    click('[data-testid="fictional-supernova-pause"]');
    click('[data-testid="fictional-supernova-skip"]');
    click('[data-testid="fictional-supernova-replay"]');
    click('[data-testid="fictional-supernova-reset"]');
    expect(actions.onPause).toHaveBeenCalledOnce();
    expect(actions.onSkip).toHaveBeenCalledOnce();
    expect(actions.onReplay).toHaveBeenCalledOnce();
    expect(actions.onReset).toHaveBeenCalledOnce();

    renderPanel({
      ...actions,
      activeScenario: { ...FICTIONAL_RUNNING, playbackState: 'paused' },
    });
    expect(requiredElement('[data-testid="fictional-supernova-active-warning"]').textContent)
      .toBe(FICTIONAL_SOLAR_SUPERNOVA_WARNING);
    click('[data-testid="fictional-supernova-resume"]');
    click('[data-testid="fictional-supernova-step"]');
    expect(actions.onResume).toHaveBeenCalledOnce();
    expect(actions.onFrameStep).toHaveBeenCalledOnce();

    renderPanel({
      ...actions,
      activeScenario: {
        ...FICTIONAL_RUNNING,
        playbackState: 'complete',
        stageId: 'remnant',
        stageName: 'Remnant',
        progress: 1,
      },
    });
    expect(requiredElement('[data-testid="fictional-supernova-active-warning"]').textContent)
      .toBe(FICTIONAL_SOLAR_SUPERNOVA_WARNING);
    expect(document.querySelector('[data-testid="fictional-supernova-pause"]')).toBeNull();
    expect(document.querySelector('[data-testid="fictional-supernova-skip"]')).toBeNull();
    expect(requiredElement('[data-testid="fictional-supernova-replay"]')).toBeTruthy();
    expect(requiredElement('[data-testid="fictional-supernova-reset"]')).toBeTruthy();
  });

  function renderPanel(overrides: Partial<SolarFatePanelProps> = {}) {
    const props: SolarFatePanelProps = {
      activeScenario: null,
      disabled: false,
      reduceFlashes: true,
      onReduceFlashesChange: () => undefined,
      onStartScientificEvolution: () => undefined,
      onStartFictionalSupernova: () => undefined,
      onClose: () => undefined,
      onPause: () => undefined,
      onResume: () => undefined,
      onFrameStep: () => undefined,
      onSkip: () => undefined,
      onReplay: () => undefined,
      onReset: () => undefined,
      ...overrides,
    };
    act(() => root.render(<SolarFatePanel {...props} />));
  }
});

function actionSpies() {
  return {
    onReduceFlashesChange: vi.fn(),
    onStartScientificEvolution: vi.fn(),
    onStartFictionalSupernova: vi.fn(),
    onClose: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onFrameStep: vi.fn(),
    onSkip: vi.fn(),
    onReplay: vi.fn(),
    onReset: vi.fn(),
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

function click(selector: string): void {
  act(() => requiredElement<HTMLButtonElement>(selector).click());
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
