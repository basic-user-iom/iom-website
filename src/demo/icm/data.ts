export type ViewMode = 'list' | 'grid'

export type StillProject = {
  id: string
  title: string
  client: string
  year: string
  imageCount: number
  aspect: 'portrait' | 'landscape' | 'square'
  tone: string
}

export type MotionProject = {
  id: string
  title: string
  role: string
  year: string
  duration: string
  tone: string
}

export type Exhibition = {
  id: string
  title: string
  subtitle: string
  year: string
  mode: 'clouds' | 'editorial'
  photoCount: number
  blurb: string
}

export const STILLS: StillProject[] = [
  {
    id: 'still-01',
    title: 'Horizon Studies',
    client: 'Placeholder series',
    year: '2025',
    imageCount: 12,
    aspect: 'landscape',
    tone: '#c8c2b8',
  },
  {
    id: 'still-02',
    title: 'Portrait Room',
    client: 'Placeholder series',
    year: '2025',
    imageCount: 8,
    aspect: 'portrait',
    tone: '#b7b0a6',
  },
  {
    id: 'still-03',
    title: 'Night Roads',
    client: 'Placeholder series',
    year: '2024',
    imageCount: 16,
    aspect: 'landscape',
    tone: '#9a958c',
  },
  {
    id: 'still-04',
    title: 'Studio Notes',
    client: 'Placeholder series',
    year: '2024',
    imageCount: 6,
    aspect: 'square',
    tone: '#d2cdc4',
  },
  {
    id: 'still-05',
    title: 'Coast Line',
    client: 'Placeholder series',
    year: '2023',
    imageCount: 10,
    aspect: 'landscape',
    tone: '#aea89f',
  },
  {
    id: 'still-06',
    title: 'Quiet Cities',
    client: 'Placeholder series',
    year: '2023',
    imageCount: 14,
    aspect: 'portrait',
    tone: '#8f8a82',
  },
]

export const MOTION: MotionProject[] = [
  {
    id: 'motion-01',
    title: 'Working Title — Film A',
    role: 'Director / DoP',
    year: '2025',
    duration: '02:40',
    tone: '#1a1a1a',
  },
  {
    id: 'motion-02',
    title: 'Working Title — Film B',
    role: 'Director',
    year: '2024',
    duration: '01:15',
    tone: '#2a2a2a',
  },
  {
    id: 'motion-03',
    title: 'Working Title — Spot',
    role: 'DoP',
    year: '2024',
    duration: '00:45',
    tone: '#111111',
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
  },
  {
    id: 'exhibition-02',
    title: 'Exhibition Two',
    subtitle: 'Editorial chapter',
    year: '2025',
    mode: 'editorial',
    photoCount: 48,
    blurb: 'Placeholder for a large stills exhibition in scroll / chapter form.',
  },
  {
    id: 'exhibition-03',
    title: 'Exhibition Three',
    subtitle: 'Editorial chapter',
    year: '2024',
    mode: 'editorial',
    photoCount: 72,
    blurb: 'Placeholder for another body of work presented as named sections.',
  },
]
