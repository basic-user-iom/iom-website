/**
 * Removes exporter-created empty scenes before gltfpack instancing.
 *
 * gltfpack 1.2 warns that EXT_mesh_gpu_instancing can be assigned to the wrong
 * scene when a document contains more than one scene. The ICM animation source
 * has one populated scene and seven empty Blender collection scenes, so this
 * lossless preflight reduces the document to its single populated scene.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

function parseArgs(argv) {
  const args = { input: null, out: null, report: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = resolve(argv[++i])
    else if (argv[i] === '--out') args.out = resolve(argv[++i])
    else if (argv[i] === '--report') args.report = resolve(argv[++i])
  }
  if (!args.input || !args.out) throw new Error('Required: --input <source.glb> --out <normalized.glb>')
  if (args.input === args.out) throw new Error('Input and output must be different files')
  args.report ||= args.out.replace(/\.glb$/i, '.scene-normalization-report.json')
  return args
}

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function main() {
  const args = parseArgs(process.argv)
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    })

  const inputBuffer = await readFile(args.input)
  const document = await io.read(args.input)
  const scenes = document.getRoot().listScenes()
  const populated = scenes.filter((scene) => scene.listChildren().length > 0)
  if (populated.length !== 1) {
    throw new Error(
      `Expected exactly one populated scene before instancing; found ${populated.length} of ${scenes.length}.`,
    )
  }

  const removed = []
  for (const scene of scenes) {
    if (scene === populated[0]) continue
    removed.push(scene.getName() || '(unnamed)')
    scene.dispose()
  }

  await io.write(args.out, document)
  const outputBuffer = await readFile(args.out)
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    input: { path: args.input, bytes: inputBuffer.byteLength, sha256: hash(inputBuffer) },
    output: { path: args.out, bytes: outputBuffer.byteLength, sha256: hash(outputBuffer) },
    populatedScene: populated[0].getName() || '(unnamed)',
    removedEmptyScenes: removed,
    sceneCountBefore: scenes.length,
    sceneCountAfter: document.getRoot().listScenes().length,
  }
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
