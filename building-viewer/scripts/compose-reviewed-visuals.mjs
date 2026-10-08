import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { copyToDocument, prune, unpartition } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'

const io = await createGltfIO()
const candidateDir = 'blender-candidates-20261003/'
const report = process.argv[2] === 'exterior' ? JSON.parse(await readFile('../../evidence/visual-composition-v4.json', 'utf8')) : []
const triangleCount = mesh => mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0)
const norm = name => name.replace(/[^a-z0-9]/gi, '').toLowerCase()
await mkdir('integration-assets', { recursive: true })

async function compose(id, input, sha256, patches) {
  const output = `integration-assets/${id}-review-source-v4.glb`
  try { await access(output); throw new Error(`Refusing overwrite: ${output}`) } catch (e) { if (e.code !== 'ENOENT') throw e }
  const bytes = await readFile(input)
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Upstream source changed: ' + input)
  const doc = await io.readBinary(bytes)
  const changes = []
  for (const patch of patches) {
    const candidate = await io.read(candidateDir + patch)
    for (const node of candidate.getRoot().listNodes().filter(n => n.getMesh())) {
      if (patch === 'icm-stairs-visual-candidate.glb' && node.getName() === 'RG_Teil_01') continue
      const matches = doc.getRoot().listNodes().filter(n => norm(n.getName()) === norm(node.getName()) && n.getMesh())
      if (matches.length !== 1) throw new Error(`${node.getName()}: expected one upstream owner, got ${matches.length}`)
      const owner = matches[0], before = owner.getMesh()
      const matrixDelta = Math.max(...owner.getWorldMatrix().map((v, i) => Math.abs(v - node.getWorldMatrix()[i])))
      if (matrixDelta > 0.00002) throw new Error('Transform mismatch: ' + owner.getName() + ' ' + matrixDelta)
      const oldMaterials = before.listPrimitives().map(p => p.getMaterial())
      const copied = copyToDocument(doc, candidate, [node.getMesh()]).get(node.getMesh())
      for (const primitive of copied.listPrimitives()) {
        const material = primitive.getMaterial()
        const compatible = [...new Set(oldMaterials.filter(m => norm(m?.getName() || '') === norm(owner.getName() === 'Rahmen' && material?.getName() === 'm.glass_blue_standart.001' ? 'm.glass_blue_standart' : material?.getName() || '')))]
        if (compatible.length !== 1) throw new Error('Ambiguous original material: ' + owner.getName() + '/' + material?.getName())
        // Retain the upstream textures, UV channel policy, sidedness, roles and extras.
        primitive.setMaterial(compatible[0])
      }
      owner.setMesh(copied)
      for (const property of [owner, copied]) {
        const extras = { ...property.getExtras() }
        delete extras.iomSurfaceTopologyRepaired
        property.setExtras(extras)
      }
      changes.push({ object: owner.getName(), patch, before: triangleCount(before), after: triangleCount(copied), matrixDelta })
    }
  }
  let seatRows = 0
  if (id === 'icm-anim-2025') {
    const lod = await io.read(candidateDir + 'icm-seats-lod1-candidate.glb')
    const names = new Set(lod.getRoot().listNodes().filter(n => n.getMesh()).map(n => n.getName()))
    for (const node of doc.getRoot().listNodes()) if (names.has(node.getName())) {
      node.setExtras({ ...node.getExtras(), iomReviewSeatRow: node.getName() })
      seatRows++
    }
    if (seatRows !== 78) throw new Error('Seat row identity mismatch: ' + seatRows)
  }
  await doc.transform(prune({ keepAttributes: true, keepIndices: true }), unpartition())
  await io.write(output, doc)
  report.push({ id, input, inputSha256: sha256, output, seatRows, changes })
  await writeFile('../../evidence/visual-composition-v4.json', JSON.stringify(report, null, 2))
  console.log(id, 'patched', changes.length, 'objects;', seatRows, 'preserved LOD rows')
}

if (process.argv[2] !== 'exterior') await compose('icm-anim-2025', 'F:/iom_website/building-viewer/tmp/blender-surface-cleanup/icm-anim-repaired-v2.glb',
  '5b8f34e32f9bd4a01db66c79ecf617118ee982e947d2282dea4307964b3ce739',
  ['icm-stairs-visual-candidate.glb', 'icm-auditorium-floor-visual-candidate.glb', 'icm-interior-exact-cleanup-candidate.glb'])
await compose('icm-ext', 'F:/iom_website/building-viewer/tmp/icm-ext-cleaned.glb',
  '2a485514e7e704718273d76a8aef6788ad1cd558b7ce0bcb0533cd5971e89111',
  ['icm-exterior-exact-cleanup-candidate.glb'])
