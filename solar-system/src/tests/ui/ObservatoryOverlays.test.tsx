import { renderToStaticMarkup } from 'react-dom/server';

import { INITIAL_SIMULATION_SNAPSHOT } from '../../state/useAppStore';
import { HelpOverlay } from '../../ui/observatory/HelpOverlay';
import { ProvenanceOverlay } from '../../ui/observatory/ProvenanceOverlay';

describe('Phase 7 observatory overlays', () => {
  it('renders keyboard help and reportable accessibility preferences', () => {
    const markup = renderToStaticMarkup(
      <HelpOverlay
        open
        onClose={() => undefined}
        motionPreference="reduce"
        onMotionPreferenceChange={() => undefined}
        reduceFlashes
        onReduceFlashesChange={() => undefined}
        onResetPreferences={() => undefined}
        resetPreferencesDisabled={false}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Keyboard shortcuts');
    expect(markup).toMatch(/checked="" value="reduce"/);
    expect(markup).toContain('Reduce flashes and abrupt exposure changes');
    expect(markup).toContain('Reset saved preferences');
  });

  it('renders live provider state and pinned validation links', () => {
    const markup = renderToStaticMarkup(
      <ProvenanceOverlay
        open
        onClose={() => undefined}
        selectedBodyId="earth"
        selectedBodyName="Earth"
        providerLabel="JPL Horizons · bundled"
        providerStatus="ready"
        providerCoverage="2000–2100 TDB"
        providerMessage={null}
        snapshot={INITIAL_SIMULATION_SNAPSHOT}
        cameraMode="body-follow"
        renderScaleMode="presentation"
        presentationWarningRequired
        ephemerisValidationUrl="/planet-validation.json"
        smallBodyValidationUrl="/comet-validation.json"
        surfaceAssetManifestUrl="/source-manifest.json"
        moonSurfaceAssetManifestUrl="/moon-surface-manifest.json"
      />,
    );

    expect(markup).toContain('Data providers and provenance');
    expect(markup).toContain('Earth · earth');
    expect(markup).toContain('JPL Horizons · bundled');
    expect(markup).toContain('body sizes are exaggerated');
    expect(markup).toContain('href="/planet-validation.json"');
    expect(markup).toContain('href="/comet-validation.json"');
    expect(markup).toContain('href="/source-manifest.json"');
    expect(markup).toContain('href="/moon-surface-manifest.json"');
    expect(markup).toContain('(opens in a new tab)');
  });
});
