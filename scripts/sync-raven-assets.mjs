/**
 * Copy raven GLTF source assets from ravens/ → public/assets/ravens/.
 * Ensures common-ravens.gltf, .bin, and textures exist before build / mobile GLB step.
 *
 * Run: node scripts/sync-raven-assets.mjs
 */
import { access, cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const source = join(root, 'ravens')
const target = join(root, 'public/assets/ravens')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(source))) {
    console.log('sync-raven-assets: ravens/ not found — skipping')
    return
  }

  await mkdir(target, { recursive: true })

  for (const name of ['common-ravens.gltf', 'common-ravens.bin', 'license.txt']) {
    const from = join(source, name)
    if (await exists(from)) {
      await cp(from, join(target, name))
      console.log(`sync-raven-assets: ${name}`)
    }
  }

  const imagesFrom = join(source, 'images')
  if (await exists(imagesFrom)) {
    await cp(imagesFrom, join(target, 'images'), { recursive: true })
    console.log('sync-raven-assets: images/')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
