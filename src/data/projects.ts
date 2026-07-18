export type ProjectSection =
  | 'software'
  | '3d'
  | '360'
  | 'photography'
  | 'music'
  | 'experiments'

export interface Project {
  id: string
  title: string
  section: ProjectSection
  tags: string[]
  description: string
  year: string
  url?: string
  /** Live site preview in featured card (iframe src); falls back to glyph if blocked */
  embedUrl?: string
  /** Static poster shown until hover activates the live embed */
  posterUrl?: string
  /** Static poster used when embeds are disabled on mobile */
  mobilePosterUrl?: string
  /** Optional static preview image for non-embed cards */
  thumbnail?: string
  /** Upstream example source on GitHub (Three.js demos, etc.) */
  sourceUrl?: string
  /** Additional upstream references (character rigs, related examples, etc.) */
  referenceUrls?: { label: string; url: string }[]
  gallery?: ProjectImage[]
  /** Ambient soundtrack URL played while browsing gallery images */
  galleryAudio?: string
  /** Standalone track URL for the Music section player */
  audioUrl?: string
  featured?: boolean
  /** ISO timestamp — card shows coming-soon overlay until this time */
  availableAt?: string
  /** Force coming-soon overlay even without availableAt */
  comingSoonOverlay?: boolean
  /** Label shown on the coming-soon overlay (default: Coming Soon) */
  comingSoonLabel?: string
  archiveId: string
}

export interface ProjectImage {
  src: string
  caption: string
}

