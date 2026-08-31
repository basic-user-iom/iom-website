import { describe, expect, it } from 'vitest';

import {
  EXPERIMENTAL_TIDES_QUERY_PARAMETER,
  parseExperimentalTideMode,
  toggleExperimentalTideComponent,
} from '../app/ExperimentalFeatures';

describe('Phase 12 experimental feature flags', () => {
  it.each(['lunar', 'solar', 'both'] as const)(
    'accepts the explicit %s tidal component mode',
    (mode) => {
      expect(parseExperimentalTideMode(`?${EXPERIMENTAL_TIDES_QUERY_PARAMETER}=${mode}`))
        .toBe(mode);
    },
  );

  it.each([
    '',
    '?experimental=tides',
    '?experimentalTides=',
    '?experimentalTides=combined',
    '?experimentalTides=unknown',
    '?experimentalTides=BoTh',
    '?experimentalTides=%20both%20',
  ])('keeps the overlay off for an absent or unsupported flag: %s', (search) => {
    expect(parseExperimentalTideMode(search)).toBe('off');
  });

  it.each([
    ['off', 'lunar', 'lunar'],
    ['lunar', 'lunar', 'off'],
    ['solar', 'lunar', 'both'],
    ['both', 'lunar', 'solar'],
    ['off', 'solar', 'solar'],
    ['solar', 'solar', 'off'],
    ['lunar', 'solar', 'both'],
    ['both', 'solar', 'lunar'],
  ] as const)(
    'toggles the %s + %s transient component state to %s',
    (mode, component, expected) => {
      expect(toggleExperimentalTideComponent(mode, component)).toBe(expected);
    },
  );
});
