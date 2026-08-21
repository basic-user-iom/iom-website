import type { LinarConfig, LinarSide, LinarViewId } from './types'
import { DEFAULT_LINAR_CONFIG } from './types'

export type LinarTourTarget =
  | 'viewport'
  | 'view'
  | 'bending'
  | 'panel'
  | 'incision'
  | 'application'

export type LinarTourStep = {
  title: string
  description: string
  target: LinarTourTarget
  durationMs: number
  view: LinarViewId
  side: LinarSide
  bend: number
  config: Partial<LinarConfig>
}

export const LINAR_TOUR_STEPS: readonly LinarTourStep[] = [
  {
    title: 'A machined wood surface',
    description:
      'Start with the complete birch panel. Continuous slats and staggered bridges turn a rigid sheet into a flexible architectural surface.',
    target: 'viewport',
    durationMs: 6800,
    view: 'hero',
    side: 'front',
    bend: 0,
    config: { ...DEFAULT_LINAR_CONFIG },
  },
  {
    title: 'Real incision geometry',
    description:
      'Move close to the face to inspect true openings, routed cut walls and the curved wood bridges that remain between incisions.',
    target: 'incision',
    durationMs: 8000,
    view: 'closeup',
    side: 'front',
    bend: 0,
    config: { incisionLengthMm: 40, cutWidthMm: 4, slatWidthMm: 4, incisedTwelfths: 12 },
  },
  {
    title: 'Material response',
    description:
      'Switch to three-layer spruce. Grain, warmth, roughness and exposed layers respond independently from the geometry.',
    target: 'panel',
    durationMs: 7400,
    view: 'closeup',
    side: 'front',
    bend: 10,
    config: {
      material: 'three-layer-spruce',
      thicknessMm: 13,
      incisionLengthMm: 70,
      cutWidthMm: 4,
      slatWidthMm: 4,
    },
  },
  {
    title: 'Front, edge and reverse',
    description:
      'The camera travels around the panel so the reverse veneer, routed depth and panel thickness can be inspected as real surfaces.',
    target: 'view',
    durationMs: 7800,
    view: 'side',
    side: 'back',
    bend: 14,
    config: {},
  },
  {
    title: 'Radius-driven flexibility',
    description:
      'A validated MDF sample demonstrates the bend preview. The active strip curves while the remaining surface follows tangent transitions.',
    target: 'bending',
    durationMs: 8800,
    view: 'bent',
    side: 'front',
    bend: 78,
    config: {
      material: 'mdf',
      thicknessMm: 10,
      incisionLengthMm: 66,
      cutWidthMm: 4,
      slatWidthMm: 4,
      incisedTwelfths: 12,
      pattern: 'regular',
    },
  },
  {
    title: 'Control the active area',
    description:
      'Coverage can be reduced to a centred flexible strip. The untouched left and right zones remain continuous solid board.',
    target: 'incision',
    durationMs: 7800,
    view: 'hero',
    side: 'front',
    bend: 34,
    config: { incisedTwelfths: 6 },
  },
  {
    title: 'Optional backing layer',
    description:
      'Backing choices remain descriptive configuration metadata, while the reverse inspection shows their separate visual layer.',
    target: 'application',
    durationMs: 7600,
    view: 'reverse',
    side: 'back',
    bend: 18,
    config: { backing: 'felt' },
  },
  {
    title: 'Ready for your configuration',
    description:
      'The tour returns to the calibrated LINAR panel. Continue with any material, incision, coverage, view or bend setting.',
    target: 'viewport',
    durationMs: 6800,
    view: 'hero',
    side: 'front',
    bend: 8,
    config: { ...DEFAULT_LINAR_CONFIG },
  },
]
