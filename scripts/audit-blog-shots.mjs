import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(process.cwd(), 'public', 'assets', 'blog')
const dirs = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory())

for (const d of dirs.sort((a, b) => a.name.localeCompare(b.name))) {
  const files = ['cover.jpg', 'view-a.jpg', 'view-b.jpg', 'hero.jpg', 'beams.jpg', 'profile.jpg', 'ui.jpg']
  const hashes = {}
  const sizes = {}
  for (const f of files) {
    try {
      const buf = await readFile(join(root, d.name, f))
      sizes[f] = buf.length
      hashes[f] = createHash('sha1').update(buf).digest('hex').slice(0, 10)
    } catch {
      /* missing */
    }
  }
  const vals = Object.values(hashes)
  const unique = new Set(vals).size
  const tiny = Object.values(sizes).some((s) => s < 20000)
  const dup = unique > 0 && unique < Math.min(3, vals.length)
  console.log(
    `${dup || tiny ? 'BAD ' : 'ok  '} ${d.name.padEnd(28)} unique=${unique} sizes=${JSON.stringify(sizes)}`,
  )
}
