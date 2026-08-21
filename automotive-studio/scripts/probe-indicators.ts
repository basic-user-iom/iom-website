/**
 * Full bind probe for indicators on a GLB (uses same controller as Studio).
 *   npx tsx scripts/probe-indicators.ts [glb]
 */
const g = globalThis as typeof globalThis & {
  self: typeof globalThis
  window: typeof globalThis
  document: unknown
}
g.self = globalThis
g.window = globalThis
g.document = {
  createElementNS: () => ({ width: 0, height: 0, getContext: () => null }),
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => null,
    style: {},
  }),
}

const { readFileSync } = await import('node:fs')
const { resolve } = await import('node:path')
const { Group, MeshStandardMaterial } = await import('three')
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
const { createDefaultVehicleLights } = await import('../src/persistence/schema.ts')
const { VehicleLightsController } = await import('../src/vehicle/vehicleLights.ts')
const { polishVehicleMaterials } = await import('../src/renderer/polishVehicleMaterials.ts')

const glbPath = resolve(
  process.argv[2] || 'F:/iom_website/automotive-studio/_dev/lixiang-mobile-rigged.glb',
)

const buf = readFileSync(glbPath)
const loader = new GLTFLoader()

const gltf = await new Promise((res, rej) => {
  loader.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
    (g) => res(g),
    (e) => rej(e),
  )
})

const root = new Group()
root.name = 'placement'
root.add(gltf.scene)
polishVehicleMaterials(gltf.scene)

const lights = new VehicleLightsController()
lights.bind(root)
const state = createDefaultVehicleLights()
state.beamProxies = []
lights.apply(state)

console.log('Bound counts:', lights.getBoundCounts())
console.log('Indicator targets:')
for (const t of lights.getBoundTargets()) {
  if (t.groupId === 'indicatorLeft' || t.groupId === 'indicatorRight') {
    console.log(`  ${t.groupId.padEnd(14)} mesh=${t.meshName} mat=${t.materialName}`)
  }
}
console.log('All lamp targets:')
for (const t of lights.getBoundTargets()) {
  console.log(`  ${t.groupId.padEnd(14)} mesh=${t.meshName} mat=${t.materialName}`)
}

lights.apply({
  ...state,
  groups: { ...state.groups, indicatorLeft: true, indicatorRight: false, hazards: false },
})
lights.update(0)

const orange = gltf.scene.getObjectByName('GeometryNode_664')
if (orange && 'isMesh' in orange && orange.isMesh) {
  const { Box3, Vector3 } = await import('three')
  const mat = orange.material
  const std = (Array.isArray(mat) ? mat[0] : mat) as InstanceType<typeof MeshStandardMaterial>
  orange.updateWorldMatrix(true, false)
  if (!orange.geometry.boundingBox) orange.geometry.computeBoundingBox()
  const bb = orange.geometry.boundingBox!
  const size = bb.getSize(new Vector3())
  const maxDim =
    Math.max(size.x, size.y, size.z) *
    Math.max(orange.scale.x, orange.scale.y, orange.scale.z)
  const wbox = new Box3().setFromObject(orange)
  console.log('\nOrange debug:')
  console.log('  matName', JSON.stringify(std.name))
  console.log('  localSize', size.toArray().map((n) => +n.toFixed(4)))
  console.log('  maxDim', +maxDim.toFixed(4))
  console.log('  worldCenter', wbox.getCenter(new Vector3()).toArray().map((n) => +n.toFixed(3)))
  console.log('  worldSize', wbox.getSize(new Vector3()).toArray().map((n) => +n.toFixed(3)))
  console.log(
    `  after Ind L: e=${std.emissive.getHexString()} i=${std.emissiveIntensity.toFixed(2)}`,
  )
}
