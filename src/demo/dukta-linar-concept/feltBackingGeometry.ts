import {
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
} from 'three'

const BODY_VERTICES_PER_SAMPLE = 8
const CAP_VERTEX_COUNT = 4

export const LINAR_FELT_BACKING_OBJECT_NAMES = Object.freeze({
  body: 'LinarFeltBackingBody',
  leftCap: 'LinarFeltBackingLeftCap',
  rightCap: 'LinarFeltBackingRightCap',
})

export type FeltBackingGeometry = {
  body: BufferGeometry
  leftCap: BufferGeometry
  rightCap: BufferGeometry
  segmentCount: number
  update: (
    pathX: Float32Array,
    pathZ: Float32Array,
    pathRotationY: Float32Array,
    panelHeightM: number,
    panelHalfThicknessM: number,
    feltThicknessM: number,
    renderGapM: number,
  ) => void
  dispose: () => void
}

type DynamicSurface = {
  geometry: BufferGeometry
  position: Float32BufferAttribute
  normal: Float32BufferAttribute
}

function dynamicSurface(
  name: string,
  vertexCount: number,
  uvs: Float32Array,
  indices: number[],
): DynamicSurface {
  const geometry = new BufferGeometry()
  geometry.name = name
  const position = new Float32BufferAttribute(
    new Float32Array(vertexCount * 3),
    3,
  ).setUsage(DynamicDrawUsage)
  const normal = new Float32BufferAttribute(
    new Float32Array(vertexCount * 3),
    3,
  ).setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return { geometry, position, normal }
}

function setUv(uvs: Float32Array, vertex: number, u: number, v: number) {
  uvs[vertex * 2] = u
  uvs[vertex * 2 + 1] = v
}

/**
 * Fixed-topology wool-felt volume. The broad body intentionally has open X
 * ends; its two small cap meshes can therefore be shown only at the outside
 * edges of a repeated installation instead of being duplicated at seams.
 *
 * Acoustic fleece and the rear-light diffuser continue to use their separate
 * thin ribbon. This volume exists only for confirmed opaque wool felt.
 */
