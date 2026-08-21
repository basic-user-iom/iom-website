import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three'

const GLASS_NAME = /glass|window|windscreen|windshield|transparent|lens/i
const PAINT_NAME = /paint|body|carpaint|clearcoat|exterior|shell/i
const CHROME_NAME = /chrome|metal|aluminium|aluminum|steel|trim/i
/** Tail/DRL/indicator lenses — must stay emissive-capable, not window transmission. */
const LAMP_GLASS_NAME =
  /\b(red\s*glass|dark\s*glass|front\s*light|tail\s*light|interior\s*light|orange|amber|drl|headlight|head\s*lamp|brake|indicator|blinker|flasher)\b/i

/**
 * Nudge glass/paint/chrome toward product-shot response.
 * Does **not** assign per-material envMap — materials use Scene.environment
 * so environmentIntensity and preset IBL switches stay coherent (audit Phase B).
 */
export function polishVehicleMaterials(root: Object3D) {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat || !(mat as MeshStandardMaterial).isMeshStandardMaterial) continue
      const std = mat as MeshStandardMaterial
      const name = `${std.name || ''} ${mesh.name || ''}`

      // Prefer scene environment over any baked-in envMap from the importer.
      if (std.envMap) {
        std.envMap = null
        std.needsUpdate = true
      }

      // RedGlass / Orange / FrontLight etc. must not get window transmission —
      // that made brake/tail/indicators invisible when emissive was applied.
      if (LAMP_GLASS_NAME.test(name)) continue

      const physical = std as MeshPhysicalMaterial
      const isGlass =
        GLASS_NAME.test(name) ||
        (physical.transmission != null && physical.transmission > 0.05) ||
        (std.transparent && std.opacity < 0.95 && std.metalness < 0.2)

      if (isGlass) {
        std.metalness = Math.min(std.metalness, 0.05)
        std.roughness = Math.min(std.roughness, 0.08)
        std.transparent = true
        if (std.opacity > 0.55) std.opacity = 0.35
        if ('transmission' in physical) {
          physical.transmission = Math.max(physical.transmission ?? 0, 0.85)
          physical.thickness = Math.max(physical.thickness ?? 0, 0.4)
          physical.ior = physical.ior || 1.45
        }
        std.needsUpdate = true
        continue
      }

      if (PAINT_NAME.test(name) || (std.metalness > 0.15 && std.metalness < 0.85 && std.roughness < 0.45)) {
        if ('clearcoat' in physical) {
          physical.clearcoat = Math.max(physical.clearcoat ?? 0, 0.65)
          physical.clearcoatRoughness = Math.min(physical.clearcoatRoughness ?? 1, 0.12)
        }
        // Don't clamp roughness when a roughness map is driving the surface.
        if (!std.roughnessMap) std.roughness = Math.min(std.roughness, 0.38)
        std.needsUpdate = true
        continue
      }

      if (CHROME_NAME.test(name) || std.metalness > 0.85) {
        // Uploaded metalness/roughness maps must stay full-range (scalar 1).
        if (!std.metalnessMap) std.metalness = Math.max(std.metalness, 0.9)
        if (!std.roughnessMap) std.roughness = Math.min(std.roughness, 0.22)
        std.needsUpdate = true
      }
    }
  })
}
