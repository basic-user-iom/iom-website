import {
  DEFAULT_LINAR_LIGHT,
  type LinarConfig,
  type LinarLightState,
  type LinarSide,
  type LinarViewId,
} from './types'

export type LinarTourTarget =
  | 'viewport'
  | 'bending'
  | 'radius'
  | 's-curve'
  | 'incision'
  | 'materials'
  | 'colours'
  | 'application'
  | 'backlight'
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
    config: {
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 1,
    },
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
    config: {
      material: 'mdf',
      veneer: 'none',
      mdfColour: 'reference-04',
      application: 'freestanding',
      backing: 'felt',
      backlightMode: 'off',
    },
  },
  {
    title: 'Rear backlight only',
    description:
      'On the ceiling, the movable orb is off while diffuse rear illumination alone reveals the real apertures without changing technical calculations.',
    target: 'backlight',
    durationMs: 0,
    view: 'hero',
    side: 'front',
    bend: 18,
    secondaryCurveAmount: 0,
    config: {
      application: 'ceiling',
      backing: 'none',
      backlightMode: 'on',
      backlightIntensity: 60,
      panelCount: 1,
    },
    light: { ...DEFAULT_LINAR_LIGHT },
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
    config: {
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 3,
    },
    light: { ...DEFAULT_LINAR_LIGHT },
  },
  {
    title: 'Orb light only',
    description:
      'The rear backlight is off while the movable warm orb alone illuminates the inspected face, bringing incision depth, bridge relief and perforated shadow forward.',
    target: 'light',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 26,
    secondaryCurveAmount: 0,
    config: {
      panelCount: 1,
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
    },
    // The elevated, front-normal source reveals the true perforated floor
    // projection; visitors can then drag it through the full 360-degree orbit.
    light: { enabled: true, placement: 'room', u: 0, v: 0.6, radius: 0 },
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
    config: {
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 1,
    },
    light: { ...DEFAULT_LINAR_LIGHT },
  },
  {
    title: 'Share this selection',
    description:
      'The wall study now combines diffuse rear illumination with the movable orb behind the panel. Share preserves both independent sources and their placement in one validated URL.',
    target: 'share',
    durationMs: 0,
    view: 'hero',
    side: 'front',
    bend: 16,
    secondaryCurveAmount: 0,
    config: {
      application: 'wall',
      backing: 'none',
      backlightMode: 'on',
      backlightIntensity: 60,
      panelCount: 1,
    },
    light: { enabled: true, placement: 'behind', u: 0, v: 0.6, radius: 0 },
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
    config: {
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 1,
    },
    light: { ...DEFAULT_LINAR_LIGHT },
  },
]
