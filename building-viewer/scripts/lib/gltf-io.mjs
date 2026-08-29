import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

/**
 * Create a glTF Transform NodeIO that can read every format shipped by the
 * viewer, including GLBs compressed with EXT_meshopt_compression.
 */
export async function createGltfIO({ encoder = false } = {}) {
  await MeshoptDecoder.ready
  const dependencies = { 'meshopt.decoder': MeshoptDecoder }
  if (encoder) {
    await MeshoptEncoder.ready
    dependencies['meshopt.encoder'] = MeshoptEncoder
  }
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies(dependencies)
}
