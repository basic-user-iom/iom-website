export type ViewMode = 'list' | 'grid'

const A = '/demo/icm'

export type StillProject = {
  id: string
  title: string
  client: string
  year: string
  aspect: 'portrait' | 'landscape' | 'square'
  cover: string
  images: string[]
}

export type MotionProject = {
  id: string
  title: string
  role: string
  year: string
  duration: string
  cover: string
}

export type Exhibition = {
  id: string
  title: string
  subtitle: string
  year: string
  mode: 'clouds' | 'editorial'
  photoCount: number
  blurb: string
  cover: string
  images: string[]
}

export const STILLS: StillProject[] = [
  {
    id: 'still-01',
    title: 'Horizon Studies',
    client: 'Placeholder series',
    year: '2025',
    aspect: 'landscape',
    cover: `${A}/still-01.jpg`,
    images: [`${A}/still-01.jpg`, `${A}/g-01.jpg`, `${A}/g-05.jpg`, `${A}/g-07.jpg`],
  },
  {
    id: 'still-02',
    title: 'Portrait Room',
    client: 'Placeholder series',
    year: '2025',
    aspect: 'portrait',
    cover: `${A}/still-02.jpg`,
    images: [`${A}/still-02.jpg`, `${A}/g-10.jpg`, `${A}/g-11.jpg`, `${A}/g-12.jpg`],
  },
  {
    id: 'still-03',
    title: 'Night Roads',
    client: 'Placeholder series',
    year: '2024',
    aspect: 'landscape',
    cover: `${A}/still-03.jpg`,
    images: [`${A}/still-03.jpg`, `${A}/g-03.jpg`, `${A}/g-08.jpg`, `${A}/ex-03.jpg`],
  },
  {
    id: 'still-04',
    title: 'Studio Notes',
    client: 'Placeholder series',
    year: '2024',
    aspect: 'square',
    cover: `${A}/still-04.jpg`,
    images: [`${A}/still-04.jpg`, `${A}/g-09.jpg`, `${A}/g-12.jpg`, `${A}/g-10.jpg`],
  },
  {
    id: 'still-05',
    title: 'Coast Line',
    client: 'Placeholder series',
    year: '2023',
    aspect: 'landscape',
    cover: `${A}/still-05.jpg`,
    images: [`${A}/still-05.jpg`, `${A}/g-04.jpg`, `${A}/g-06.jpg`, `${A}/g-02.jpg`],
  },
  {
    id: 'still-06',
    title: 'Quiet Cities',
    client: 'Placeholder series',
    year: '2023',
    aspect: 'portrait',
    cover: `${A}/still-06.jpg`,
    images: [`${A}/still-06.jpg`, `${A}/g-08.jpg`, `${A}/ex-02.jpg`, `${A}/g-01.jpg`],
  },
]

export const MOTION: MotionProject[] = [
  {
    id: 'motion-01',
    title: 'Working Title — Film A',
    role: 'Director / DoP',
    year: '2025',
    duration: '02:40',
    cover: `${A}/motion-01.jpg`,
  },
  {
    id: 'motion-02',
    title: 'Working Title — Film B',
    role: 'Director',
    year: '2024',
    duration: '01:15',
    cover: `${A}/motion-02.jpg`,
  },
  {
    id: 'motion-03',
    title: 'Working Title — Spot',
    role: 'DoP',
    year: '2024',
    duration: '00:45',
    cover: `${A}/motion-03.jpg`,
  },
]

export const EXHIBITIONS: Exhibition[] = [
  {
    id: 'clouds',
    title: 'Clouds',
    subtitle: 'Immersive chapter',
    year: '2026',
    mode: 'clouds',
    photoCount: 360,
    blurb:
      'Enter through a WebGL sky. Drift between cloud clusters to open chapters, then browse each group in a calm gallery.',
    cover: `${A}/clouds.jpg`,
    images: [`${A}/clouds.jpg`, `${A}/g-04.jpg`, `${A}/g-01.jpg`, `${A}/g-05.jpg`, `${A}/g-06.jpg`],
  },
  {
    id: 'exhibition-02',
    title: 'Exhibition Two',
    subtitle: 'Editorial chapter',
    year: '2025',
    mode: 'editorial',
    photoCount: 48,
    blurb: 'Placeholder for a large stills exhibition in scroll / chapter form.',
    cover: `${A}/ex-02.jpg`,
    images: [`${A}/ex-02.jpg`, `${A}/g-02.jpg`, `${A}/g-07.jpg`, `${A}/g-03.jpg`],
  },
  {
    id: 'exhibition-03',
    title: 'Exhibition Three',
    subtitle: 'Editorial chapter',
    year: '2024',
    mode: 'editorial',
    photoCount: 72,
    blurb: 'Placeholder for another body of work presented as named sections.',
    cover: `${A}/ex-03.jpg`,
    images: [`${A}/ex-03.jpg`, `${A}/g-08.jpg`, `${A}/still-01.jpg`, `${A}/g-05.jpg`],
  },
]

export const CLOUD_CHAPTERS = [
  {
    id: 'dawn',
    title: 'Dawn',
    images: [`${A}/clouds.jpg`, `${A}/g-01.jpg`, `${A}/g-05.jpg`, `${A}/still-05.jpg`],
  },
  {
    id: 'midday',
    title: 'Midday',
    images: [`${A}/g-04.jpg`, `${A}/g-06.jpg`, `${A}/g-02.jpg`, `${A}/ex-02.jpg`],
  },
  {
    id: 'storm',
    title: 'Storm',
    images: [`${A}/still-03.jpg`, `${A}/g-03.jpg`, `${A}/ex-03.jpg`, `${A}/g-08.jpg`],
  },
  {
    id: 'dusk',
    title: 'Dusk',
    images: [`${A}/g-07.jpg`, `${A}/still-01.jpg`, `${A}/clouds.jpg`, `${A}/g-01.jpg`],
  },
]