export function createFeltBackingGeometry(segmentCount: number): FeltBackingGeometry {
  const segments = Math.max(1, Math.round(segmentCount))
  const sampleCount = segments + 1
  const bodyVertexCount = sampleCount * BODY_VERTICES_PER_SAMPLE
  const bodyUvs = new Float32Array(bodyVertexCount * 2)
  const bodyIndices: number[] = []

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const u = sample / segments
    const base = sample * BODY_VERTICES_PER_SAMPLE
    // Front and rear faces use the complete panel-height UV range.
    setUv(bodyUvs, base, u, 0)
    setUv(bodyUvs, base + 1, u, 1)
    setUv(bodyUvs, base + 2, u, 0)
    setUv(bodyUvs, base + 3, u, 1)
    // Top and bottom expose the shallow felt depth across V.
    setUv(bodyUvs, base + 4, u, 0)
    setUv(bodyUvs, base + 5, u, 1)
    setUv(bodyUvs, base + 6, u, 0)
    setUv(bodyUvs, base + 7, u, 1)

    if (sample >= segments) continue
    const next = base + BODY_VERTICES_PER_SAMPLE

    // Front (+normal), rear (-normal), top (+Y), bottom (-Y).
    bodyIndices.push(
      base, next, base + 1,
      next, next + 1, base + 1,
      base + 2, base + 3, next + 2,
      next + 2, base + 3, next + 3,
      base + 4, next + 4, base + 5,
      next + 4, next + 5, base + 5,
      base + 6, base + 7, next + 6,
      next + 6, base + 7, next + 7,
    )
  }

  const body = dynamicSurface(
    'LinarFeltBackingBodyGeometry',
    bodyVertexCount,
    bodyUvs,
    bodyIndices,
  )

  const capUvs = new Float32Array([
    0, 0,
    0, 1,
    1, 0,
    1, 1,
  ])
  const leftCap = dynamicSurface(
    'LinarFeltBackingLeftCapGeometry',
    CAP_VERTEX_COUNT,
    capUvs,
    [0, 1, 2, 2, 1, 3],
  )
  const rightCap = dynamicSurface(
    'LinarFeltBackingRightCapGeometry',
    CAP_VERTEX_COUNT,
    capUvs,
    [0, 2, 1, 2, 3, 1],
  )

  let disposed = false

  const writeCap = (
    cap: DynamicSurface,
    sample: number,
    normalDirection: -1 | 1,
    pathX: Float32Array,
    pathZ: Float32Array,
    pathRotationY: Float32Array,
    panelHeightM: number,
    frontOffsetM: number,
    rearOffsetM: number,
  ) => {
    const rotationY = pathRotationY[sample]
    const normalX = Math.sin(rotationY)
    const normalZ = Math.cos(rotationY)
    const tangentX = Math.cos(rotationY) * normalDirection
    const tangentZ = -Math.sin(rotationY) * normalDirection
    const frontX = pathX[sample] - normalX * frontOffsetM
    const frontZ = pathZ[sample] - normalZ * frontOffsetM
    const rearX = pathX[sample] - normalX * rearOffsetM
    const rearZ = pathZ[sample] - normalZ * rearOffsetM

    cap.position.setXYZ(0, frontX, 0, frontZ)
    cap.position.setXYZ(1, frontX, panelHeightM, frontZ)
    cap.position.setXYZ(2, rearX, 0, rearZ)
    cap.position.setXYZ(3, rearX, panelHeightM, rearZ)
    for (let vertex = 0; vertex < CAP_VERTEX_COUNT; vertex += 1) {
      cap.normal.setXYZ(vertex, tangentX, 0, tangentZ)
    }
    cap.position.needsUpdate = true
    cap.normal.needsUpdate = true
  }

  return {
    body: body.geometry,
    leftCap: leftCap.geometry,
    rightCap: rightCap.geometry,
    segmentCount: segments,
    update: (
      pathX,
      pathZ,
      pathRotationY,
      panelHeightM,
      panelHalfThicknessM,
      feltThicknessM,
      renderGapM,
    ) => {
      if (disposed) return
      if (
        pathX.length < sampleCount ||
        pathZ.length < sampleCount ||
        pathRotationY.length < sampleCount
      ) {
        throw new Error('LINAR felt path does not contain enough samples')
      }

      const heightM = Math.max(0, panelHeightM)
      const frontOffsetM = Math.max(0, panelHalfThicknessM) + Math.max(0, renderGapM)
      const rearOffsetM = frontOffsetM + Math.max(0.000001, feltThicknessM)

      for (let sample = 0; sample < sampleCount; sample += 1) {
        const base = sample * BODY_VERTICES_PER_SAMPLE
        const rotationY = pathRotationY[sample]
        const normalX = Math.sin(rotationY)
        const normalZ = Math.cos(rotationY)
        const frontX = pathX[sample] - normalX * frontOffsetM
        const frontZ = pathZ[sample] - normalZ * frontOffsetM
        const rearX = pathX[sample] - normalX * rearOffsetM
        const rearZ = pathZ[sample] - normalZ * rearOffsetM

        body.position.setXYZ(base, frontX, 0, frontZ)
        body.position.setXYZ(base + 1, frontX, heightM, frontZ)
        body.position.setXYZ(base + 2, rearX, 0, rearZ)
        body.position.setXYZ(base + 3, rearX, heightM, rearZ)
        body.position.setXYZ(base + 4, frontX, heightM, frontZ)
        body.position.setXYZ(base + 5, rearX, heightM, rearZ)
        body.position.setXYZ(base + 6, frontX, 0, frontZ)
        body.position.setXYZ(base + 7, rearX, 0, rearZ)

        body.normal.setXYZ(base, normalX, 0, normalZ)
        body.normal.setXYZ(base + 1, normalX, 0, normalZ)
        body.normal.setXYZ(base + 2, -normalX, 0, -normalZ)
        body.normal.setXYZ(base + 3, -normalX, 0, -normalZ)
        body.normal.setXYZ(base + 4, 0, 1, 0)
        body.normal.setXYZ(base + 5, 0, 1, 0)
        body.normal.setXYZ(base + 6, 0, -1, 0)
        body.normal.setXYZ(base + 7, 0, -1, 0)
      }
      body.position.needsUpdate = true
      body.normal.needsUpdate = true

      writeCap(
        leftCap,
        0,
        -1,
        pathX,
        pathZ,
        pathRotationY,
        heightM,
        frontOffsetM,
        rearOffsetM,
      )
      writeCap(
        rightCap,
        segments,
        1,
        pathX,
        pathZ,
        pathRotationY,
        heightM,
        frontOffsetM,
        rearOffsetM,
      )
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      body.geometry.dispose()
      leftCap.geometry.dispose()
      rightCap.geometry.dispose()
    },
  }
}
