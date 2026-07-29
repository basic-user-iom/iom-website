export type ProjectSection =
  | 'software'
  | '3d'
  | '360'
  | 'photography'
  | 'music'
  | 'experiments'

export type SectionDef = { id: ProjectSection; label: string; blurb: string }

export const SECTIONS: SectionDef[] = [
  {
    id: 'software',
    label: 'Software',
    blurb:
      'Browser 3D viewers, local-first production workspaces, 360° tour editors, image prep, and tools for presenting interactive media.',
  },
  {
    id: '3d',
    label: '3D',
    blurb:
      'Real-time WebGPU and WebGL scenes — reflections, volumetric light, oceans, and object-driven storytelling.',
  },
  {
    id: '360',
    label: 'Case Studies',
    blurb:
      'Process deep-dives — from brief and layout through engineering to the final interactive build clients can open.',
  },
  {
    id: 'photography',
    label: 'Photography',
    blurb: 'Still frames, light studies, and documentary capture.',
  },
  {
    id: 'music',
    label: 'Music',
    blurb: 'Soundscapes, scores, and audio for interactive experiences.',
  },
  {
    id: 'experiments',
    label: 'Experiments',
    blurb:
      'WebGPU real-time rendering R&D — compute particles, lighting, fog, curves, and motion studies.',
  },
]
