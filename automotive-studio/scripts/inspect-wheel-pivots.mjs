/**
 * Debug: print wheel-node hierarchy with local translations and mesh bounds
 * so RollingPivots can be placed at the true hub centre.
 *
 *   node automotive-studio/scripts/inspect-wheel-pivots.mjs [glb]
 */
import { resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const DEFAULT = resolve(
  'F:/FREE_Lixiang_L9_2024_(White_Interior)/optimized/lixiang-presentation-high.glb',
)

const TARGETS = ['FL_Wheel_26', 'FL_Wheel.001_28', 'RL_Wheel_30']

function nodeLocalMatrix(node) {
  const t = node.getTranslation()
  const r = node.getRotation()
  const s = node.getScale()
  return { t, r, s }
}

function quatApply(q, v) {
  const [x, y, z, w] = q
  const [vx, vy, vz] = v
  const ix = w * vx + y * vz - z * vy
  const iy = w * vy + z * vx - x * vz
  const iz = w * vz + x * vy - y * vx
  const iw = -x * vx - y * vy - z * vz
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ]
}

/** Mesh bounds of `node` (and descendants) expressed in the space of `node`'s parent. */
function boundsInParentSpace(node) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  const walk = (n, offset, scale, rot) => {
    const { t, r, s } = nodeLocalMatrix(n)
    const localScale = [scale[0] * s[0], scale[1] * s[1], scale[2] * s[2]]
    const rotated = quatApply(rot, [t[0] * scale[0], t[1] * scale[1], t[2] * scale[2]])
    const localOffset = [offset[0] + rotated[0], offset[1] + rotated[1], offset[2] + rotated[2]]
    const localRot = mulQuat(rot, r)

    const mesh = n.getMesh()
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')
        if (!pos) continue
        const pMin = pos.getMin([])
        const pMax = pos.getMax([])
        for (const cx of [pMin[0], pMax[0]]) {
          for (const cy of [pMin[1], pMax[1]]) {
            for (const cz of [pMin[2], pMax[2]]) {
              const scaled = [cx * localScale[0], cy * localScale[1], cz * localScale[2]]
              const world = quatApply(localRot, scaled)
              for (let i = 0; i < 3; i++) {
                const v = localOffset[i] + world[i]
                if (v < min[i]) min[i] = v
                if (v > max[i]) max[i] = v
              }
            }
          }
        }
      }
    }
    for (const child of n.listChildren()) walk(child, localOffset, localScale, localRot)
  }

  walk(node, [0, 0, 0], [1, 1, 1], [0, 0, 0, 1])
  if (!Number.isFinite(min[0])) return null
  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

function mulQuat(a, b) {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

const fmt = (a) => `[${a.map((v) => v.toFixed(2)).join(', ')}]`

async function main() {
  const file = process.argv[2] ? resolve(process.argv[2]) : DEFAULT
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(file)
  const root = doc.getRoot()

  console.log(`file: ${file}\n`)

  for (const name of TARGETS) {
    const node = root.listNodes().find((n) => n.getName() === name)
    if (!node) {
      console.log(`${name}: NOT FOUND`)
      continue
    }
    const { t, r, s } = nodeLocalMatrix(node)
    console.log(`${name}`)
    console.log(`  translation ${fmt(t)}  rotation ${fmt(r)}  scale ${fmt(s)}`)
    console.log(`  mesh: ${node.getMesh() ? node.getMesh().getName() || '(unnamed)' : 'none'}`)

    for (const child of node.listChildren()) {
      const b = boundsInParentSpace(child)
      const ct = child.getTranslation()
      console.log(
        `  child ${child.getName() || '(unnamed)'} t=${fmt(ct)} mesh=${
          child.getMesh() ? 'yes' : 'no'
        } kids=${child.listChildren().length}`,
      )
      if (b) {
        console.log(`      bounds centre ${fmt(b.center)} size ${fmt(b.size)}`)
      }
    }

    const whole = boundsInParentSpace(node)
    if (whole) {
      console.log(`  NODE bounds (parent space) centre ${fmt(whole.center)} size ${fmt(whole.size)}`)
    }
    console.log()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
