/**
 * Offline Lixiang profile check (prototype asset, not shipped).
 * Usage from automotive-studio/:
 *   npx --yes tsx src/tests/inspect-lixiang.ts [path]
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { access } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT =
  'F:/FREE_Lixiang_L9_2024_(White_Interior)/FREE_Lixiang_L9_2024_(White_Interior).glb'

const EXPECTED_DURATION = 14.542
const EXPECTED_CHANNELS = 16

async function main() {
  const file = process.argv[2] || DEFAULT
  try {
    await access(file)
  } catch {
    console.error(`Lixiang GLB not found at:\n  ${file}`)
    console.error('Pass a path as argv[2] if needed. Skipping (not a hard fail for CI without the asset).')
    process.exit(0)
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(file)
  const root = doc.getRoot()
  const animations = root.listAnimations()
  const meshes = root.listMeshes()
  const materials = root.listMaterials()
  const textures = root.listTextures()

  let channels = 0
  let duration = 0
  for (const anim of animations) {
    const samplers = anim.listSamplers()
    channels += anim.listChannels().length
    for (const s of samplers) {
      const input = s.getInput()
      const arr = input?.getArray()
      if (arr && arr.length) {
        duration = Math.max(duration, Number(arr[arr.length - 1]))
      }
    }
  }

  console.log('Lixiang profile')
  console.log(`  path: ${path.normalize(file)}`)
  console.log(`  animations: ${animations.length}`)
  console.log(`  duration: ${duration.toFixed(3)}s (expected ~${EXPECTED_DURATION})`)
  console.log(`  channels: ${channels} (expected ~${EXPECTED_CHANNELS})`)
  console.log(`  meshes: ${meshes.length}`)
  console.log(`  materials: ${materials.length}`)
  console.log(`  textures: ${textures.length}`)

  const durationOk = Math.abs(duration - EXPECTED_DURATION) < 0.05
  const channelsOk = channels === EXPECTED_CHANNELS
  if (!durationOk || !channelsOk) {
    console.error('Profile mismatch vs plan §4.3')
    process.exit(1)
  }
  console.log('Profile matches plan expectations.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
