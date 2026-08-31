export const EXPERIMENTAL_TIDES_QUERY_PARAMETER = 'experimentalTides';

export type ExperimentalTideMode = 'off' | 'lunar' | 'solar' | 'both';
export type ExperimentalTideComponent = 'lunar' | 'solar';

/**
 * Resolves the URL-only Phase 12 developer flag. The value is intentionally
 * transient: it is never copied into application preferences or simulation
 * state.
 */
export function parseExperimentalTideMode(search: string): ExperimentalTideMode {
  const value = new URLSearchParams(search).get(EXPERIMENTAL_TIDES_QUERY_PARAMETER);
  switch (value) {
    case 'lunar':
    case 'solar':
    case 'both':
      return value;
    default:
      return 'off';
  }
}

export function readExperimentalTideMode(): ExperimentalTideMode {
  if (typeof window === 'undefined') return 'off';
  return parseExperimentalTideMode(window.location.search);
}

/** Toggles one transient display component without changing the URL feature gate. */
export function toggleExperimentalTideComponent(
  mode: ExperimentalTideMode,
  component: ExperimentalTideComponent,
): ExperimentalTideMode {
  let lunarVisible = mode === 'lunar' || mode === 'both';
  let solarVisible = mode === 'solar' || mode === 'both';
  if (component === 'lunar') lunarVisible = !lunarVisible;
  else solarVisible = !solarVisible;

  if (lunarVisible && solarVisible) return 'both';
  if (lunarVisible) return 'lunar';
  if (solarVisible) return 'solar';
  return 'off';
}
