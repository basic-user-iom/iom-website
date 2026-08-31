import { renderToStaticMarkup } from 'react-dom/server';

import { CanvasLegend } from '../../ui/observatory/CanvasLegend';

const BODY_SHORTCUTS = [
  ['sun', 'Sun'],
  ['mercury', 'Mercury'],
  ['venus', 'Venus'],
  ['earth', 'Earth'],
  ['moon', 'Moon'],
  ['mars', 'Mars'],
  ['jupiter', 'Jupiter'],
  ['saturn', 'Saturn'],
  ['uranus', 'Uranus'],
  ['neptune', 'Neptune'],
] as const;

describe('interactive canvas legend', () => {
  it('renders every location as a native labelled button with the selected body exposed', () => {
    const markup = renderLegend({ selectedBodyId: 'earth' });

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Solar System locations and overlays"');
    expect(markup).not.toContain('aria-hidden="true"><button');
    for (const [id, label] of BODY_SHORTCUTS) {
      expect(markup).toContain(`data-testid="legend-body-${id}"`);
      expect(markup).toContain(`aria-label="Focus ${label}"`);
    }
    expect(markup).toMatch(
      /data-testid="legend-body-earth"[^>]*aria-pressed="true"/,
    );
    expect(markup).toMatch(
      /data-testid="legend-body-mars"[^>]*aria-pressed="false"/,
    );
    expect(markup).toContain('data-testid="legend-comets"');
    expect((markup.match(/<button/g) ?? [])).toHaveLength(13);
  });

  it('keeps tide actions behind the feature gate and reports each visible component', () => {
    const hiddenMarkup = renderLegend({ experimentalTidesEnabled: false });
    expect(hiddenMarkup).not.toContain('data-testid="legend-tide-lunar"');
    expect(hiddenMarkup).not.toContain('data-testid="legend-tide-solar"');

    const bothMarkup = renderLegend({ activeTideMode: 'both' });
    expect(bothMarkup).toMatch(
      /data-testid="legend-tide-lunar"[^>]*aria-pressed="true"/,
    );
    expect(bothMarkup).toMatch(
      /data-testid="legend-tide-solar"[^>]*aria-pressed="true"/,
    );

    const lunarMarkup = renderLegend({ activeTideMode: 'lunar' });
    expect(lunarMarkup).toMatch(
      /data-testid="legend-tide-lunar"[^>]*aria-pressed="true"/,
    );
    expect(lunarMarkup).toMatch(
      /data-testid="legend-tide-solar"[^>]*aria-pressed="false"/,
    );
  });

  it('disables every action while a scenario owns the observatory', () => {
    const markup = renderLegend({ disabled: true });
    expect((markup.match(/<button[^>]* disabled=""/g) ?? [])).toHaveLength(13);
  });
});

function renderLegend(
  overrides: Partial<Parameters<typeof CanvasLegend>[0]> = {},
): string {
  return renderToStaticMarkup(
    <CanvasLegend
      selectedBodyId="earth"
      selectedBodyIsComet={false}
      cometsVisible
      cometShortcutAvailable
      experimentalTidesEnabled
      activeTideMode="both"
      onFocusBody={() => undefined}
      onFocusComet={() => undefined}
      onToggleTideComponent={() => undefined}
      {...overrides}
    />,
  );
}