export const SECTIONS: { id: ProjectSection; label: string; blurb: string }[] = [
  {
    id: 'software',
    label: 'Software',
    blurb:
      'Browser 3D model viewers, 360° virtual tour editors, image prep, and tools for presenting interactive media.',
  },
  {
    id: '3d',
    label: '3D',
    blurb:
      'Real-time WebGPU and WebGL scenes — reflections, volumetric light, oceans, and object-driven storytelling.',
  },
  {
    id: '360',
    label: '360 Tours',
    blurb:
      'Immersive 360° panorama architecture tours and spatial walkthroughs for place and exhibition.',
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

export const PROJECTS: Project[] = [
  {
    id: '3d-viewer',
    title: '3D Viewer',
    section: 'software',
    tags: ['web', 'desktop', 'three.js', 'product'],
    description:
      'Browser 3D model viewer for the web and Windows desktop. Load GLTF, FBX, OBJ, IFC, and more — inspect with orbit controls, GPU path tracing, HDR lighting, hotspots, and export standalone web presentations.',
    year: '2024–26',
    url: 'https://3dbviewer.com/',
    embedUrl: 'https://3dbviewer.com/',
    posterUrl: '/assets/posters/3d-viewer.jpg',
    mobilePosterUrl: '/assets/posters/3d-viewer.jpg',
    featured: true,
    archiveId: 'OBJ-0041',
  },
  {
    id: 'streets-gl-bridge',
    title: 'Streets GL Bridge',
    section: 'software',
    tags: ['maps', 'integration', 'osm', 'webgl', 'open-source'],
    description:
      'OpenStreetMap 3D ground layer integration for geolocated model presentation — sync models to real-world coordinates with terrain alignment. Live demo embeds Streets GL (MIT) for real-world OSM buildings, roads, and terrain.',
    year: '2025–26',
    url: '/demos/streets-gl/',
    embedUrl: 'https://streets.gl/',
    posterUrl: '/assets/posters/streets-gl.jpg?v=20260709-2',
    mobilePosterUrl: '/assets/posters/streets-gl.jpg?v=20260709-2',
    sourceUrl: 'https://github.com/StrandedKitty/streets-gl',
    referenceUrls: [
      {
        label: 'Live map',
        url: 'https://streets.gl/',
      },
      {
        label: 'OSM wiki — Simple 3D Buildings',
        url: 'https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings',
      },
    ],
    archiveId: 'OBJ-0033',
  },
  {
    id: 'panorama-360-tour',
    title: '360° Panorama Tour Editor',
    section: 'software',
    tags: ['web', 'three.js', 'equirectangular', 'hotspots', 'tour', 'webgpu', 'birds'],
    description:
      '360° virtual tour editor in the browser — opens on The Black Witness by default. Load equirectangular panoramas (JPG, PNG, WebP, HDR, EXR, KTX2), place link/info/URL hotspots with optional iframe popups, build multi-scene tours, add a WebGPU birds flock effect, and save or load .360project files.',
    year: '2026',
    url: '/demos/panorama-360/',
    embedUrl: '/demos/panorama-360/',
    posterUrl: '/assets/posters/panorama-360-tour.jpg?v=20260715-1',
    mobilePosterUrl: '/assets/posters/panorama-360-tour.jpg?v=20260715-1',
    archiveId: 'OBJ-0146',
  },
  {
    id: 'crm-demo',
    title: 'CRM Demo',
    section: 'software',
    tags: ['crm', 'leads', 'pipeline', 'sandbox'],
    description:
      'Interactive sample CRM with fictional companies — lead pipeline, project boards, time tracking, and idea maps. Edits stay in this browser tab and never touch live client data.',
    year: '2026',
    url: 'https://iobjectm.com/crm-demo',
    posterUrl: '/assets/posters/crm-demo.jpg?v=20260715-2',
    mobilePosterUrl: '/assets/posters/crm-demo.jpg?v=20260715-2',
    thumbnail: '/assets/posters/crm-demo.jpg?v=20260715-2',
    archiveId: 'OBJ-0147',
  },
  {
    id: 'image-prep',
    title: 'Image Prep',
    section: 'software',
    tags: ['photos', 'exif', 'resize', 'compress', 'web'],
    description:
      'Browser photo prep for the web — resize to portfolio presets, compress JPEG/WebP/PNG, and strip EXIF camera and GPS data. Files stay on your device until you download them.',
    year: '2026',
    url: '/tools/image-prep',
    posterUrl: '/assets/posters/image-prep.jpg?v=20260718-1',
    mobilePosterUrl: '/assets/posters/image-prep.jpg?v=20260718-1',
    thumbnail: '/assets/posters/image-prep.jpg?v=20260718-1',
    archiveId: 'OBJ-0151',
  },
  {
    id: 'raven-path',
    title: 'Raven Path Animation',
    section: 'software',
    tags: ['webgl', 'animation', 'spline', 'gltf', 'ravens', 'three.js'],
    description:
      'Animated raven GLB following a custom Catmull-Rom path — drag spline control points, tune travel speed, ease-in/out, reverse direction, and toggle tangent-aligned vs fixed orientation while wing-flap skeletal animation plays.',
    year: '2026',
    url: '/demos/raven-path/',
    embedUrl: '/demos/raven-path/',
    posterUrl: '/assets/posters/raven-path.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/raven-path.jpg?v=20260710',
    referenceUrls: [
      {
        label: 'Spline editor',
        url: '/demos/spline-editor/',
      },
      {
        label: 'WebGPU curve modifier',
        url: '/demos/webgpu-modifier-curve/',
      },
    ],
    archiveId: 'OBJ-0149',
  },
  {
    id: 'panorama-suite',
    title: 'The Black Witness — 360° Tour',
    section: '360',
    tags: ['equirectangular', 'hotspots', 'guided tour', 'webgpu'],
    description:
      'Interactive 360° walkthrough of The Black Witness — hotspots, guided tour steps, and WebGPU effects. Opens in visitor preview (no editor) at yaw −84.7°, pitch −6°.',
    year: '2026',
    url: '/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6',
    embedUrl: '/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6',
    posterUrl: '/assets/posters/panorama-360-tour.jpg?v=20260715-1',
    mobilePosterUrl: '/assets/posters/panorama-360-tour.jpg?v=20260715-1',
    archiveId: 'OBJ-0056',
  },
  {
    id: 'the-black-witness',
    title: 'The Black Witness',
    section: 'photography',
    tags: ['raven', 'documentary', 'mist', 'urban', 'nature'],
    description:
      'A visual study of the same raven moving through city, forest, mountain, and mist — a silent observer crossing natural and built worlds.',
    year: '2023',
    posterUrl: '/assets/photos/the-black-witness/photo-0.png',
    mobilePosterUrl: '/assets/photos/the-black-witness/photo-0.png',
    galleryAudio: '/assets/audio/the-black-witness.mp3',
    gallery: [
      {
        src: '/assets/photos/the-black-witness/photo-0.png',
        caption:
          'Rooftop Distance — A lone raven watches the rain-softened skyline from the far edge of a wet city roof.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-1.png',
        caption:
          'Alley Crossing — Between brick walls and puddled pavement, the raven moves through the alley like part of the weather.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-2.png',
        caption:
          'Forest Ground — On a damp forest path, the raven pauses among wet leaves, moss, and low morning fog.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-3.png',
        caption:
          'Moss Branch — Half-hidden in the old forest, the raven rests on a moss-covered branch while the trees fade into mist.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-4.png',
        caption:
          'Mountain Ledge — Small against the ridges, the raven stands on wet stone as clouds move through the valley below.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-5.png',
        caption:
          'Sea Cliff Watch — Above the broken surf, the raven waits on the cliff edge, almost swallowed by mist and rock.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-6.png',
        caption:
          'Winter Branch — A dark wing opens against the snow, caught for a moment between landing and flight.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-7.png',
        caption:
          'Abandoned Interior — Inside the ruined concrete shell, the raven appears quietly at the window, framed by water, decay, and gray light.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-8.png',
        caption:
          'Valley Wall — Perched on an old stone wall, the raven becomes a small mark against the vastness of fog and hills.',
      },
      {
        src: '/assets/photos/the-black-witness/photo-9.png',
        caption:
          'Antenna Perch — On a rain-wet rooftop antenna, the raven shifts its wings above the sleeping grid of the city.',
      },
    ],
    archiveId: 'OBJ-0084',
  },
  {
    id: 'between-wild-and-wire',
    title: 'Between Wild and Wire',
    section: 'photography',
    tags: ['fox', 'documentary', 'urban', 'forest', 'wildlife', 'habitat', 'city'],
    description:
      'A red fox moves from forest edge to city underpass and back again, crossing the shifting boundary between wild habitat and human space.',
    year: '2026',
    posterUrl: '/assets/photos/between-wild-and-wire/photo-0.png',
    mobilePosterUrl: '/assets/photos/between-wild-and-wire/photo-0.png',
    galleryAudio: '/assets/audio/between-wild-and-wire.mp3',
    gallery: [
      {
        src: '/assets/photos/between-wild-and-wire/photo-0.png',
        caption:
          'Forest Edge at Dawn — At first light, the fox pauses where the trees give way to open ground, as if deciding whether to leave the shelter of the forest.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-1.png',
        caption:
          'Misty Forest Path — On a damp woodland trail, the fox stands alert in the fog, still fully held within the quiet of the forest.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-2.png',
        caption:
          'Country Path Crossing — Leaving deeper cover behind, the fox crosses a muddy track, stepping into a more open and uncertain landscape.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-3.png',
        caption:
          'Industrial Edge — Among fence lines, weeds, and abandoned rails, the fox enters the outer margin of the city where nature and industry begin to overlap.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-4.png',
        caption:
          'Underpass at Dusk — Beneath concrete and sodium light, the fox pauses in the damp underpass, small against the hard geometry of the built world.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-5.png',
        caption:
          'Alley Crossing — In a rain-dark alley of brick and reflections, the fox moves through the city almost unnoticed, like part of the weather itself.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-6.png',
        caption:
          'Park After Rain — Between wet paths, bare trees, and lit apartment towers, the fox lingers in the city\'s softer interior spaces.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-7.png',
        caption:
          'Canal Path — Walking along the misty canal, the fox turns away from the urban core, following water and silence back toward the edges.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-8.png',
        caption:
          'Frost Meadow — Out beyond the streets, the fox reenters open ground where frost, distance, and sunrise begin to restore the wild.',
      },
      {
        src: '/assets/photos/between-wild-and-wire/photo-9.png',
        caption:
          'Forest Return — At dusk, the journey closes as the fox slips back beneath the trees, returning to the dark quiet of the forest.',
      },
    ],
    archiveId: 'OBJ-0085',
  },
  {
    id: 'concrete-light',
    title: 'Concrete after dark',
    section: 'photography',
    tags: ['architecture', 'brutalism', 'night', 'rain'],
    description:
      'Concrete after dark — rain, mist, and stray neon moving across brutalist walls, turning silent urban facades into cinematic fragments of light and shadow.',
    year: '2024',
    posterUrl: '/assets/photos/concrete-after-dark/photo-0.png',
    mobilePosterUrl: '/assets/photos/concrete-after-dark/photo-0.png',
    galleryAudio: '/assets/audio/concrete-light.mp3',
    gallery: [
      {
        src: '/assets/photos/concrete-after-dark/photo-0.png',
        caption:
          'Monolithic Corner in Rain — A rain-darkened brutalist corner rises into dusk...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-1.png',
        caption:
          'Repeating Windows in Mist — Rows of recessed windows disappear into blue twilight...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-2.png',
        caption:
          'Stairwell Under Neon Rain — A deserted concrete stairwell becomes a nocturnal passage...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-3.png',
        caption:
          'Slit Window Wall — A massive concrete wall with a narrow glowing window...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-4.png',
        caption:
          'Elevated Walkway After Rain — An empty brutalist walkway stretches through mist...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-5.png',
        caption:
          'Broad Facade at Blue Hour — A low, heavy concrete facade rests under storm clouds...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-6.png',
        caption:
          'Tower in Dark Sky — A brutalist tower cuts into the night sky...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-7.png',
        caption:
          'Curved Concrete in Dusk — Rounded brutalist forms and wet courtyard surfaces...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-8.png',
        caption:
          'Entrance in Shadow — A shadowed concrete entrance waits under rain...',
      },
      {
        src: '/assets/photos/concrete-after-dark/photo-9.png',
        caption:
          'Concrete Detail with Neon — A close study of wet concrete, dark glass, seams...',
      },
    ],
    archiveId: 'OBJ-0078',
  },
  {
    id: 'night-grid',
    title: 'Night Grid',
    section: 'photography',
    tags: ['urban', 'long exposure', 'night', 'rain'],
    description:
      'City geometry after rain — reflections, sodium vapor, and the rhythm of windows as a modular grid.',
    year: '2023',
    posterUrl: '/assets/photos/night-grid/photo-0.png',
    mobilePosterUrl: '/assets/photos/night-grid/photo-0.png',
    galleryAudio: '/assets/audio/night-grid.mp3',
    gallery: [
      {
        src: '/assets/photos/night-grid/photo-0.png',
        caption:
          'Window Grid After Rain — A strict office facade becomes a grid of warm windows and dark concrete, mirrored across the rain-soaked pavement below.',
      },
      {
        src: '/assets/photos/night-grid/photo-1.png',
        caption:
          'Sodium Vapor Courtyard — Amber streetlights gather in the wet courtyard, turning apartment windows and rain reflections into a quiet urban pattern.',
      },
      {
        src: '/assets/photos/night-grid/photo-2.png',
        caption:
          'Office Grid in Blue Rain — Lit and unlit office windows form an irregular night code across a rain-darkened facade.',
      },
      {
        src: '/assets/photos/night-grid/photo-3.png',
        caption:
          'Underpass Reflection Grid — Beneath the concrete overhang, sodium vapor light and distant windows stretch into a wet corridor of reflections.',
      },
      {
        src: '/assets/photos/night-grid/photo-4.png',
        caption:
          'Modular Housing Block — A lived-in housing block glows through the night, its balconies and windows arranged like a human-scale grid.',
      },
      {
        src: '/assets/photos/night-grid/photo-5.png',
        caption:
          'Reflected High-Rise Pattern — The building repeats itself in the wet plaza, where window light collapses into a fractured mirror of the city.',
      },
      {
        src: '/assets/photos/night-grid/photo-6.png',
        caption:
          'Open Windows at Night — Private rooms interrupt the dark facade with small warm signals, each window becoming one cell in the urban grid.',
      },
      {
        src: '/assets/photos/night-grid/photo-7.png',
        caption:
          'Parking Deck Geometry — Empty concrete levels repeat into the rain, their amber lights reflected as broken horizontal bands.',
      },
      {
        src: '/assets/photos/night-grid/photo-8.png',
        caption:
          'Glass Grid and Concrete Frame — Concrete and dark glass hold the night in place, turning office light into a measured pattern of rectangles.',
      },
      {
        src: '/assets/photos/night-grid/photo-9.png',
        caption:
          'Distant Windows Through Mist — Across the wet rooftop, distant apartment blocks dissolve into mist, their windows fading like amber coordinates in the dark.',
      },
    ],
    archiveId: 'OBJ-0082',
  },
  {
    id: 'mist-stone-sea',
    title: 'Mist / Stone / Sea',
    section: 'photography',
    tags: ['coastal', 'documentary', 'mist', 'rocks', 'sea'],
    description:
      'Documentary captures of coastal rock, tide, and fog — where wet surfaces, muted horizons, and sea mist reduce the landscape to texture and atmosphere.',
    year: '2026',
    posterUrl: '/assets/photos/mist-stone-sea/photo-0.png',
    mobilePosterUrl: '/assets/photos/mist-stone-sea/photo-0.png',
    galleryAudio: '/assets/audio/mist-stone-sea.mp3',
    gallery: [
      {
        src: '/assets/photos/mist-stone-sea/photo-0.png',
        caption:
          'Rocky Shore at First Light — Mist drifts across a wet stone shoreline as the sea settles into a quiet gray horizon.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-1.png',
        caption:
          'Mist Cliffs — Layered sea cliffs recede into fog, where rock, surf, and sky dissolve into the same cold atmosphere.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-2.png',
        caption:
          'Pebble Beach in Fog — A rain-darkened pebble beach stretches toward the water, its scattered boulders fading into coastal mist.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-3.png',
        caption:
          'Tidal Pools — Black shoreline rocks hold still pools of water, reflecting the pale sky while waves break softly beyond.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-4.png',
        caption:
          'Fog Jetty — A stone breakwater disappears into dense sea fog, turning distance into a quiet line of uncertainty.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-5.png',
        caption:
          'Coastal Outcrop — Wet rock, dry grass, and low mist mark the edge of land before it falls into the gray sea.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-6.png',
        caption:
          'Foam and Stone — Sea foam moves through dark shoreline rocks, tracing the shape of the coast in soft white lines.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-7.png',
        caption:
          'Fog Island — A distant rock island emerges through the mist, barely separating itself from the muted sea and sky.',
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-8.png',
        caption:
          "Layered Rock Ledge — Flat sedimentary stones hold rainwater at the ocean's edge, revealing the coast as a weathered geological surface.",
      },
      {
        src: '/assets/photos/mist-stone-sea/photo-9.png',
        caption:
          'Blue-Gray Cove — Rounded shoreline stones disappear into blue-gray mist, where the surf softens every edge of the coast.',
      },
    ],
    archiveId: 'OBJ-0083',
  },
  {
    id: 'below-the-last-light',
    title: 'Below the Last Light',
    section: 'photography',
    tags: ['octopus', 'underwater', 'ruins', 'documentary', 'shipwreck', 'sea', 'wreck'],
    description:
      'A solitary octopus moves through deep, half-forgotten spaces beneath the sea — shipwrecks, drowned halls, broken arches, and silent ruins touched only by faint shafts of light.',
    year: '2026',
    posterUrl: '/assets/photos/below-the-last-light/photo-0.png',
    mobilePosterUrl: '/assets/photos/below-the-last-light/photo-0.png',
    galleryAudio: '/assets/audio/below-the-last-light.mp3',
    gallery: [
      {
        src: '/assets/photos/below-the-last-light/photo-0.png',
        caption:
          'Arch in the Gloom — A lone octopus crosses the silted floor of a drowned ruin, moving beneath a broken arch where the last pale light still reaches.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-1.png',
        caption:
          'Sunken Corridor — Through the narrow passage of a flooded wreck, the octopus disappears into blue darkness as if following a memory deeper inside.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-2.png',
        caption:
          'Ruin Sentinel — Resting on a stone pedestal, the octopus seems less like an animal and more like a quiet keeper of the submerged hall.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-3.png',
        caption:
          'Crevice Search — Pressed against the rock wall, the octopus explores a dark seam in the stone, searching for whatever the ruins still conceal.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-4.png',
        caption:
          'Wreck Shadow — Suspended beside the sunken ship, the octopus drifts in open water, small against the weight and silence of the wreck.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-5.png',
        caption:
          'Stair of Return — Climbing the drowned staircase, the octopus moves upward through drifting particles and thin beams of light, as if ascending into another forgotten chamber.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-6.png',
        caption:
          'Chamber of Light — In the center of a vast underwater hall, the octopus becomes a small living mark beneath a single shaft of light.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-7.png',
        caption:
          'Carved Passage — Along the wall of an ancient submerged corridor, the octopus lies low against the stone, blending with the ruin as if it belongs there.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-8.png',
        caption:
          'Mosaic Threshold — Beside broken mosaic floors and worn steps, the octopus explores the edge of a buried room where the past still clings to the walls.',
      },
      {
        src: '/assets/photos/below-the-last-light/photo-9.png',
        caption:
          'Fallen Figure — Half-hidden among columns and broken statues, the octopus peers out from the rubble like a witness to a world long drowned.',
      },
    ],
    archiveId: 'OBJ-0140',
  },
  {
    id: 'celestial-current',
    title: 'Celestial Current',
    section: 'photography',
    tags: ['manta ray', 'space', 'surreal', 'minimal', 'cosmos', 'nebula', 'planets'],
    description:
      'A surreal minimal series following a manta ray adrift through space — crossing planets, rings, ruins, dust, and silence like a creature swimming through the dark between worlds.',
    year: '2026',
    posterUrl: '/assets/photos/celestial-current/photo-0.png',
    mobilePosterUrl: '/assets/photos/celestial-current/photo-0.png',
    galleryAudio: '/assets/audio/celestial-current.mp3',
    gallery: [
      {
        src: '/assets/photos/celestial-current/photo-0.png',
        caption:
          'Space Glide — A solitary manta ray drifts across open space, passing beneath a distant planet like a creature following an invisible current.',
      },
      {
        src: '/assets/photos/celestial-current/photo-1.png',
        caption:
          'Far Crossing — Small against the scale of the cosmos, the manta becomes a quiet mark moving through vast emptiness.',
      },
      {
        src: '/assets/photos/celestial-current/photo-2.png',
        caption:
          'Ascension Beam — Caught inside a pale shaft of light, the manta rises as if drawn upward through a celestial tide.',
      },
      {
        src: '/assets/photos/celestial-current/photo-3.png',
        caption:
          "Eclipse Passage — The ray crosses a dark planet's halo, turning for a moment into a silhouette between light and shadow.",
      },
      {
        src: '/assets/photos/celestial-current/photo-4.png',
        caption:
          'Monolith Encounter — Suspended before a silent black monolith, the manta seems to pause in recognition of something ancient and unknown.',
      },
      {
        src: '/assets/photos/celestial-current/photo-5.png',
        caption:
          "Beneath the Rings — Gliding below a ringed giant, the manta moves like a living echo of the planet's curved geometry.",
      },
      {
        src: '/assets/photos/celestial-current/photo-6.png',
        caption:
          'Direct Approach — Facing the viewer in open space, the manta appears less like an animal and more like a calm intelligence from another realm.',
      },
      {
        src: '/assets/photos/celestial-current/photo-7.png',
        caption:
          'Lunar Drift — Above a barren moonlit landscape, the manta floats through cold night air as if the laws of gravity no longer apply.',
      },
      {
        src: '/assets/photos/celestial-current/photo-8.png',
        caption:
          'Starfoam — Surrounded by fields of glowing particles, the manta swims through light as though space itself had become an ocean.',
      },
      {
        src: '/assets/photos/celestial-current/photo-9.png',
        caption:
          'Nebula Current — Against dark nebula clouds, the manta cuts a clean path through the slow weather of the cosmos.',
      },
    ],
    archiveId: 'OBJ-0142',
  },
  {
    id: 'the-black-witness-score',
    title: 'The Black Witness',
    section: 'music',
    tags: ['ambient', 'documentary', 'field recording', 'raven'],
    description:
      'Cross-world raven study — city rain, forest fog, mountain stone, and coastal mist woven into a single ambient field layer.',
    year: '2023',
    audioUrl: '/assets/audio/the-black-witness.mp3',
    posterUrl: '/assets/photos/the-black-witness/photo-0.png',
    mobilePosterUrl: '/assets/photos/the-black-witness/photo-0.png',
    archiveId: 'OBJ-0096',
  },
  {
    id: 'between-wild-and-wire-score',
    title: 'Between Wild and Wire',
    section: 'music',
    tags: ['ambient', 'documentary', 'field recording', 'fox', 'urban', 'forest'],
    description:
      'Forest edge to city underpass and back — habitat crossing woven into a single ambient field layer for the fox journey.',
    year: '2026',
    audioUrl: '/assets/audio/between-wild-and-wire.mp3',
    posterUrl: '/assets/photos/between-wild-and-wire/photo-0.png',
    mobilePosterUrl: '/assets/photos/between-wild-and-wire/photo-0.png',
    archiveId: 'OBJ-0097',
  },
  {
    id: 'concrete-light-score',
    title: 'Concrete after dark',
    section: 'music',
    tags: ['ambient', 'architecture', 'rain'],
    description:
      'Rain-darkened brutalist soundscape — distant neon hum, wet concrete resonance, and slow urban drift for gallery and walkthrough beds.',
    year: '2024',
    audioUrl: '/assets/audio/concrete-light.mp3',
    posterUrl: '/assets/photos/concrete-after-dark/photo-0.png',
    mobilePosterUrl: '/assets/photos/concrete-after-dark/photo-0.png',
    archiveId: 'OBJ-0090',
  },
  {
    id: 'night-grid-score',
    title: 'Night Grid',
    section: 'music',
    tags: ['ambient', 'urban', 'night'],
    description:
      'Sodium vapor and window-grid ambience — modular pulses, wet pavement reflections, and long-exposure city haze.',
    year: '2023',
    audioUrl: '/assets/audio/night-grid.mp3',
    posterUrl: '/assets/photos/night-grid/photo-0.png',
    mobilePosterUrl: '/assets/photos/night-grid/photo-0.png',
    archiveId: 'OBJ-0094',
  },
  {
    id: 'mist-stone-sea-score',
    title: 'Mist / Stone / Sea',
    section: 'music',
    tags: ['ambient', 'coastal', 'field recording'],
    description:
      'Coastal field layer — tide wash, fog-damped rock, and muted horizon tones for documentary and spatial experiences.',
    year: '2026',
    audioUrl: '/assets/audio/mist-stone-sea.mp3',
    posterUrl: '/assets/photos/mist-stone-sea/photo-0.png',
    mobilePosterUrl: '/assets/photos/mist-stone-sea/photo-0.png',
    archiveId: 'OBJ-0095',
  },
  {
    id: 'below-the-last-light-score',
    title: 'Below the Last Light',
    section: 'music',
    tags: ['ambient', 'underwater', 'field recording', 'octopus', 'ruins', 'shipwreck'],
    description:
      'Submerged ruin ambience — drowned halls, faint light shafts, and the slow drift of a solitary octopus through half-forgotten spaces beneath the sea.',
    year: '2026',
    audioUrl: '/assets/audio/below-the-last-light.mp3',
    posterUrl: '/assets/photos/below-the-last-light/photo-0.png',
    mobilePosterUrl: '/assets/photos/below-the-last-light/photo-0.png',
    archiveId: 'OBJ-0141',
  },
  {
    id: 'celestial-current-score',
    title: 'Celestial Current',
    section: 'music',
    tags: ['ambient', 'space', 'cosmos', 'manta ray', 'surreal', 'field recording'],
    description:
      'Cosmic drift ambience — open silence, distant planetary hum, and the slow glide of a manta ray adrift through the dark between worlds.',
    year: '2026',
    audioUrl: '/assets/audio/celestial-current.mp3',
    posterUrl: '/assets/photos/celestial-current/photo-0.png',
    mobilePosterUrl: '/assets/photos/celestial-current/photo-0.png',
    archiveId: 'OBJ-0143',
  },
  {
    id: 'artist-globe',
    title: 'Artist Globe',
    section: '3d',
    tags: ['webgl', 'three.js', 'globe', 'artists', 'map', 'portfolio'],
    description:
      'Interactive WebGL globe of photographers, painters, sculptors, sound artists, and more — filter by practice, open portfolios, highlight countries, and submit a profile for review.',
    year: '2026',
    url: '/artist-globe',
    embedUrl: '/artist-globe?embed=1',
    posterUrl: '/assets/posters/artist-globe.jpg?v=20260717-3',
    mobilePosterUrl: '/assets/posters/artist-globe.jpg?v=20260717-3',
    thumbnail: '/assets/posters/artist-globe.jpg?v=20260717-3',
    featured: true,
    archiveId: 'OBJ-0150',
  },
  {
    id: 'ssr-denoise',
    title: 'Art Gallery Space — WebGPU SSR + Denoise',
    section: '3d',
    tags: ['webgpu', 'ssr', 'denoise', 'three.js', 'postprocessing'],
    description:
      'WebGPU real-time rendering of screen-space reflections with spatiotemporal denoising — load custom GLTF/FBX models, swap HDR/EXR panoramas, explore in third-person walk mode, and compare raw vs denoised reflections.',
    year: '2026',
    url: '/demos/ssr-denoise/',
    embedUrl: '/demos/ssr-denoise/',
    posterUrl: '/assets/posters/ssr-denoise.jpg?v=20260708',
    mobilePosterUrl: '/assets/posters/ssr-denoise.jpg?v=20260708',
    sourceUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html',
    referenceUrls: [
      {
        label: 'Additive skinning',
        url: 'https://threejs.org/examples/#webgl_animation_skinning_additive_blending',
      },
    ],
    archiveId: 'OBJ-0124',
  },
  {
    id: 'iom-three',
    title: 'Dream — Ocean scroll narrative',
    section: '3d',
    tags: ['webgl', 'water', 'scroll', 'narrative', 'canvas', 'audio', 'sky', 'clouds', 'day/night', 'creative'],
    description:
      'Scroll narrative through still dark water, rain, distant land, and shore (procedural distortion with optional ambient audio crossfade), standalone weather runtime (dynamic sky, cloud layers, day/night sync), and shader-driven surface studies. Chapter 1 of 9 · work in progress.',
    year: '2025–26',
    url: '/demos/dreams-iom/',
    embedUrl: '/demos/dreams-iom/',
    posterUrl: '/assets/posters/iom-three.jpg',
    mobilePosterUrl: '/assets/posters/iom-three.jpg',
    archiveId: 'OBJ-0017',
  },
  {
    id: 'volume-lighting',
    title: 'Volumetric Lighting — Rect Area',
    section: '3d',
    tags: ['webgpu', 'lighting', 'camera', 'import', 'scene', 'three.js'],
    description:
      'Record camera views, move lights, and test lighting on different objects — import your own GLB, GLTF, or FBX (replaces the stock car). WebGPU volumetric lighting with rect area lights.',
    year: '2026',
    url: '/demos/volume-lighting/',
    embedUrl: '/demos/volume-lighting/',
    posterUrl: '/assets/posters/volume-lighting.jpg?v=20260709-2',
    mobilePosterUrl: '/assets/posters/volume-lighting.jpg?v=20260709-2',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_volume_lighting_rectarea.html',
    referenceUrls: [
      {
        label: 'Volumetric lighting rect area',
        url: 'https://threejs.org/examples/#webgpu_volume_lighting_rectarea',
      },
    ],
    archiveId: 'OBJ-0129',
  },
  {
    id: 'threejs-ocean',
    title: 'Three.js Ocean',
    section: '3d',
    tags: ['webgl', 'shader', 'three.js', 'water'],
    description:
      'Gerstner-wave ocean with procedural sky and sunset preset — glass 3D text with Google Fonts, decorative icons, wallpaper screenshots, or up to 30 seconds of WebGL video export.',
    year: '2026',
    url: '/demos/ocean/',
    embedUrl: '/demos/ocean/',
    posterUrl: '/assets/posters/ocean.jpg?v=20260719b',
    mobilePosterUrl: '/assets/posters/ocean.jpg?v=20260719b',
    sourceUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html',
    archiveId: 'OBJ-0120',
  },
  {
    id: 'css3d-sprites',
    title: 'CSS3D Sprites',
    section: 'experiments',
    tags: ['css3d', 'three.js', 'sprites', 'motion'],
    description:
      '512 HTML sprites arranged in 3D space with CSS3DRenderer — morphing transitions between plane, cube, random cloud, and sphere formations with pulsing scale animation.',
    year: '2026',
    url: '/demos/css3d-sprites/',
    embedUrl: '/demos/css3d-sprites/',
    posterUrl: '/assets/posters/css3d-sprites.png',
    mobilePosterUrl: '/assets/posters/css3d-sprites.png',
    sourceUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html',
    archiveId: 'OBJ-0125',
  },
  {
    id: 'compute-particles',
    title: 'Shape Particles — WebGPU Compute',
    section: 'experiments',
    tags: ['webgpu', 'compute', 'particles', 'physics', 'tsl', 'three.js'],
    description:
      'GPU compute particles arranged into shape presets — cube, sphere, torus, cone, pyramid, ring, and heart. Press Release to drop them under gravity with floor bounce, then Reset to reform the formation.',
    year: '2026',
    url: '/demos/compute-particles/',
    embedUrl: '/demos/compute-particles/',
    posterUrl: '/assets/posters/compute-particles.jpg?v=20260709',
    mobilePosterUrl: '/assets/posters/compute-particles.jpg?v=20260709',
    sourceUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html',
    referenceUrls: [
      {
        label: 'Compute particles',
        url: 'https://threejs.org/examples/#webgpu_compute_particles',
      },
    ],
    archiveId: 'OBJ-0128',
  },
  {
    id: 'webgpu-spotlight',
    title: 'WebGPU Spotlight',
    section: 'experiments',
    tags: ['webgpu', 'lighting', 'spotlight', 'shadows', 'three.js'],
    description:
      'WebGPU spot light projecting texture maps onto a scene — orbiting animated spotlight with penumbra, decay, shadow focus, and optional light helpers. Lucy PLY model on a shadow-receiving ground plane.',
    year: '2026',
    url: '/demos/webgpu-spotlight/',
    embedUrl: '/demos/webgpu-spotlight/',
    posterUrl: '/assets/posters/webgpu-spotlight.jpg?v=2026071018',
    mobilePosterUrl: '/assets/posters/webgpu-spotlight.jpg?v=2026071018',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html',
    referenceUrls: [
      {
        label: 'WebGPU spotlight',
        url: 'https://threejs.org/examples/#webgpu_lights_spotlight',
      },
    ],
    archiveId: 'OBJ-0131',
  },
  {
    id: 'webgpu-compute-birds',
    title: 'WebGPU Compute Birds',
    section: 'experiments',
    tags: ['webgpu', 'compute', 'flocking', 'instancing', 'three.js'],
    description:
      'GPU flocking simulation with 8,192 instanced birds — separation, alignment, and cohesion forces computed on the GPU. Move the mouse to disturb the flock; tune behavior in Birds settings.',
    year: '2026',
    url: '/demos/webgpu-compute-birds/',
    embedUrl: '/demos/webgpu-compute-birds/',
    posterUrl: '/assets/posters/webgpu-compute-birds.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-compute-birds.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html',
    referenceUrls: [
      {
        label: 'WebGPU compute birds',
        url: 'https://threejs.org/examples/#webgpu_compute_birds',
      },
    ],
    archiveId: 'OBJ-0133',
  },
  {
    id: 'webgpu-parallax-uv',
    title: 'WebGPU Parallax UV',
    section: 'experiments',
    tags: ['webgpu', 'materials', 'parallax', 'tsl', 'three.js'],
    description:
      'TSL parallax UV mapping on an ice ground plane — layered ambientCG textures with displacement-driven offset, overlay blending, normal and roughness maps, and HDR environment lighting.',
    year: '2026',
    url: '/demos/webgpu-parallax-uv/',
    embedUrl: '/demos/webgpu-parallax-uv/',
    posterUrl: '/assets/posters/webgpu-parallax-uv.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-parallax-uv.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html',
    referenceUrls: [
      {
        label: 'WebGPU parallax UV',
        url: 'https://threejs.org/examples/#webgpu_parallax_uv',
      },
    ],
    archiveId: 'OBJ-0134',
  },
  {
    id: 'webgpu-tsl-raging-sea',
    title: 'WebGPU TSL Raging Sea',
    section: 'experiments',
    tags: ['webgpu', 'tsl', 'procedural', 'ocean', 'waves', 'three.js'],
    description:
      'Procedural ocean surface with TSL wave displacement — layered large sine waves plus fractal noise, computed normals, and emissive crest highlights on a high-resolution plane mesh.',
    year: '2026',
    url: '/demos/webgpu-tsl-raging-sea/',
    embedUrl: '/demos/webgpu-tsl-raging-sea/',
    posterUrl: '/assets/posters/webgpu-tsl-raging-sea.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-tsl-raging-sea.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html',
    referenceUrls: [
      {
        label: 'WebGPU TSL raging sea',
        url: 'https://threejs.org/examples/#webgpu_tsl_raging_sea',
      },
      {
        label: 'Three.js Journey — raging sea',
        url: 'https://threejs-journey.com/lessons/raging-sea',
      },
    ],
    archiveId: 'OBJ-0135',
  },
  {
    id: 'webgpu-tsl-linked-particles',
    title: 'WebGPU TSL Linked Particles',
    section: 'experiments',
    tags: ['webgpu', 'compute', 'particles', 'tsl', 'vfx', 'three.js'],
    description:
      'TSL VFX particle sketch with GPU compute spawning, turbulence, nearest-neighbor link ribbons, hue rotation, and bloom post-processing. Move the pointer to draw connected particle trails.',
    year: '2026',
    url: '/demos/webgpu-tsl-linked-particles/',
    embedUrl: '/demos/webgpu-tsl-linked-particles/',
    posterUrl: '/assets/posters/webgpu-tsl-linked-particles.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-tsl-linked-particles.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html',
    referenceUrls: [
      {
        label: 'WebGPU TSL VFX linked particles',
        url: 'https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles',
      },
    ],
    archiveId: 'OBJ-0136',
  },
  {
    id: 'webgpu-custom-fog-scattering',
    title: 'WebGPU Custom Fog Scattering',
    section: 'experiments',
    tags: ['webgpu', 'fog', 'scattering', 'tsl', 'procedural', 'three.js'],
    description:
      'Procedural pine forest silhouettes in exponential fog with TSL density-based scattering blur — first-person walk through a cool haze with tunable fog density and scattering factor.',
    year: '2026',
    url: '/demos/webgpu-custom-fog-scattering/',
    embedUrl: '/demos/webgpu-custom-fog-scattering/',
    posterUrl: '/assets/posters/webgpu-custom-fog-scattering.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-custom-fog-scattering.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html',
    referenceUrls: [
      {
        label: 'WebGPU custom fog scattering',
        url: 'https://threejs.org/examples/#webgpu_custom_fog_scattering',
      },
    ],
    archiveId: 'OBJ-0137',
  },
  {
    id: 'webgpu-modifier-curve',
    title: 'WebGPU Curve Modifier',
    section: 'experiments',
    tags: ['webgpu', 'modifiers', 'curves', 'geometry', 'three.js'],
    description:
      'GPU curve modifier deforming extruded text along a closed Catmull-Rom spline — click control handles to select, drag to reshape the path, and watch the mesh flow along the curve.',
    year: '2026',
    url: '/demos/webgpu-modifier-curve/',
    embedUrl: '/demos/webgpu-modifier-curve/',
    posterUrl: '/assets/posters/webgpu-modifier-curve.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-modifier-curve.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html',
    referenceUrls: [
      {
        label: 'WebGPU curve modifier',
        url: 'https://threejs.org/examples/#webgpu_modifier_curve',
      },
    ],
    archiveId: 'OBJ-0138',
  },
  {
    id: 'webgpu-particles',
    title: 'WebGPU Particles',
    section: 'experiments',
    tags: ['webgpu', 'particles', 'vfx', 'tsl', 'sprites', 'three.js'],
    description:
      'Fire and smoke instanced sprites with TSL node materials — animated life cycles, rotating smoke texture sampling, and additive fire blending over a grid ground plane.',
    year: '2026',
    url: '/demos/webgpu-particles/',
    embedUrl: '/demos/webgpu-particles/',
    posterUrl: '/assets/posters/webgpu-particles.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/webgpu-particles.jpg?v=20260710',
    sourceUrl: 'https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html',
    referenceUrls: [
      {
        label: 'WebGPU particles',
        url: 'https://threejs.org/examples/#webgpu_particles',
      },
    ],
    archiveId: 'OBJ-0139',
  },
  {
    id: 'buffergeometry-drawrange',
    title: 'BufferGeometry Draw Range',
    section: 'experiments',
    tags: ['webgl', 'buffergeometry', 'particles', 'lines', 'three.js'],
    description:
      'Particle network with dynamic line segments — uses BufferGeometry.setDrawRange() to render only active particles and proximity connections, with tunable count, distance, and connection limits.',
    year: '2026',
    url: '/demos/buffergeometry-drawrange/',
    embedUrl: '/demos/buffergeometry-drawrange/',
    posterUrl: '/assets/posters/buffergeometry-drawrange.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/buffergeometry-drawrange.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html',
    referenceUrls: [
      {
        label: 'BufferGeometry draw range',
        url: 'https://threejs.org/examples/#webgl_buffergeometry_drawrange',
      },
    ],
    archiveId: 'OBJ-0132',
  },
  {
    id: 'spline-editor',
    title: 'Catmull Spline Editor',
    section: 'experiments',
    tags: ['webgl', 'geometry', 'spline', 'curves', 'three.js'],
    description:
      'Interactive Catmull-Rom spline editor — drag control points with transform gizmos, compare uniform, centripetal, and chordal curve types, tune tension, and export Vector3 arrays for paths and camera rails.',
    year: '2026',
    url: '/demos/spline-editor/',
    embedUrl: '/demos/spline-editor/',
    posterUrl: '/assets/posters/spline-editor.jpg?v=20260710',
    mobilePosterUrl: '/assets/posters/spline-editor.jpg?v=20260710',
    sourceUrl:
      'https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html',
    referenceUrls: [
      {
        label: 'Spline editor',
        url: 'https://threejs.org/examples/#webgl_geometry_spline_editor',
      },
    ],
    archiveId: 'OBJ-0130',
  },
  {
    id: 'terrain-sandbox',
    title: 'Terrain Sandbox',
    section: 'experiments',
    tags: ['webgl', 'terrain', 'procedural', 'three.js', 'sandbox'],
    description:
      'Create procedural 3D terrain from layered noise, then place trees, rocks, and markers on the surface. Orbit, regenerate seed, tune height and roughness — a sandbox MVP toward sculpt brushes, GLTF import, and optional MapTiler real-world DEM.',
    year: '2026',
    url: '/demos/terrain-sandbox/',
    embedUrl: '/demos/terrain-sandbox/',
    posterUrl: '/assets/posters/terrain-sandbox.jpg?v=20260709',
    mobilePosterUrl: '/assets/posters/terrain-sandbox.jpg?v=20260709',
    archiveId: 'OBJ-0127',
  },
  {
    id: 'procedural-gl',
    title: 'Procedural GL Terrain',
    section: 'experiments',
    tags: ['webgl', 'terrain', 'maps', 'three.js', 'open-source'],
    description:
      'Interactive 3D real-world terrain viewer via procedural-gl.js (MPL-2.0) — GPU LOD landscapes streamed from map tiles. First step embeds the official demo; a self-hosted MapTiler-backed build can follow (API key stays out of the repo).',
    year: '2026',
    url: '/demos/procedural-gl/',
    embedUrl: 'https://www.procedural.eu/map/',
    posterUrl: '/assets/posters/procedural-gl.jpg?v=20260709',
    mobilePosterUrl: '/assets/posters/procedural-gl.jpg?v=20260709',
    sourceUrl: 'https://github.com/felixpalmer/procedural-gl-js',
    referenceUrls: [
      {
        label: 'Docs',
        url: 'https://www.procedural.eu/',
      },
    ],
    archiveId: 'OBJ-0126',
  },
  {
    id: 'spout',
    title: 'Spout',
    section: 'experiments',
    tags: ['webgl', 'shader', 'shadertoy', 'raymarch', 'water', 'refraction'],
    description:
      'Raymarched pipe water with refraction, transparency, and reflections — drag to orbit. Self-hosted WebGL2 port of P_Malin’s classic Shadertoy experiment.',
    year: '2026',
    url: '/demos/spout/',
    embedUrl: '/demos/spout/',
    posterUrl: '/assets/posters/spout.jpg?v=20260714-2',
    mobilePosterUrl: '/assets/posters/spout.jpg?v=20260714-2',
    sourceUrl: 'https://www.shadertoy.com/view/lsXGzH',
    referenceUrls: [
      {
        label: 'Shadertoy — Spout',
        url: 'https://www.shadertoy.com/view/lsXGzH',
      },
      {
        label: 'Author — P_Malin',
        url: 'https://www.shadertoy.com/user/P_Malin',
      },
    ],
    archiveId: 'OBJ-0148',
  },
]

export function projectsForSection(section: ProjectSection): Project[] {
  return PROJECTS.filter((p) => p.section === section)
}

export function featuredProjects(): Project[] {
  return PROJECTS.filter((p) => p.featured)
}
