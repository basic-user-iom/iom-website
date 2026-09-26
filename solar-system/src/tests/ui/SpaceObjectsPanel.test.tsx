// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { SpaceObjectsPanel } from '../../ui/observatory/SpaceObjectsPanel';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('SpaceObjectsPanel empty search', () => {
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

  it('shows an empty-state message when the search matches nothing', () => {
    act(() => {
      root.render(
        <SpaceObjectsPanel
          currentJdTdb={2_460_000}
          visible
          earthSatellitesVisible
          spacecraftVisible
          selectedObjectId={null}
          onVisibleChange={() => undefined}
          onEarthSatellitesVisibleChange={() => undefined}
          onSpacecraftVisibleChange={() => undefined}
          onSelectObject={() => undefined}
          onFocusObject={() => undefined}
          onFocusEarth={() => undefined}
          onFocusSun={() => undefined}
          onReturnToSatelliteEpoch={() => undefined}
        />,
      );
    });

    const search = container.querySelector<HTMLInputElement>('#space-object-search');
    if (search === null) throw new Error('Expected space-object search input.');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'zzzz-no-match');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const empty = container.querySelector('[data-testid="space-objects-empty"]');
    expect(empty?.textContent).toMatch(/No satellite or spacecraft matches/i);
    expect(container.textContent).toMatch(/Earth satellites · 0 of 5/i);
  });
});
