import { renderToStaticMarkup } from 'react-dom/server';

import {
  selectSetVenusSurfaceMode,
  selectSetVisualQuality,
  selectVenusSurfaceMode,
  selectVisualQuality,
} from '../../state/selectors';
import { useAppStore } from '../../state/useAppStore';
import { BodyInspector } from '../../ui/observatory/BodyInspector';
import { ViewControls } from '../../ui/observatory/ViewControls';
import { EPHEMERIS_BODY_DEFINITIONS } from '../../simulation/bodies/EphemerisBodyCatalog';

describe('Phase 4 visual controls', () => {
  afterEach(() => {
    useAppStore.getState().setVisualQuality('high');
    useAppStore.getState().setVenusSurfaceMode('clouds');
  });

  it('defaults to high quality and the scientifically honest Venus cloud view', () => {
    const state = useAppStore.getState();

    expect(selectVisualQuality(state)).toBe('high');
    expect(selectVenusSurfaceMode(state)).toBe('clouds');
  });

  it('exposes stable selectors and actions for renderer integration', () => {
    selectSetVisualQuality(useAppStore.getState())('ultra');
    selectSetVenusSurfaceMode(useAppStore.getState())('radar');

    expect(selectVisualQuality(useAppStore.getState())).toBe('ultra');
    expect(selectVenusSurfaceMode(useAppStore.getState())).toBe('radar');
  });

  it('renders labelled visual and Venus controls with their selected states', () => {
    const markup = renderToStaticMarkup(
      <ViewControls
        cameraMode="overview"
        renderScaleMode="presentation"
        visualQuality="ultra"
        venusSurfaceMode="radar"
        presentationWarningRequired
        selectedTrailInterval="previous"
        onCameraModeChange={() => undefined}
        onRenderScaleModeChange={() => undefined}
        onVisualQualityChange={() => undefined}
        onVenusSurfaceModeChange={() => undefined}
        onSelectedTrailIntervalChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="visual-quality-select"');
    expect(markup).toContain('<option value="ultra" selected="">Ultra</option>');
    expect(markup).toContain('data-testid="venus-surface-controls"');
    expect(markup).toContain(
      'aria-pressed="true" data-testid="venus-radar-button"',
    );
  });

  it('reports renderer material and optional asset state in the inspector', () => {
    const earth = EPHEMERIS_BODY_DEFINITIONS.find((body) => body.id === 'earth');
    expect(earth).toBeDefined();

    const markup = renderToStaticMarkup(
      <BodyInspector
        body={earth!}
        telemetry={{ distanceFromSunM: 149_597_870_700, speedMps: 29_780 }}
        cameraMode="body-follow"
        presentationWarningRequired={false}
        materialLabel="Earth PBR + atmosphere"
        assetState="Authoritative maps ready"
      />,
    );

    expect(markup).toContain('data-testid="body-material-label"');
    expect(markup).toContain('Earth PBR + atmosphere');
    expect(markup).toContain('data-testid="body-asset-state"');
    expect(markup).toContain('Authoritative maps ready');
    expect(markup).toContain('data-testid="body-solar-irradiance"');
    expect(markup).toContain('1,361 W/m² · inverse-square');
    expect(markup).not.toContain('Phase 3 placeholder material');
  });

  it('reports the dedicated Earth–Moon system camera in the inspector', () => {
    const earth = EPHEMERIS_BODY_DEFINITIONS.find((body) => body.id === 'earth');
    expect(earth).toBeDefined();

    const markup = renderToStaticMarkup(
      <BodyInspector
        body={earth!}
        telemetry={{ distanceFromSunM: 149_597_870_700, speedMps: 29_780 }}
        cameraMode="earth-moon-system"
        presentationWarningRequired={false}
      />,
    );

    expect(markup).toContain('<dt>Camera</dt><dd>Earth–Moon system</dd>');
  });
});
