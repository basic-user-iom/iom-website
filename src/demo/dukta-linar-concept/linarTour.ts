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
  | 'thickness'
  | 'materials'
  | 'colours'
  | 'veneer'
  | 'backing'
  | 'application'
  | 'backlight'
  | 'repetition'
  | 'advanced-lighting'
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

export function mergeLinarTourStepState(
  currentConfig: LinarConfig,
  currentLight: LinarLightState,
  step: Pick<LinarTourStep, 'config' | 'light'>,
): { config: LinarConfig; light: LinarLightState } {
  return {
    config: { ...currentConfig, ...step.config },
    // A step without an authored light state must not silently turn off or
    // reposition a light that the visitor manipulated during the tour.
    light: step.light ? { ...step.light } : { ...currentLight },
  }
}

/**
 * Deterministic demonstration states in the same order as the interface.
 * Each step applies only its declared patch. Direct manipulation remains
 * active, and Finish or Exit leaves the current visible selection in place.
 */
export const LINAR_TOUR_STEPS: readonly LinarTourStep[] = [
  {
    title: 'Bending radius',
    description:
      'Move through neutral into either bend direction. Radius is shown in millimetres while the same manufactured LINAR surface remains continuous.',
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
    title: 'S-curve visual study',
    description:
      'Counter-curvature grows smoothly from the main bend as a visual design study, not an approved manufactured configuration. Unsupported feasibility remains Not tested.',
    target: 's-curve',
    durationMs: 0,
    view: 'top',
    side: 'front',
    bend: -76,
    secondaryCurveAmount: 88,
    config: { backing: 'none', backlightMode: 'off' },
  },
  {
    title: 'Incisions and active area',
    description:
      'Incision length, cut width, lamella width and centred coverage define the real openings and local bridge cycle.',
    target: 'incision',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 0,
    secondaryCurveAmount: 0,
    config: {
      incisionLengthMm: 70,
      cutWidthMm: 4,
      slatWidthMm: 4,
      incisedTwelfths: 12,
    },
  },
  {
    title: 'Base panel thickness',
    description:
      'Thickness stays beside the shape controls because it participates in supported combinations and radius feedback.',
    target: 'thickness',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 42,
    secondaryCurveAmount: 0,
    config: { thicknessMm: 9 },
  },
  {
    title: 'Addition and repetition',
    description:
      'Four modules demonstrate the selected visual-configurator range. Pattern phase continues through seams without doubled perimeter members.',
    target: 'repetition',
    durationMs: 0,
    view: 'bent',
    side: 'front',
    bend: 32,
    secondaryCurveAmount: 0,
    config: {
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 4,
    },
  },
  {
    title: 'Application and back-construction',
    description:
      'Wall and Ceiling use the same panel-local grid: one midpoint member per module, each seam once, four internal profile ribs and the unchanged outer frame.',
    target: 'application',
    durationMs: 0,
    view: 'reverse',
    side: 'back',
    bend: 28,
    secondaryCurveAmount: 0,
    config: {
      application: 'wall',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 4,
    },
  },
  {
    title: 'Base material',
    description:
      'MDF, birch plywood and three-layer spruce retain their existing combination checks. Valchromat colours are screen approximations, not new manufacturing data.',
    target: 'materials',
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
      application: 'freestanding',
      backing: 'none',
      backlightMode: 'off',
      panelCount: 1,
    },
  },
  {
    title: 'Veneer appearance',
    description:
      'The optional veneer changes visible appearance without changing base thickness or the bending-radius calculation.',
    target: 'veneer',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 12,
    secondaryCurveAmount: 0,
    config: { material: 'plywood', veneer: 'oak', panelCount: 1 },
  },
  {
    title: 'Backing material',
    description:
      'Acoustic fleece remains a translucent visual study while wool felt is opaque. Backing changes do not reset the selected panel geometry.',
    target: 'backing',
    durationMs: 0,
    view: 'closeup',
    side: 'front',
    bend: 14,
    secondaryCurveAmount: 0,
    config: {
      application: 'wall',
      backing: 'acoustic-fleece',
      fleeceColour: 'translucent',
      backlightMode: 'off',
      panelCount: 1,
    },
  },
  {
    title: 'Rear light study',
    description:
      'The rear source uses the real openings and support geometry. Ribs occlude it while the recessed diffuser remains a non-photometric visual study.',
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
    title: 'Advanced lighting',
    description:
      'Enable the orb only when needed. Drag it for position and height, scroll over it for distance, adjust brightness, or reset this light without changing the panel.',
    target: 'advanced-lighting',
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
    light: { ...DEFAULT_LINAR_LIGHT, enabled: true, placement: 'room' },
  },
  {
    title: 'Technical status',
    description:
      'Technical results distinguish production classification, physical evidence and feasibility from geometric estimates. Unsupported combinations remain Not tested.',
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
      'Share preserves material, geometry, application, backing, repetition and both lighting states in one versioned URL. Restored feasibility is checked again.',
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
    light: { ...DEFAULT_LINAR_LIGHT, enabled: true, placement: 'behind' },
  },
  {
    title: 'Reset panel',
    description:
      'Reset is explicit and separate from Finish or Exit. Ending the tour keeps the current visible configuration instead of restoring a stale snapshot.',
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
