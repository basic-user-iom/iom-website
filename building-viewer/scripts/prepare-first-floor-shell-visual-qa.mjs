/**
 * Prepare texture-free, geometry-identical copies of the disabled shell
 * candidate for Blender silhouette/sidedness review. Blender 5.2's bundled
 * glTF importer cannot decode KHR_texture_basisu, so QA inputs deliberately
 * remove texture bindings while retaining geometry, hierarchy, transforms,
 * material factors, double-sided flags, and IOM extras.
 *
 * With no arguments this preserves the original first-floor behavior. Other
 * disabled owner candidates use --profile second-floor|mezzanine|ceiling|ground-floor.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prune } from '@gltf-transform/functions'
import { createGltfIO } from './lib/gltf-io.mjs'
import { requestedShellVisualQaProfile, shellVisualQaPaths } from './lib/shell-visual-qa-profile.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const PROFILE = requestedShellVisualQaProfile(process.argv)
const { candidateRoot: CANDIDATE_ROOT, indexPath: INDEX_PATH, outputRoot: OUTPUT_ROOT } = shellVisualQaPaths(VIEWER_ROOT, PROFILE)
const OWNER_NAME = PROFILE.ownerName

async function fileEvidence(path) {
  const [bytes, info] = await Promise.all([readFile(path), stat(path)])
  return {
    path,
    bytes: info.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

function removeTextureBindings(material) {
  material.setBaseColorTexture(null)
  material.setMetallicRoughnessTexture(null)
  material.setNormalTexture(null)
  material.setOcclusionTexture(null)
  material.setEmissiveTexture(null)
  const transmission = material.getExtension('KHR_materials_transmission')
  transmission?.setTransmissionTexture?.(null)
  const specular = material.getExtension('KHR_materials_specular')
  specular?.setSpecularTexture?.(null)
  specular?.setSpecularColorTexture?.(null)
  material.setBaseColorFactor([0.62, 0.68, 0.76, 1])
  material.setMetallicFactor(0)
  material.setRoughnessFactor(0.82)
  // Neutral self-illumination keeps 200 m-wide QA frames readable without
  // changing topology or the authored double-sided flags under review.
  material.setEmissiveFactor([0.42, 0.48, 0.62])
}

async function makeGeometryReviewDocument(document, ownerOnly) {
  if (ownerOnly) {
    const owners = document.getRoot().listNodes().filter((node) => node.getName() === OWNER_NAME)
    if (owners.length !== 1) throw new Error(`Expected one ${OWNER_NAME}, found ${owners.length}`)
    const owner = owners[0]
    const retained = new Set()
    const stack = [...owner.listChildren()]
    while (stack.length) {
      const node = stack.pop()
      retained.add(node)
      stack.push(...node.listChildren())
    }
    const previousScenes = [...document.getRoot().listScenes()]
    const scene = document.createScene(`OwnerLocal:${OWNER_NAME}`)
    for (const child of [...owner.listChildren()]) scene.addChild(child)
    for (const previous of previousScenes) previous.dispose()
    for (const node of [...document.getRoot().listNodes()]) {
      if (!retained.has(node)) node.dispose()
    }
    for (const animation of [...document.getRoot().listAnimations()]) animation.dispose()
  }
  for (const material of document.getRoot().listMaterials()) removeTextureBindings(material)
  await document.transform(prune({ keepAttributes: true, keepIndices: true, keepExtras: true }))
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (extension.extensionName === 'KHR_texture_basisu') extension.dispose()
  }
  return document
}

const index = JSON.parse(await readFile(INDEX_PATH, 'utf8'))
if (index.enabled !== false || index.shellCompletion?.candidateBuilt !== true) {
  throw new Error(`Expected the disabled completed ${PROFILE.title.toLowerCase()} shell candidate`)
}
if (index.owner?.nodeName !== OWNER_NAME) throw new Error(`Candidate owner is ${index.owner?.nodeName}, expected ${OWNER_NAME}`)
if (index.shellCompletion.ready !== false) throw new Error('Shell candidate must remain ready=false during visual QA')
const shell = index.shellCompletion.requiredAlwaysResidentShell
const io = await createGltfIO({ encoder: true })
await mkdir(OUTPUT_ROOT, { recursive: true })
const variants = {}

for (const variant of ['web', 'quest']) {
  const shellSource = resolve(CANDIDATE_ROOT, shell.variants[variant].url)
  const shellOutput = resolve(OUTPUT_ROOT, `${variant}-shell-geometry-review.glb`)
  const sourceOwnerInput = resolve(CANDIDATE_ROOT, index.source[variant].url)
  const sourceOwnerOutput = resolve(OUTPUT_ROOT, `${variant}-source-owner-geometry-review.glb`)
  const [shellSourceEvidence, sourceOwnerInputEvidence] = await Promise.all([
    fileEvidence(shellSource),
    fileEvidence(sourceOwnerInput),
  ])
  if (shellSourceEvidence.sha256 !== shell.variants[variant].sha256) {
    throw new Error(`${variant} shell source hash differs from candidate index`)
  }
  if (sourceOwnerInputEvidence.sha256 !== index.source[variant].sha256) {
    throw new Error(`${variant} owner source hash differs from candidate index`)
  }
  await io.write(shellOutput, await makeGeometryReviewDocument(await io.read(shellSource), false))
  await io.write(sourceOwnerOutput, await makeGeometryReviewDocument(await io.read(sourceOwnerInput), true))
  variants[variant] = {
    sourceOwnerInput: sourceOwnerInputEvidence,
    shellInput: shellSourceEvidence,
    preparedSourceOwner: await fileEvidence(sourceOwnerOutput),
    preparedShell: await fileEvidence(shellOutput),
  }
  console.log(`${variant} shell: ${shellOutput}`)
  console.log(`${variant} source owner: ${sourceOwnerOutput}`)
}

await writeFile(resolve(OUTPUT_ROOT, 'prepared-inputs.json'), `${JSON.stringify({
  schema: 'IOM_OWNER_SHELL_VISUAL_QA_PREPARED_INPUTS',
  version: 1,
  profile: { slug: PROFILE.slug, title: PROFILE.title, ownerName: OWNER_NAME },
  candidateIndex: await fileEvidence(INDEX_PATH),
  resolution: 960,
  views: ['front', 'back', 'left', 'right', 'top', 'bottom', 'grazing'],
  textureBindingsRemovedForBlender52Compatibility: true,
  ownerLocalGeometryHierarchyTransformsAndDoubleSidedFlagsPreserved: true,
  ready: false,
  activationApproved: false,
  variants,
}, null, 2)}\n`)
