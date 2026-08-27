import type { LinarConfig, LinarLightState, LinarSide, LinarViewId } from './types'

export type LinarTourTarget =
  | 'viewport'
  | 'bending'
  | 'radius'
  | 's-curve'
  | 'incision'
  | 'materials'
  | 'colours'
  | 'application'
  | 'repetition'
  | 'light'
  | 'technical-data'
  | 'share'
  | 'reset'

export type LinarTourStep = {
  title: string
  description: string
  target: LinarTourTarget
  durationMs: number
  view: LinarViewId
  side: LinarSide
  bend: number
  secondaryCurveAmount: number
  config: Partial<LinarConfig>
  light?: LinarLightState
}

/**
 * Deterministic demonstration states. The page snapshots the user's plain
 * configuration before applying these and restores it on Finish, Skip or any
 * user interruption.
 */
export const LINAR_TOUR_STEPS: readonly LinarTourStep[] = [
  {
    title: 'Bidirectional bending',
    description:
      'Move through neutral into either bend direction. The same manufactured LINAR surface remains continuous.',
    target: 'bending',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 34,
    secondaryCurveAmount: 0,
    config: { application: 'freestanding', backing: 'none', panelCount: 1 },
  },
  {
    title: 'Radius in millimetres',
    description:
      'The preview radius follows the selected material and geometry. Unsupported combinations remain explicitly Not tested.',
    target: 'radius',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 72,
    secondaryCurveAmount: 0,
    config: {},
  },
  {
    title: 'Continuous S-curve',
    description:
      'Counter-curvature grows smoothly from the main bend. It is a visual reference where measured manufacturing limits are unavailable.',
    target: 's-curve',
    durationMs: 0,
    view: 'top',
    side: 'front',
    bend: -76,
    secondaryCurveAmount: 88,
    config: {},
  },
  {
    title: 'Incision and active area',
    description:
      'Incision length, cut width, lamella width and centred coverage define the real openings and local bridge cycle.',
    target: 'incision',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 0,
    secondaryCurveAmount: 0,
    config: { incisionLengthMm: 70, cutWidthMm: 4, slatWidthMm: 4, incisedTwelfths: 12 },
  },
  {
    title: 'Base materials and veneers',
    description:
      'MDF, birch plywood and three-layer spruce share the LINAR geometry; optional veneer changes appearance without inventing radius data.',
    target: 'materials',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 12,
    secondaryCurveAmount: 0,
    config: { material: 'plywood', veneer: 'oak', thicknessMm: 9, incisionLengthMm: 40 },
  },
  {
    title: 'Defined colour references',
    description:
      'MDF and felt use bounded catalogue choices. Temporary references remain labelled until official names and codes are supplied.',
    target: 'colours',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 8,
    secondaryCurveAmount: 0,
    config: { material: 'mdf', veneer: 'none', mdfColour: 'reference-04', backing: 'felt' },
  },
  {
    title: 'Architectural application',
    description:
      'Freestanding, Wall and Ceiling reuse one physical configuration instead of swapping to unrelated product models.',
    target: 'application',
    durationMs: 0,
    view: 'hero',
    side: 'front',
    bend: 18,
    secondaryCurveAmount: 0,
    config: { application: 'wall', backing: 'none', panelCount: 1 },
  },
  {
    title: 'Horizontal repetition',
    description:
      'Repeated modules inherit the same state and continue edge-to-edge in one horizontal installation row.',
    target: 'repetition',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 38,
    secondaryCurveAmount: 0,
    config: { application: 'freestanding', panelCount: 3 },
  },
  {
    title: 'Night-mode light study',
    description:
      'The tour enters a near-black, single-light environment automatically. One fixed warm key illuminates the inspected face while every fill light stays off, bringing incision depth, bridge relief and perforated shadow forward. Drag the glowing light to direct it.',
    target: 'light',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 26,
    secondaryCurveAmount: 0,
    config: { panelCount: 1, application: 'freestanding', backing: 'none' },
    // Mirror the default key to the right so its draggable handle remains
    // clear of the explanatory card during this authored tour step.
    light: { enabled: true, u: 0.32, v: -0.28, radius: 0 },
  },
  {
    title: 'Technical status',
    description:
      'Open area, radius and cutting depth distinguish validated samples, geometric estimates and unavailable manufacturing data.',
    target: 'technical-data',
    durationMs: 0,
    view: 'hero',
    side: 'front',
    bend: 26,
    secondaryCurveAmount: 0,
    config: {},
  },
  {
    title: 'Share this selection',
    description:
      'Share creates a validated URL containing the current product, application, view and light selection.',
    target: 'share',
    durationMs: 0,
    view: 'hero',
    side: 'front',
    bend: 16,
    secondaryCurveAmount: 0,
    config: {},
  },
  {
    title: 'Reset and return',
    description:
      'Reset returns to one flat front-facing panel, the default material, freestanding context and default light position.',
    target: 'reset',
    durationMs: 0,
    view: 'hero',
    side: 'front',
    bend: 0,
    secondaryCurveAmount: 0,
    config: { application: 'freestanding', backing: 'none', panelCount: 1 },
  },
]
