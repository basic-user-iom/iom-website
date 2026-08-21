const g = globalThis as typeof globalThis & { self: typeof globalThis; window: typeof globalThis; document: unknown }
g.self = globalThis
g.window = globalThis
g.document = {
  createElementNS: () => ({ width: 0, height: 0, getContext: () => null }),
  createElement: () => ({ width: 0, height: 0, getContext: () => null, style: {} }),
}
const { readFileSync } = await import('node:fs')
const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
const buf = readFileSync('F:/iom_website/automotive-studio/_dev/lixiang-mobile-rigged.glb')
const loader = new GLTFLoader()
const gltf = await new Promise((res, rej) => {
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
})
for (const name of [
  'GeometryNode_664',
  'GeometryNode_759',
  'GeometryNode_995',
  'GeometryNode_922',
  'GeometryNode_979',
  'GeometryNode_878',
]) {
  const m = gltf.scene.getObjectByName(name) as { isMesh?: boolean; material?: any } | undefined
  if (!m?.isMesh) {
    console.log(name, 'MISSING')
    continue
  }
  const mat = Array.isArray(m.material) ? m.material[0] : m.material
  console.log(
    name,
    `mat=${mat.name}`,
    `color=#${mat.color.getHexString()}`,
    `em=#${mat.emissive.getHexString()}`,
    `emi=${mat.emissiveIntensity}`,
    `metal=${mat.metalness}`,
    `rough=${mat.roughness}`,
    `map=${Boolean(mat.map)}`,
    `emap=${Boolean(mat.emissiveMap)}`,
    `trans=${mat.transmission ?? 0}`,
    `opacity=${mat.opacity}`,
    `transparent=${mat.transparent}`,
  )
}
