import type { ProjectSection } from '../../data/sections'
import { SECTIONS } from '../../data/sections'
import type { SiteLang } from '../types'

/** Section label/blurb overlays only — keeps Header off the heavy project locale packs. */
const SECTION_PACKS: Partial<
  Record<Exclude<SiteLang, 'en'>, Partial<Record<ProjectSection, { label?: string; blurb?: string }>>>
> = {
  de: {
    software: {
      label: 'Software',
      blurb:
        'Browser-3D-Viewer, lokal-first Produktionsräume, 360°-Tour-Editoren, Bildvorbereitung und Tools für interaktive Medienpräsentationen.',
    },
    '3d': {
      label: '3D',
      blurb:
        'Echtzeit-WebGPU- und WebGL-Szenen — Reflexionen, volumetrisches Licht, Ozeane und objektgetriebene Erzählungen.',
    },
    '360': {
      label: 'Fallstudien',
      blurb:
        'Prozess-Deep-Dives — vom Briefing und Layout über Engineering bis zum finalen interaktiven Build, den Kunden öffnen können.',
    },
    photography: { label: 'Fotografie', blurb: 'Standbilder, Lichtstudien und dokumentarische Aufnahmen.' },
    music: { label: 'Musik', blurb: 'Klanglandschaften, Scores und Audio für interaktive Erlebnisse.' },
    experiments: {
      label: 'Experimente',
      blurb: 'WebGPU-Echtzeit-Rendering-R&D — Compute-Partikel, Beleuchtung, Nebel, Kurven und Bewegungsstudien.',
    },
  },
  fr: {
    software: {
      label: 'Logiciels',
      blurb:
        "Visionneuses 3D navigateur, espaces de production local-first, éditeurs de visites 360°, préparation d'images et outils pour présenter des médias interactifs.",
    },
    '3d': {
      label: '3D',
      blurb:
        'Scènes WebGPU et WebGL en temps réel — reflets, lumière volumétrique, océans et narration portée par les objets.',
    },
    '360': {
      label: 'Études de cas',
      blurb:
        "Plongées dans le processus — du brief et du layout à l'ingénierie jusqu'au build interactif final que les clients peuvent ouvrir.",
    },
    photography: { label: 'Photographie', blurb: 'Images fixes, études de lumière et capture documentaire.' },
    music: { label: 'Musique', blurb: 'Paysages sonores, partitions et audio pour expériences interactives.' },
    experiments: {
      label: 'Expériences',
      blurb: 'R&D de rendu temps réel WebGPU — particules compute, éclairage, brouillard, courbes et études de mouvement.',
    },
  },
  nl: {
    software: {
      label: 'Software',
      blurb:
        'Browser-3D-viewers, local-first productiewerkruimten, 360°-tour-editors, beeldvoorbereiding en tools om interactieve media te presenteren.',
    },
    '3d': {
      label: '3D',
      blurb:
        'Realtime WebGPU- en WebGL-scènes — reflecties, volumetrisch licht, oceanen en objectgedreven storytelling.',
    },
    '360': {
      label: 'Case studies',
      blurb:
        'Proces-deepdives — van brief en layout via engineering tot de uiteindelijke interactieve build die klanten kunnen openen.',
    },
    photography: { label: 'Fotografie', blurb: 'Stilstaande beelden, lichtstudies en documentaire opnames.' },
    music: { label: 'Muziek', blurb: 'Klanklandschappen, scores en audio voor interactieve ervaringen.' },
    experiments: {
      label: 'Experimenten',
      blurb: 'WebGPU realtime rendering R&D — compute-particles, belichting, mist, curves en bewegingsstudies.',
    },
  },
  it: {
    software: {
      label: 'Software',
      blurb:
        'Viewer 3D nel browser, workspace di produzione local-first, editor di tour a 360°, preparazione immagini e strumenti per presentare media interattivi.',
    },
    '3d': {
      label: '3D',
      blurb:
        'Scene WebGPU e WebGL in tempo reale — riflessioni, luce volumetrica, oceani e storytelling guidato dagli oggetti.',
    },
    '360': {
      label: 'Casi studio',
      blurb:
        'Deep-dive di processo — dal brief e layout all’engineering fino al build interattivo finale che i clienti possono aprire.',
    },
    photography: { label: 'Fotografia', blurb: 'Still frame, studi di luce e riprese documentarie.' },
    music: { label: 'Musica', blurb: 'Paesaggi sonori, score e audio per esperienze interattive.' },
    experiments: {
      label: 'Esperimenti',
      blurb: 'R&D di rendering WebGPU in tempo reale — particelle compute, illuminazione, nebbia, curve e studi di motion.',
    },
  },
  es: {
    software: {
      label: 'Software',
      blurb:
        'Visores 3D en el navegador, workspaces de producción local-first, editores de tours 360°, preparación de imágenes y herramientas para presentar medios interactivos.',
    },
    '3d': {
      label: '3D',
      blurb:
        'Escenas WebGPU y WebGL en tiempo real — reflexiones, luz volumétrica, océanos y storytelling impulsado por objetos.',
    },
    '360': {
      label: 'Casos de estudio',
      blurb:
        'Deep-dives de proceso — del brief y el layout a la ingeniería hasta el build interactivo final que los clientes pueden abrir.',
    },
    photography: { label: 'Fotografía', blurb: 'Fotogramas fijos, estudios de luz y captura documental.' },
    music: { label: 'Música', blurb: 'Paisajes sonoros, partituras y audio para experiencias interactivas.' },
    experiments: {
      label: 'Experimentos',
      blurb: 'I+D de renderizado WebGPU en tiempo real — partículas compute, iluminación, niebla, curvas y estudios de movimiento.',
    },
  },
}

/** Nav/home section list without pulling project translation packs into the critical path. */
export function localizedSectionNav(lang: SiteLang) {
  if (lang === 'en') return SECTIONS
  const overlay = SECTION_PACKS[lang]
  if (!overlay) return SECTIONS
  return SECTIONS.map((section) => {
    const o = overlay[section.id]
    if (!o) return section
    return {
      ...section,
      label: o.label ?? section.label,
      blurb: o.blurb ?? section.blurb,
    }
  })
}
