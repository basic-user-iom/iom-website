import { img } from './media'

export const APPLICATIONS = [
  {
    id: 'walls' as const,
    image: img.applications.spruce,
    layout: 'wide' as const,
  },
  {
    id: 'ceilings' as const,
    image: img.hero,
    layout: 'offset' as const,
  },
  {
    id: 'acoustics' as const,
    image: img.applications.acoustic,
    layout: 'wide' as const,
  },
  {
    id: 'partitions' as const,
    image: img.applications.partitions,
    layout: 'offset' as const,
  },
  {
    id: 'furniture' as const,
    image: img.applications.furniture,
    layout: 'narrow' as const,
  },
  {
    id: 'lighting' as const,
    image: img.applications.lighting,
    layout: 'narrow' as const,
  },
]
