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
      'The preview radius follows the selected material and geometry. Production classification, physical evidence and feasibility remain separate, and unsupported combinations stay explicitly Not tested.',
    target: 'radius',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 72,
    secondaryCurveAmount: 0,
    config: {},
  },
  {
    title: 'S-curve visual study',
    description:
      'Counter-curvature grows smoothly from the main bend as a visual design study, not an approved manufactured configuration. Technical data reports the minimum local radius along the active curve; an unavailable reference remains Not tested.',
    target: 's-curve',
    durationMs: 0,
    view: 'top',
    side: 'front',
    bend: -76,
    secondaryCurveAmount: 88,
    config: { backing: 'none', backlightMode: 'off' },
  },
  {
    title: 'Incision and active area',
    description:
      'Incision length, cut width, lamella width and centred coverage define the real openings and local bridge cycle. Official treatment of partial pitch cells at a selected boundary remains under client review.',
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
      'MDF, birch plywood and three-layer spruce share the LINAR geometry. One optional veneer choice is shown on both faces for simplicity and changes appearance without inventing radius data.',
    target: 'materials',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 12,
    secondaryCurveAmount: 0,
    config: { material: 'plywood', veneer: 'oak', thicknessMm: 9, incisionLengthMm: 40 },
  },
  {
    title: 'MDF and backing palettes',
    description:
      'MDF Natural and Valchromat are distinct board appearances. This restrained Grey Valchromat screen approximation is paired with translucent acoustic fleece; its transmission is visual, not certified, while wool felt is opaque.',
    target: 'colours',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 8,
    secondaryCurveAmount: 0,
    config: {
      material: 'mdf',
      veneer: 'none',
      mdfVariant: 'valchromat',
      mdfColour: 'grey',
      thicknessMm: 9,
      incisionLengthMm: 40,
      cutWidthMm: 4,
      slatWidthMm: 4,
      application: 'wall',
      backing: 'acoustic-fleece',
      fleeceColour: 'translucent',
      backlightMode: 'off',
      panelCount: 1,
    },
  },
  {
    title: 'Rear backlight only',
    description:
      'On the ceiling, the movable orb is off while diffuse rear illumination reveals the real apertures. A simplified coherent support grid anchors the installation without claiming a certified mounting detail.',
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
    title: 'Selected 1–4 panel range',
    description:
      'Four panels demonstrate the selected visual-configurator range, not a manufacturing maximum. Pattern phase continues across seams and one simplified wall support grid spans the complete installation.',
    target: 'repetition',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 38,
    secondaryCurveAmount: 0,
    config: {
      application: 'wall',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 4,
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
      'Technical results distinguish production classification, physical evidence and feasibility from geometric estimates. Effective dimensions, material availability and values still require manufacturer confirmation.',
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
      'The wall study combines diffuse rear illumination with the movable orb behind an unbacked panel. Share preserves material, backing, the selected 1–4 panel count and both light sources in one versioned URL; restored technical feasibility is checked again.',
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
      'Reset returns to one flat front-facing panel, the default material, freestanding context and light position. Stored MDF and backing choices return safely to MDF Natural and None.',
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
