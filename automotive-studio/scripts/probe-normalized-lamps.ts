/**
 * Bind after studio-like normalize; list indicator targets + sizes.
 */
const g = globalThis as typeof globalThis & { self: typeof globalThis; window: typeof globalThis; document: unknown }
g.self = globalThis
g.window = globalThis
g.document = {
  createElementNS: () => ({ width: 0, height: 0, getContext: () => null }),
  createElement: () => ({ width: 0, height: 0, getContext: () => null, style: {} }),
}

const { readFileSync } = await import('node:fs')
const { Box3, Vector3 } = await import('three')
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
const { createDefaultVehicleLights } = await import('../src/persistence/schema.ts')
const { VehicleLightsController, isCabinWindowMesh } = await import('../src/vehicle/vehicleLights.ts')
const { polishVehicleMaterials } = await import('../src/renderer/polishVehicleMaterials.ts')
const {
  createVehicleRoots,
  applyNormalization,
  inferNormalization,
} = await import('../src/vehicle/normalizeVehicle.ts')

const buf = readFileSync('F:/iom_website/automotive-studio/_dev/lixiang-mobile-rigged.glb')
const loader = new GLTFLoader()
const gltf = await new Promise((res, rej) => {
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
})

polishVehicleMaterials(gltf.scene)
const roots = createVehicleRoots(gltf.scene)
const settings =
  typeof inferNormalization === 'function'
    ? inferNormalization(gltf.scene)
    : {
        targetLengthMetres: 5.1,
        uniformScale: 1,
        forwardAxis: '+z',
        upAxis: '+y',
        groundOffsetMetres: 0,
        flip180: false,
      }
applyNormalization(roots, settings as never)

const lights = new VehicleLightsController()
lights.bind(roots.placement)
const state = createDefaultVehicleLights()
state.beamProxies = []
lights.apply(state)

console.log('counts', lights.getBoundCounts())
console.log('\nIndicator / tail / brake targets:')
for (const t of lights.getBoundTargets()) {
  if (!/indicator|tail|brake|hazard/i.test(t.groupId)) continue
  const mesh = roots.placement.getObjectByName(t.meshName) as any
  let size = '?'
  let cabin = '?'
  if (mesh?.isMesh) {
    const s = new Box3().setFromObject(mesh).getSize(new Vector3())
    size = `${s.x.toFixed(2)}x${s.y.toFixed(2)}x${s.z.toFixed(2)}`
    cabin = String(isCabinWindowMesh(mesh))
  }
  console.log(`  ${t.groupId.padEnd(14)} ${t.meshName.padEnd(18)} ${t.materialName.padEnd(12)} size=${size} cabinWindow=${cabin}`)
}
