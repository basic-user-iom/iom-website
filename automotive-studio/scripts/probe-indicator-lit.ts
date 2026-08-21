const g = globalThis as typeof globalThis & { self: typeof globalThis; window: typeof globalThis; document: unknown }
g.self = globalThis
g.window = globalThis
g.document = {
  createElementNS: () => ({ width: 0, height: 0, getContext: () => null }),
  createElement: () => ({ width: 0, height: 0, getContext: () => null, style: {} }),
}
const { readFileSync } = await import('node:fs')
const { Group } = await import('three')
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
const { createDefaultVehicleLights } = await import('../src/persistence/schema.ts')
const { VehicleLightsController } = await import('../src/vehicle/vehicleLights.ts')
const { polishVehicleMaterials } = await import('../src/renderer/polishVehicleMaterials.ts')

const buf = readFileSync('F:/iom_website/automotive-studio/_dev/lixiang-mobile-rigged.glb')
const loader = new GLTFLoader()
const gltf = await new Promise((res, rej) => {
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
})
const root = new Group()
root.add(gltf.scene)
polishVehicleMaterials(gltf.scene)

const lights = new VehicleLightsController()
lights.bind(root)
const state = createDefaultVehicleLights()
state.beamProxies = []
lights.apply(state)

console.log('indicators:', lights.getBoundTargets().filter((t) => t.groupId.startsWith('indicator')))

function show(name: string) {
  const m = gltf.scene.getObjectByName(name) as any
  if (!m?.isMesh) return console.log(name, 'missing')
  const mat = Array.isArray(m.material) ? m.material[0] : m.material
  console.log(
    name,
    `em=#${mat.emissive.getHexString()}`,
    `i=${mat.emissiveIntensity.toFixed(2)}`,
    `color=#${mat.color.getHexString()}`,
    `metal=${mat.metalness.toFixed(2)}`,
    `trans=${(mat.transmission ?? 0).toFixed(2)}`,
    `op=${mat.opacity.toFixed(2)}`,
  )
}

lights.apply({ ...state, groups: { ...state.groups, indicatorLeft: true, indicatorRight: false } })
lights.update(0)
console.log('\n=== Indicator L ===')
show('GeometryNode_995')
show('GeometryNode_759')
show('GeometryNode_664')

lights.apply({ ...state, groups: { ...state.groups, indicatorLeft: false, indicatorRight: true } })
lights.update(0)
console.log('\n=== Indicator R ===')
show('GeometryNode_995')
show('GeometryNode_759')
show('GeometryNode_664')

lights.apply({ ...state, groups: { ...state.groups, hazards: true } })
lights.update(0)
console.log('\n=== Hazards ===')
show('GeometryNode_995')
show('GeometryNode_759')
show('GeometryNode_664')
