import type { CameraPreset, Hotspot, StoryItem, Vec3 } from './types'

/**
 * All product copy, camera language and feature flags live here.
 * Replace `Watch.glb` with a real product file and update this file —
 * the viewer shell does not need to be rebuilt around new claims.
 */
export const EXPLORE_CUE_ID = 'explore-cue'

export const PRODUCT = {
  modelUrl: '/models/Watch.glb',
  /** Default evening-sky EXR (Look studio HDR option 4). */
  envUrl: '/env/EveningSkyHDRI027B_2K_HDR.exr',
  /** AmbientCG Metal049A — stand PBR (OpenGL normal). */
  pbrMaps: {
    color: '/textures/metal049a/Color.jpg',
    roughness: '/textures/metal049a/Roughness.jpg',
    metalness: '/textures/metal049a/Metalness.jpg',
    normal: '/textures/metal049a/NormalGL.jpg',
    displacement: '/textures/metal049a/Displacement.jpg',
  },
  /**
   * Default watch metal PBR: Metal049A albedo / roughness / metalness plus
   * AmbientCG Metal060A DirectX normal (green inverted to OpenGL on load).
   */
  watchPbrMaps: {
    color: '/textures/metal049a/Color.jpg',
    roughness: '/textures/metal049a/Roughness.jpg',
    metalness: '/textures/metal049a/Metalness.jpg',
    normal: '/textures/metal060a/NormalDX.jpg',
  },
  /** AmbientCG Metal048A — gold dial PBR (DirectX normal, green inverted on load). */
  goldPbrMaps: {
    color: '/textures/gold/Color.jpg',
    roughness: '/textures/gold/Roughness.jpg',
    metalness: '/textures/gold/Metalness.jpg',
    normal: '/textures/gold/NormalDX.jpg',
    displacement: '/textures/gold/Displacement.jpg',
  },
  modelTitle: 'Precision object study',
  eyebrow: 'Interactive product study',
  heroTitle: 'Precision, seen from every angle.',
  heroLead:
    'A browser-based product presentation concept for products where material, mechanism and detail matter.',
  primaryAction: 'Explore the object',
  exploreCueHint: 'Click to explore',
  exploreCueHintTouch: 'Tap to explore',
  secondaryAction: 'View details',
  /**
   * Second-screen floating label (not the hero). Offset from the model
   * center as a bbox fraction, same convention as HOTSPOTS.
   */
  exploreCue: {
    position: [-0.48, 0.62, 0.32] as Vec3,
  },
  ctaTitle: 'What if your product could be explored, not only photographed?',
  ctaAction: 'Discuss an interactive product presentation',
  ctaHref: 'https://iobjectm.com/',
  instructionMouse: 'Drag to rotate · Scroll to zoom',
  instructionTouch: 'Drag to rotate · Pinch to zoom',
  missingModel:
    'The object file was not found at /models/Watch.glb. Place the GLB there to load the study.',
  loadError: 'The object could not be loaded. Check the model file and try again.',
  /**
   * Extra Euler rotation applied after centering, in radians.
   * Tune this if a replacement model faces the wrong way.
   */
  modelRotation: [0, 0, 0] as Vec3,
  /**
   * Named meshes to separate in exploded view. Leave empty unless the GLB
   * has true mechanical parts — material splits should not be pulled apart.
   */
  explodePartNames: [] as string[],
  explodeDistance: 0.22,
  targetSize: 1.18,
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'hero',
    direction: [0.62, 0.78, 0.52],
    targetOffset: [0.04, 0.06, 0],
    distanceMul: 1.12,
    fov: 28,
  },
  {
    id: 'front',
    direction: [0.18, 0.22, 1],
    targetOffset: [0, 0.02, 0],
    distanceMul: 1.05,
    fov: 32,
  },
  {
    id: 'detail',
    direction: [0.95, 0.18, 0.42],
    targetOffset: [0.22, 0.04, 0.08],
    distanceMul: 0.62,
    fov: 30,
  },
  {
    id: 'top',
    direction: [0.12, 1, 0.28],
    targetOffset: [0, 0.08, 0],
    distanceMul: 1.08,
    fov: 32,
  },
]

export const HOTSPOTS: Hotspot[] = [
  {
    id: 'surface',
    label: '01',
    title: 'Surface finish',
    body: 'Light rakes across the outer form so polish, edge quality and material response can be read without leaving the page.',
    position: [-0.501, 0.281, 0.734],
    cameraPreset: 'front',
  },
  {
    id: 'mechanical',
    label: '02',
    title: 'Mechanical detail',
    body: 'Controls and moving parts stay in context. The camera can approach them without breaking the object into a technical diagram.',
    position: [-0.824, -0.017, 0.57],
    cameraPreset: 'detail',
  },
  {
    id: 'interface',
    label: '03',
    title: 'Control interface',
    body: 'The facing surface is framed as a product still — hierarchy, contrast and proportion first, decoration second.',
    position: [-0.894, -0.325, 0.381],
    cameraPreset: 'front',
  },
  {
    id: 'geometry',
    label: '04',
    title: 'Precision geometry',
    body: 'Silhouette and construction lines stay visible from a high angle, the way a designer checks fit, balance and manufacturing intent.',
    position: [-0.009, -0.188, 0.927],
    cameraPreset: 'top',
  },
]

export const STORY: StoryItem[] = [
  {
    id: 'material',
    title: 'Material',
    body: 'Finish is not a texture overlay. It is how metal, glass and darker surfaces take a studio key, a cool fill and a thin rim.',
    actionLabel: 'Study the surface',
    cameraPreset: 'front',
    hotspotId: 'surface',
  },
  {
    id: 'form',
    title: 'Form',
    body: 'The object is framed like a photograph: three-quarter for presence, top for proportion, close for the line that manufacturing has to hold.',
    actionLabel: 'Read the silhouette',
    cameraPreset: 'top',
    hotspotId: 'geometry',
  },
  {
    id: 'mechanism',
    title: 'Mechanism',
    body: 'Where the file contains motion, it can tick in place. Where parts are only material layers, they stay assembled — no fake exploded view.',
    actionLabel: 'Approach the detail',
    cameraPreset: 'detail',
    hotspotId: 'mechanical',
  },
  {
    id: 'output',
    title: 'Output',
    body: 'The same model can serve a landing hero, a guided inspect, and a conversation about what a real product file should let a customer understand.',
    actionLabel: 'Return to the object',
    cameraPreset: 'front',
  },
]
