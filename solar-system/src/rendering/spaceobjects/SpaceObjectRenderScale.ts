import type { RenderScaleMode } from '../RenderScaleModel';

const SELECTED_MARKER_RADIUS_RENDER_UNITS = 0.00018;
const PRESENTATION_MARKER_RADIUS_RENDER_UNITS = 0.000065;
const TRUE_SCALE_MARKER_RADIUS_RENDER_UNITS = 0.00000008;

/**
 * The detailed station needs enough exaggeration to remain recognizable, but
 * must stay visually subordinate to Earth in the shared orbital view. Its
 * selected radius is one fifth of the generic selected-satellite marker.
 */
export const SELECTED_ISS_MODEL_RADIUS_RENDER_UNITS = 0.000036;
export const PRESENTATION_ISS_MODEL_RADIUS_RENDER_UNITS = 0.000012;

export function earthSatelliteRenderRadius(
  isIss: boolean,
  selected: boolean,
  mode: RenderScaleMode,
): number {
  if (isIss) {
    if (selected) return SELECTED_ISS_MODEL_RADIUS_RENDER_UNITS;
    return mode === 'presentation'
      ? PRESENTATION_ISS_MODEL_RADIUS_RENDER_UNITS
      : TRUE_SCALE_MARKER_RADIUS_RENDER_UNITS;
  }
  if (selected) return SELECTED_MARKER_RADIUS_RENDER_UNITS;
  return mode === 'presentation'
    ? PRESENTATION_MARKER_RADIUS_RENDER_UNITS
    : TRUE_SCALE_MARKER_RADIUS_RENDER_UNITS;
}
