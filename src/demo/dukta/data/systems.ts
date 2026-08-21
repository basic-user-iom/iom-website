import { img } from './media'

export type SystemId = 'sonar' | 'linar' | 'foli' | 'janus' | 'janus-tex' | 'duna'

export type System = {
  id: SystemId
  name: string
  pattern: SystemId
  minRadius: string
  openArea: string
  image: string
  configurator?: boolean
}

export const SYSTEMS: System[] = [
  {
    id: 'sonar',
    name: 'SONAR',
    pattern: 'sonar',
    minRadius: 'ca. 80 mm',
    openArea: '20% – 40%',
    image: img.applications.walls,
  },
  {
    id: 'linar',
    name: 'LINAR',
    pattern: 'linar',
    minRadius: 'ca. 80 mm',
    openArea: '20% – 40%',
    image: img.linar10mmWebp,
    configurator: true,
  },
  {
    id: 'foli',
    name: 'FOLI',
    pattern: 'foli',
    minRadius: 'ca. 200 mm',
    openArea: '10% – 25%',
    image: img.projects.boutique,
  },
  {
    id: 'janus',
    name: 'JANUS',
    pattern: 'janus',
    minRadius: 'ca. 120 mm',
    openArea: '20% – 40%',
    image: img.projects.maple,
  },
  {
    id: 'janus-tex',
    name: 'JANUS-TEX',
    pattern: 'janus-tex',
    minRadius: 'ca. 120 mm',
    openArea: '20% – 40%',
    image: img.systems.janusTex,
  },
  {
    id: 'duna',
    name: 'DUNA',
    pattern: 'duna',
    minRadius: 'ca. 200 mm',
    openArea: '10% – 20%',
    image: img.systems.duna,
  },
]
