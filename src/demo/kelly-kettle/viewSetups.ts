import type { DemoStep, StepViewSetup } from './types'

const SHARED_VIEW: StepViewSetup = {
  camera: {
    px: -0.207,
    py: 0.233,
    pz: 0.664,
    tx: 0,
    ty: 0.152,
    tz: 0,
    fov: 32,
  },
  labels: [
    {
      id: 'draw',
      text: 'Open chimney creates strong upward draw',
      x: 53.8,
      y: 6,
      side: 'right',
    },
    {
      id: 'surface',
      text: 'Large heated surface',
      x: 56.2,
      y: 28.4,
      side: 'right',
    },
    {
      id: 'chamber',
      text: 'Central fire chamber',
      x: 53,
      y: 35,
      side: 'right',
    },
    {
      id: 'water',
      text: 'Water surrounds the chimney',
      x: 57.6,
      y: 60.3,
      side: 'right',
    },
  ],
}

export const DEFAULT_VIEW_SETUPS: Partial<Record<DemoStep, StepViewSetup>> = {
  cutaway: SHARED_VIEW,
  fire: SHARED_VIEW,
  complete: SHARED_VIEW,
}
