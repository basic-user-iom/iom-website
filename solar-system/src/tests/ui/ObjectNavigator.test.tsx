// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  ObjectNavigator,
  type NavigatorCatalogTarget,
} from '../../ui/observatory/ObjectNavigator';

const reactTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('ObjectNavigator complete-catalog search', () => {
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

  it('finds and navigates to moons, artificial satellites, and spacecraft', () => {
    const onSelectCatalogTarget = vi.fn();
    const catalogTargets: readonly NavigatorCatalogTarget[] = [
      { id: 'io', displayName: 'Io', kind: 'natural-satellite', detail: 'Jupiter · major moon' },
      { id: 'earth-satellite-25544', displayName: 'ISS (ZARYA)', kind: 'earth-satellite', detail: 'NORAD 25544 · space stations' },
      { id: 'voyager-1', displayName: 'Voyager 1', kind: 'spacecraft', detail: 'NASA / JPL · active' },
    ];
    act(() => root.render(
      <ObjectNavigator
        bodies={[{ id: 'earth', displayName: 'Earth', kind: 'planet' }]}
        catalogTargets={catalogTargets}
        selectedBodyId="earth"
        orbitLinesVisible
        bodyLabelsVisible
        onSelectBody={() => undefined}
        onSelectCatalogTarget={onSelectCatalogTarget}
        onOrbitLinesVisibleChange={() => undefined}
        onBodyLabelsVisibleChange={() => undefined}
      />,
    ));

    searchFor('Io');
    const moon = requiredButton('[data-testid="navigator-catalog-natural-satellite-io"]');
    expect(moon.textContent).toContain('Jupiter · major moon');
    act(() => moon.click());
    expect(onSelectCatalogTarget).toHaveBeenLastCalledWith(catalogTargets[0]);

    searchFor('25544');
    const station = requiredButton('[data-testid="navigator-catalog-earth-satellite-earth-satellite-25544"]');
    act(() => station.click());
    expect(onSelectCatalogTarget).toHaveBeenLastCalledWith(catalogTargets[1]);

    searchFor('Voyager');
    const spacecraft = requiredButton('[data-testid="navigator-catalog-spacecraft-voyager-1"]');
    act(() => spacecraft.click());
    expect(onSelectCatalogTarget).toHaveBeenLastCalledWith(catalogTargets[2]);
  });

  function searchFor(value: string): void {
    const search = container.querySelector<HTMLInputElement>('#body-search');
    if (search === null) throw new Error('Expected complete-catalog search input.');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, value);
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
});

function requiredButton(selector: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (element === null) throw new Error(`Expected button matching ${selector}.`);
  return element;
}
