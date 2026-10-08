#!/usr/bin/env node

/**
 * Disabled, ignored feasibility pilot for an exact six-part row cohort.
 *
 * One immutable geometry payload is shared by every row. A compact binary
 * table carries the exact 78 owner-local matrices plus measured bounds and
 * source/segment keys for 468 independently selectable physical units.
 * Nothing in this script edits runtime, manifest, tracked, or production data.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Matrix4, Vector3 } from 'three'
import { buildRepeatSixPartProductionSourcePilot } from './build-repeat-six-part-production-source-pilot.mjs'
import { createGltfIO } from './lib/gltf-io.mjs'

const SCRIPT_ROOT = resolve(import.meta.dirname)
const VIEWER_ROOT = resolve(SCRIPT_ROOT, '..')
const DEFAULT_PILOT_ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-pilot')
const DEFAULT_PRODUCTION_MODEL = resolve(VIEWER_ROOT, '../public/models/icm-anim-2025/model-web.glb')
const DETERMINISM_ROOT = resolve(VIEWER_ROOT, 'tmp/repeat-six-part-exact-cohort-determinism')

const PRODUCTION_MODEL_PIN = Object.freeze({
  relativePath: '../public/models/icm-anim-2025/model-web.glb',
  bytes: 97_549_356,
  sha256: 'b96cf36f64a03d16047e3ff26aa93131481f636c184df80b5c7ea2032e4cb5e8',
})

function outputPaths(pilotRoot) {
  const payloadRoot = resolve(pilotRoot, 'payloads')
  return {
    pilotRoot,
    productionSourceRoot: resolve(pilotRoot, 'production-source'),
    geometry: resolve(payloadRoot, 'shared/exact-six-segment-geometry.glb'),
    cohortTable: resolve(payloadRoot, 'web/exact-six-segment-cohort.bin'),
    ownership: resolve(payloadRoot, 'web/exact-six-segment-ownership.json'),
    index: resolve(pilotRoot, 'candidate-index.json'),
    audit: resolve(pilotRoot, 'physical-audit.json'),
    report: resolve(pilotRoot, 'REPORT.md'),
    determinism: resolve(pilotRoot, 'determinism-proof.json'),
  }
}

const EXPECTED = {
  sourceTriangles: 61_269,
  sourceCount: 78,
  segmentCount: 6,
  unitCount: 468,
  materialNames: [
    'vray Stuhl_Plastik',
    'vray Stuhl_Plakete',
    'vray Stuhl_Metall',
    'vray Stuhl_Bezug',
  ],
  productionGeometryDigest: '4ace583e8d9bd044defffa65aa5e6b875b4923381ebb0eeca58ee5375306edee',
  sourceIdsSha256: 'd2883d11372b27f23ae8388db283195e13b979870cb5897e63a7971676a5189b',
  sourcePathsSha256: '72f559e1f08017caeb07b3c5577b0f2e3f2cf85a1886f781f9f5b863836d30bc',
  transformSetSha256: 'fe7adf799ecbfedbf84bcfcaa0557713728a36507573f846b52476891b66d36b',
}

const POLICY = {
  platform: 'web',
  exactSelectionMarginMeters: 5.5,
  innerEnvelopeMeters: 3.5,
  repeatFamilyResidentLimit: 1_500_000,
  repeatFamilyTransitionLimit: 1_500_000,
  allOtherOwnerReservation: 500_000,
  totalResidentLimit: 2_000_000,
  totalTransitionLimit: 2_000_000,
}

const TABLE = {
  magic: 'IOM6PRT2',
  version: 2,
  headerBytes: 80,
  matrixStrideBytes: 16 * 8,
  boundsStrideBytes: 6 * 8,
  keyStrideBytes: 2 * 4,
}

const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const MIRRORED_HOST_MATRIX = [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]))
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

const stableStringify = (value) => JSON.stringify(stableValue(value))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const finite = (values) => values.every(Number.isFinite)

function matrixFromFloat64LEHex(hex, label) {
  assert.match(hex, /^[0-9a-f]{256}$/, `${label}: matrix must be 128 lowercase hexadecimal bytes`)
  const bytes = Buffer.from(hex, 'hex')
  return Array.from({ length: 16 }, (_, index) => bytes.readDoubleLE(index * 8))
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function expandPoint(bounds, point) {
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], point[axis])
    bounds.max[axis] = Math.max(bounds.max[axis], point[axis])
  }
}

function unionBounds(boundsList) {
  const result = emptyBounds()
  for (const bounds of boundsList) {
    expandPoint(result, bounds.min)
    expandPoint(result, bounds.max)
  }
  return result
}

function transformBounds(bounds, matrixArray) {
  const result = emptyBounds()
  const matrix = new Matrix4().fromArray(matrixArray)
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        expandPoint(result, new Vector3(x, y, z).applyMatrix4(matrix).toArray())
      }
    }
  }
  return result
}

function expanded(bounds, margin) {
  return {
    min: bounds.min.map((value) => value - margin),
    max: bounds.max.map((value) => value + margin),
  }
}

function contains(bounds, point) {
  return bounds.min.every((value, axis) => point[axis] >= value && point[axis] <= bounds.max[axis])
}

function bytesForElement(array, index) {
  return Buffer.from(
    array.buffer,
    array.byteOffset + index * array.BYTES_PER_ELEMENT,
    array.BYTES_PER_ELEMENT,
  ).toString('hex')
}

function cornerSignature(position, normal, vertex) {
  let result = ''
  for (let component = 0; component < 3; component += 1) result += bytesForElement(position, vertex * 3 + component)
  for (let component = 0; component < 3; component += 1) result += bytesForElement(normal, vertex * 3 + component)
  return result
}

function triangleSignature(primitive, slot, triangle) {
  const indices = primitive.getIndices().getArray()
  const position = primitive.getAttribute('POSITION').getArray()
  const normal = primitive.getAttribute('NORMAL').getArray()
  const corners = [0, 1, 2].map((offset) => cornerSignature(position, normal, indices[triangle * 3 + offset]))
  const rotations = [
    `${corners[0]}/${corners[1]}/${corners[2]}`,
    `${corners[1]}/${corners[2]}/${corners[0]}`,
    `${corners[2]}/${corners[0]}/${corners[1]}`,
  ].sort()
  return `${slot}:${rotations[0]}`
}

function geometryDigest(document) {
  const records = []
  const segmentDigests = []
  const byMaterial = new Map()
  const nodes = document.getRoot().listNodes()
    .filter((node) => node.getMesh())
    .sort((left, right) => left.getExtras().segment - right.getExtras().segment)
  assert.equal(nodes.length, EXPECTED.segmentCount, 'exact production segment count changed')
  for (const node of nodes) {
    const segmentId = node.getExtras().segment
    assert.ok(Number.isInteger(segmentId) && segmentId >= 0 && segmentId < EXPECTED.segmentCount, `${node.getName()}: invalid segment identity`)
    const segmentRecords = []
    let segmentTriangles = 0
    assert.ok(node.getMatrix().every((value, index) => value === IDENTITY_MATRIX[index]), `${node.getName()}: non-identity geometry host`)
    const primitives = node.getMesh().listPrimitives()
    assert.equal(primitives.length, EXPECTED.materialNames.length, `${node.getName()}: material slot count changed`)
    for (const [slot, primitive] of primitives.entries()) {
      assert.equal(primitive.getMode(), 4, 'non-triangle primitive found')
      assert.deepEqual(primitive.listSemantics().sort(), ['NORMAL', 'POSITION'])
      assert.ok(primitive.getIndices(), 'unindexed primitive found')
      const triangles = primitive.getIndices().getCount() / 3
      segmentTriangles += triangles
      const material = primitive.getMaterial()?.getName() ?? '(missing)'
      assert.equal(material, EXPECTED.materialNames[slot], `${node.getName()}: material slot ${slot} changed`)
      const position = primitive.getAttribute('POSITION')
      const normal = primitive.getAttribute('NORMAL')
      assert.equal(position.getComponentType(), 5126, `${node.getName()}: POSITION is no longer Float32`)
      assert.equal(position.getNormalized(), false, `${node.getName()}: POSITION unexpectedly normalized`)
      assert.equal(normal.getComponentType(), 5122, `${node.getName()}: NORMAL is no longer Int16`)
      assert.equal(normal.getNormalized(), true, `${node.getName()}: NORMAL lost normalized storage contract`)
      byMaterial.set(material, (byMaterial.get(material) ?? 0) + triangles)
      for (let triangle = 0; triangle < triangles; triangle += 1) {
        const signature = triangleSignature(primitive, slot, triangle)
        records.push(signature)
        segmentRecords.push(signature)
      }
    }
    segmentRecords.sort()
    segmentDigests.push({
      segment: segmentId,
      triangles: segmentTriangles,
      canonicalOrientedGeometrySha256: sha256(Buffer.from(segmentRecords.join('\n'))),
    })
  }
  records.sort()
  segmentDigests.sort((left, right) => left.segment - right.segment)
  return {
    triangles: records.length,
    sha256: sha256(Buffer.from(records.join('\n'))),
    trianglesByMaterial: Object.fromEntries([...byMaterial.entries()].sort(([a], [b]) => a.localeCompare(b))),
    segmentDigests,
    contract: 'material slot plus exact raw Float32 POSITION and normalized Int16 NORMAL storage bits plus oriented triangle winding; triangle order ignored',
  }
}

function primitiveReferencedBounds(primitive) {
  const result = emptyBounds()
  const position = primitive.getAttribute('POSITION').getArray()
  const indices = primitive.getIndices().getArray()
  for (const vertex of indices) {
    expandPoint(result, [position[vertex * 3], position[vertex * 3 + 1], position[vertex * 3 + 2]])
  }
  assert.ok(finite([...result.min, ...result.max]))
  return result
}

function segmentAudit(document) {
  const records = []
  const accessors = new Set()
  const materialNames = new Set()
  const nodes = document.getRoot().listNodes().filter((node) => node.getMesh())
  assert.equal(nodes.length, EXPECTED.segmentCount)
  for (const node of nodes) {
    const segmentId = node.getExtras()?.segment
    assert.ok(Number.isInteger(segmentId) && segmentId >= 0 && segmentId < EXPECTED.segmentCount)
    const primitives = node.getMesh().listPrimitives()
    assert.equal(primitives.length, EXPECTED.materialNames.length)
    const primitiveRecords = primitives.map((primitive, slot) => {
      for (const accessor of [primitive.getIndices(), ...primitive.listAttributes()]) accessors.add(accessor)
      const material = primitive.getMaterial()?.getName()
      assert.equal(material, EXPECTED.materialNames[slot], `segment ${segmentId}: material order changed`)
      materialNames.add(material)
      return {
        slot,
        material,
        triangles: primitive.getIndices().getCount() / 3,
        measuredReferencedAccessorBounds: primitiveReferencedBounds(primitive),
      }
    })
    records.push({
      segmentId,
      nodeName: node.getName(),
      stations: node.getExtras()?.stations,
      nodeMatrix: node.getMatrix(),
      triangles: primitiveRecords.reduce((sum, entry) => sum + entry.triangles, 0),
      trianglesByMaterial: Object.fromEntries(primitiveRecords.map((entry) => [entry.material, entry.triangles])),
      measuredReferencedAccessorBounds: unionBounds(primitiveRecords.map((entry) => entry.measuredReferencedAccessorBounds)),
      primitives: primitiveRecords,
    })
  }
  records.sort((left, right) => left.segmentId - right.segmentId)
  assert.deepEqual(records.map((record) => record.segmentId), [0, 1, 2, 3, 4, 5])
  assert.deepEqual([...materialNames], EXPECTED.materialNames)
  const decodedUniqueAccessorBytes = [...accessors].reduce((sum, accessor) => sum + accessor.getArray().byteLength, 0)
  return {
    records,
    decodedUniqueAccessorBytes,
    uniqueAccessorCount: accessors.size,
    geometryNodes: nodes.length,
    drawTemplates: records.reduce((sum, record) => sum + record.primitives.length, 0),
    textures: document.getRoot().listTextures().length,
  }
}

function determinant(matrix) {
  return new Matrix4().fromArray(matrix).determinant()
}

function renderLocalMatrix(ownerLocalMatrix, parity) {
  if (parity === 'positive') return [...ownerLocalMatrix]
  assert.equal(parity, 'mirrored')
  // H^-1 * M for H = diag(-1, 1, 1). In column-major storage this is
  // exactly a sign flip of row 0. H is an ordinary Object3D host transform;
  // every matrix passed to InstancedMesh therefore has positive determinant.
  return ownerLocalMatrix.map((value, index) => [0, 4, 8, 12].includes(index) ? -value : value)
}

function recomposeRenderMatrix(renderMatrix, parity) {
  return renderLocalMatrix(renderMatrix, parity)
}

function matrixMaxDelta(left, right) {
  let result = 0
  for (let index = 0; index < 16; index += 1) result = Math.max(result, Math.abs(left[index] - right[index]))
  return result
}

function elevationBandFromProductionMatrix(instance) {
  const elevation = instance.ownerLocalMatrix[13]
  assert.ok(Number.isFinite(elevation), `${instance.sourceIndex}: non-finite production elevation`)
  if (elevation < 0.1) return 'low'
  if (elevation < 4) return 'middle'
  return 'high'
}

class RangeAddMaxTree {
  constructor(size) {
    this.size = size
    this.max = new Float64Array(size * 4 + 8)
    this.lazy = new Float64Array(size * 4 + 8)
    this.arg = new Int32Array(size * 4 + 8)
    this.#build(1, 0, size - 1)
  }
  #build(node, left, right) {
    if (left === right) {
      this.arg[node] = left
      return
    }
    const middle = (left + right) >> 1
    this.#build(node * 2, left, middle)
    this.#build(node * 2 + 1, middle + 1, right)
    this.arg[node] = this.arg[node * 2]
  }
  #apply(node, value) {
    this.max[node] += value
    this.lazy[node] += value
  }
  #pull(node) {
    const left = node * 2
    const right = left + 1
    if (this.max[left] >= this.max[right]) {
      this.max[node] = this.max[left]
      this.arg[node] = this.arg[left]
    } else {
      this.max[node] = this.max[right]
      this.arg[node] = this.arg[right]
    }
  }
  add(queryLeft, queryRight, value, node = 1, left = 0, right = this.size - 1) {
    if (queryLeft <= left && right <= queryRight) {
      this.#apply(node, value)
      return
    }
    const middle = (left + right) >> 1
    if (queryLeft <= middle) this.add(queryLeft, queryRight, value, node * 2, left, middle)
    if (queryRight > middle) this.add(queryLeft, queryRight, value, node * 2 + 1, middle + 1, right)
    this.#pull(node)
    this.max[node] += this.lazy[node]
  }
  best() {
    return { value: this.max[1], index: this.arg[1] }
  }
}

function addEvent(map, coordinate, kind, item) {
  let event = map.get(coordinate)
  if (!event) {
    event = { coordinate, starts: [], ends: [] }
    map.set(coordinate, event)
  }
  event[kind].push(item)
}

/** Exact maximum weighted overlap of closed axis-aligned boxes. */
function maxWeightedBoxOverlap(boxes) {
  const zCoordinates = [...new Set(boxes.flatMap((box) => [box.bounds.min[2], box.bounds.max[2]]))].sort((a, b) => a - b)
  const zIndex = new Map(zCoordinates.map((value, index) => [value, index]))
  const xEvents = new Map()
  for (const box of boxes) {
    addEvent(xEvents, box.bounds.min[0], 'starts', box)
    addEvent(xEvents, box.bounds.max[0], 'ends', box)
  }
  const active = new Set()
  let best = { value: -Infinity, point: null }
  for (const xEvent of [...xEvents.values()].sort((a, b) => a.coordinate - b.coordinate)) {
    for (const box of xEvent.starts) active.add(box)
    const yEvents = new Map()
    for (const box of active) {
      addEvent(yEvents, box.bounds.min[1], 'starts', box)
      addEvent(yEvents, box.bounds.max[1], 'ends', box)
    }
    const tree = new RangeAddMaxTree(zCoordinates.length)
    for (const yEvent of [...yEvents.values()].sort((a, b) => a.coordinate - b.coordinate)) {
      for (const box of yEvent.starts) tree.add(zIndex.get(box.bounds.min[2]), zIndex.get(box.bounds.max[2]), box.weight)
      const candidate = tree.best()
      if (candidate.value > best.value) {
        best = { value: candidate.value, point: [xEvent.coordinate, yEvent.coordinate, zCoordinates[candidate.index]] }
      }
      for (const box of yEvent.ends) tree.add(zIndex.get(box.bounds.min[2]), zIndex.get(box.bounds.max[2]), -box.weight)
    }
    for (const box of xEvent.ends) active.delete(box)
  }
  return best
}

function sweep(units, margin, label) {
  const boxes = units.map((unit) => ({
    id: unit.unitId,
    bounds: expanded(unit.bounds, margin),
    weight: unit.triangles,
  }))
  const best = maxWeightedBoxOverlap(boxes)
  const selected = units.filter((unit) => contains(expanded(unit.bounds, margin), best.point))
  const triangles = selected.reduce((sum, unit) => sum + unit.triangles, 0)
  assert.equal(triangles, best.value, `${label}: witness recomposition mismatch`)
  const bySegment = Object.fromEntries(Array.from({ length: EXPECTED.segmentCount }, (_, segmentId) => {
    const matches = selected.filter((unit) => unit.segmentId === segmentId)
    return [segmentId, {
      instances: matches.length,
      triangles: matches.reduce((sum, unit) => sum + unit.triangles, 0),
    }]
  }))
  const activeSegments = Object.values(bySegment).filter((record) => record.instances > 0).length
  const activeParitySegmentGroups = new Set(selected.map((unit) => `${unit.parity}|${unit.segmentId}`)).size
  return {
    label,
    marginMeters: margin,
    triangles,
    witness: best.point,
    selectedUnits: selected.length,
    selectedRows: new Set(selected.map((unit) => unit.sourceId)).size,
    selectedUnitIds: selected.map((unit) => unit.unitId),
    bySegment,
    naiveUnitDraws: selected.length * EXPECTED.materialNames.length,
    activeSegments,
    activeParitySegmentGroups,
    projectedParitySafeInstancedDraws: activeParitySegmentGroups * EXPECTED.materialNames.length,
  }
}

/**
 * Exact maximum active parity/segment batch count. Each batch is the union of
 * its closed unit boxes, so evaluating ordered start/evaluate/end events at
 * every endpoint is sufficient. The theoretical upper bound is 12; finding
 * all 12 permits an immediate exact result.
 */
function maxActiveParitySegmentGroups(units, margin) {
  const boxes = units.map((unit) => ({
    unit,
    bounds: expanded(unit.bounds, margin),
    group: `${unit.parity}|${unit.segmentId}`,
  }))
  const possibleGroups = new Set(boxes.map((box) => box.group)).size
  assert.equal(possibleGroups, EXPECTED.segmentCount * 2)
  const xEvents = new Map()
  for (const box of boxes) {
    addEvent(xEvents, box.bounds.min[0], 'starts', box)
    addEvent(xEvents, box.bounds.max[0], 'ends', box)
  }
  const activeX = new Set()
  let best = { activeGroups: -1, point: null, selectedUnits: [], groups: [] }
  for (const xEvent of [...xEvents.values()].sort((a, b) => a.coordinate - b.coordinate)) {
    for (const box of xEvent.starts) activeX.add(box)
    const yEvents = new Map()
    for (const box of activeX) {
      addEvent(yEvents, box.bounds.min[1], 'starts', box)
      addEvent(yEvents, box.bounds.max[1], 'ends', box)
    }
    const activeY = new Set()
    for (const yEvent of [...yEvents.values()].sort((a, b) => a.coordinate - b.coordinate)) {
      for (const box of yEvent.starts) activeY.add(box)
      const zEvents = new Map()
      for (const box of activeY) {
        addEvent(zEvents, box.bounds.min[2], 'starts', box)
        addEvent(zEvents, box.bounds.max[2], 'ends', box)
      }
      const activeZ = new Set()
      for (const zEvent of [...zEvents.values()].sort((a, b) => a.coordinate - b.coordinate)) {
        for (const box of zEvent.starts) activeZ.add(box)
        const groups = [...new Set([...activeZ].map((box) => box.group))].sort()
        if (groups.length > best.activeGroups) {
          best = {
            activeGroups: groups.length,
            point: [xEvent.coordinate, yEvent.coordinate, zEvent.coordinate],
            selectedUnits: [...activeZ].map((box) => box.unit.unitId).sort(),
            groups,
          }
          if (best.activeGroups === possibleGroups) {
            return {
              ...best,
              possibleGroups,
              materialsPerGroup: EXPECTED.materialNames.length,
              draws: best.activeGroups * EXPECTED.materialNames.length,
              exact: true,
              proof: 'observed all possible parity/segment groups at one closed-box endpoint witness',
            }
          }
        }
        for (const box of zEvent.ends) activeZ.delete(box)
      }
      for (const box of yEvent.ends) activeY.delete(box)
    }
    for (const box of xEvent.ends) activeX.delete(box)
  }
  return {
    ...best,
    possibleGroups,
    materialsPerGroup: EXPECTED.materialNames.length,
    draws: best.activeGroups * EXPECTED.materialNames.length,
    exact: true,
    proof: 'exhaustive ordered endpoint sweep of closed boxes',
  }
}

function buildCohortTable(instances, units) {
  const canonicalMatrixOffset = TABLE.headerBytes
  const renderMatrixOffset = canonicalMatrixOffset + instances.length * TABLE.matrixStrideBytes
  const boundsOffset = renderMatrixOffset + instances.length * TABLE.matrixStrideBytes
  const keysOffset = boundsOffset + units.length * TABLE.boundsStrideBytes
  const totalBytes = keysOffset + units.length * TABLE.keyStrideBytes
  const output = Buffer.alloc(totalBytes)
  output.write(TABLE.magic, 0, 8, 'ascii')
  output.writeUInt32LE(TABLE.version, 8)
  output.writeUInt32LE(instances.length, 12)
  output.writeUInt32LE(EXPECTED.segmentCount, 16)
  output.writeUInt32LE(units.length, 20)
  output.writeUInt32LE(canonicalMatrixOffset, 24)
  output.writeUInt32LE(TABLE.matrixStrideBytes, 28)
  output.writeUInt32LE(renderMatrixOffset, 32)
  output.writeUInt32LE(TABLE.matrixStrideBytes, 36)
  output.writeUInt32LE(boundsOffset, 40)
  output.writeUInt32LE(TABLE.boundsStrideBytes, 44)
  output.writeUInt32LE(keysOffset, 48)
  output.writeUInt32LE(TABLE.keyStrideBytes, 52)
  output.writeUInt32LE(totalBytes, 56)
  output.writeUInt32LE(0x01020304, 60)
  let offset = canonicalMatrixOffset
  for (const instance of instances) for (const value of instance.ownerLocalMatrix) {
    output.writeDoubleLE(value, offset)
    offset += 8
  }
  assert.equal(offset, renderMatrixOffset)
  for (const instance of instances) for (const value of renderLocalMatrix(instance.ownerLocalMatrix, instance.parity)) {
    output.writeDoubleLE(value, offset)
    offset += 8
  }
  assert.equal(offset, boundsOffset)
  for (const unit of units) for (const value of [...unit.bounds.min, ...unit.bounds.max]) {
    output.writeDoubleLE(value, offset)
    offset += 8
  }
  assert.equal(offset, keysOffset)
  for (const unit of units) {
    output.writeUInt32LE(unit.sourceId, offset)
    output.writeUInt32LE(unit.segmentId, offset + 4)
    offset += 8
  }
  assert.equal(offset, totalBytes)
  return {
    output,
    layout: {
      magic: TABLE.magic,
      version: TABLE.version,
      endianness: 'little',
      numericContract: 'canonical matrices, parity-safe render-local matrices, and bounds are IEEE-754 Float64; keys are Uint32',
      headerBytes: TABLE.headerBytes,
      sourceCount: instances.length,
      segmentCount: EXPECTED.segmentCount,
      unitCount: units.length,
      canonicalMatrices: { offsetBytes: canonicalMatrixOffset, strideBytes: TABLE.matrixStrideBytes, count: instances.length, components: 16 },
      renderLocalMatrices: { offsetBytes: renderMatrixOffset, strideBytes: TABLE.matrixStrideBytes, count: instances.length, components: 16 },
      bounds: { offsetBytes: boundsOffset, strideBytes: TABLE.boundsStrideBytes, count: units.length, order: ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ'] },
      keys: { offsetBytes: keysOffset, strideBytes: TABLE.keyStrideBytes, count: units.length, order: ['sourceId', 'segmentId'] },
      totalBytes,
    },
  }
}

function parseCohortTable(bytes) {
  assert.ok(Buffer.isBuffer(bytes), 'cohort table must be a Buffer')
  assert.ok(bytes.length >= TABLE.headerBytes, 'cohort table is shorter than its fixed header')
  assert.equal(bytes.subarray(0, 8).toString('ascii'), TABLE.magic)
  assert.equal(bytes.readUInt32LE(8), TABLE.version)
  assert.equal(bytes.readUInt32LE(12), EXPECTED.sourceCount)
  assert.equal(bytes.readUInt32LE(16), EXPECTED.segmentCount)
  assert.equal(bytes.readUInt32LE(20), EXPECTED.unitCount)
  assert.equal(bytes.readUInt32LE(24), TABLE.headerBytes)
  assert.equal(bytes.readUInt32LE(28), TABLE.matrixStrideBytes)
  const renderMatrixOffset = TABLE.headerBytes + EXPECTED.sourceCount * TABLE.matrixStrideBytes
  const boundsOffset = renderMatrixOffset + EXPECTED.sourceCount * TABLE.matrixStrideBytes
  const keysOffset = boundsOffset + EXPECTED.unitCount * TABLE.boundsStrideBytes
  const totalBytes = keysOffset + EXPECTED.unitCount * TABLE.keyStrideBytes
  assert.equal(bytes.readUInt32LE(32), renderMatrixOffset)
  assert.equal(bytes.readUInt32LE(36), TABLE.matrixStrideBytes)
  assert.equal(bytes.readUInt32LE(40), boundsOffset)
  assert.equal(bytes.readUInt32LE(44), TABLE.boundsStrideBytes)
  assert.equal(bytes.readUInt32LE(48), keysOffset)
  assert.equal(bytes.readUInt32LE(52), TABLE.keyStrideBytes)
  assert.equal(bytes.readUInt32LE(56), totalBytes)
  assert.equal(bytes.readUInt32LE(56), bytes.length)
  assert.equal(bytes.readUInt32LE(60), 0x01020304)
  return {
    canonicalMatrices: { offsetBytes: TABLE.headerBytes, strideBytes: TABLE.matrixStrideBytes, count: EXPECTED.sourceCount },
    renderLocalMatrices: { offsetBytes: renderMatrixOffset, strideBytes: TABLE.matrixStrideBytes, count: EXPECTED.sourceCount },
    bounds: { offsetBytes: boundsOffset, strideBytes: TABLE.boundsStrideBytes, count: EXPECTED.unitCount },
    keys: { offsetBytes: keysOffset, strideBytes: TABLE.keyStrideBytes, count: EXPECTED.unitCount },
    totalBytes,
  }
}

function auditCohortTable(bytes, instances, units) {
  const layout = parseCohortTable(bytes)
  let canonicalMatrixMaxDelta = 0
  let offset = layout.canonicalMatrices.offsetBytes
  for (const instance of instances) for (const expected of instance.ownerLocalMatrix) {
    const observed = bytes.readDoubleLE(offset)
    canonicalMatrixMaxDelta = Math.max(canonicalMatrixMaxDelta, Math.abs(expected - observed))
    assert.ok(Object.is(expected, observed), `${instance.sourceIndex}: Float64 matrix round-trip changed`)
    offset += 8
  }
  let renderMatrixMaxDelta = 0
  let renderRecompositionMaxDelta = 0
  let unsafeRenderLocalMatrices = 0
  offset = layout.renderLocalMatrices.offsetBytes
  for (const instance of instances) {
    const expectedMatrix = renderLocalMatrix(instance.ownerLocalMatrix, instance.parity)
    const observedMatrix = []
    for (const expected of expectedMatrix) {
      const observed = bytes.readDoubleLE(offset)
      observedMatrix.push(observed)
      renderMatrixMaxDelta = Math.max(renderMatrixMaxDelta, Math.abs(expected - observed))
      assert.ok(Object.is(expected, observed), `${instance.sourceIndex}: parity-safe render matrix changed`)
      offset += 8
    }
    if (!(determinant(observedMatrix) > 0)) unsafeRenderLocalMatrices += 1
    const recomposed = recomposeRenderMatrix(observedMatrix, instance.parity)
    renderRecompositionMaxDelta = Math.max(renderRecompositionMaxDelta, matrixMaxDelta(recomposed, instance.ownerLocalMatrix))
    assert.ok(recomposed.every((value, index) => Object.is(value, instance.ownerLocalMatrix[index])), `${instance.sourceIndex}: host/local recomposition changed canonical matrix`)
  }
  assert.equal(unsafeRenderLocalMatrices, 0, 'negative/zero determinant InstancedMesh matrix found')
  let boundsMaxDelta = 0
  offset = layout.bounds.offsetBytes
  for (const unit of units) for (const expected of [...unit.bounds.min, ...unit.bounds.max]) {
    const observed = bytes.readDoubleLE(offset)
    boundsMaxDelta = Math.max(boundsMaxDelta, Math.abs(expected - observed))
    assert.ok(Object.is(expected, observed), `${unit.unitId}: Float64 bound round-trip changed`)
    offset += 8
  }
  offset = layout.keys.offsetBytes
  const decodedKeys = []
  for (const unit of units) {
    const sourceId = bytes.readUInt32LE(offset)
    const segmentId = bytes.readUInt32LE(offset + 4)
    assert.equal(sourceId, unit.sourceId)
    assert.equal(segmentId, unit.segmentId)
    decodedKeys.push(`${sourceId}:${segmentId}`)
    offset += 8
  }
  assert.equal(new Set(decodedKeys).size, EXPECTED.unitCount, 'duplicate source/segment key')
  return {
    matrixMaxDelta: canonicalMatrixMaxDelta,
    renderMatrixMaxDelta,
    renderRecompositionMaxDelta,
    unsafeRenderLocalMatrices,
    boundsMaxDelta,
    keysExact: true,
    headerExact: true,
  }
}

function expectReject(label, operation) {
  let rejected = false
  let message = null
  try {
    operation()
  } catch (error) {
    rejected = true
    message = String(error?.message ?? error)
  }
  assert.equal(rejected, true, `${label}: malformed evidence was accepted`)
  return { label, rejected: true, message }
}

function assertBudgetEvidence(sweepEvidence) {
  assert.ok(sweepEvidence.triangles <= POLICY.repeatFamilyResidentLimit, 'repeat-family resident budget exceeded')
}

function negativeControlAudit(validBytes, instances, units, validSweep) {
  const layout = parseCohortTable(validBytes)
  const controls = []
  const mutation = () => Buffer.from(validBytes)
  controls.push(expectReject('corrupt-header-magic', () => {
    const bytes = mutation()
    bytes[0] ^= 0xff
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('corrupt-endian-marker', () => {
    const bytes = mutation()
    bytes.writeUInt32LE(0x04030201, 60)
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('truncated-length', () => auditCohortTable(validBytes.subarray(0, -8), instances, units)))
  controls.push(expectReject('mutated-float64-canonical-matrix', () => {
    const bytes = mutation()
    bytes.writeDoubleLE(bytes.readDoubleLE(layout.canonicalMatrices.offsetBytes) + 0.125, layout.canonicalMatrices.offsetBytes)
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('rounded-or-signed-zero-lost-canonical-matrix', () => {
    const bytes = mutation()
    let target = null
    for (const [instanceIndex, instance] of instances.entries()) {
      for (const [componentIndex, value] of instance.ownerLocalMatrix.entries()) {
        const rounded = Number(value.toPrecision(15))
        if (!Object.is(value, rounded)) {
          target = { instanceIndex, componentIndex, rounded }
          break
        }
      }
      if (target) break
    }
    assert.ok(target, 'raw production matrix fixture no longer distinguishes 15-digit rounding or signed-zero loss')
    const offset = layout.canonicalMatrices.offsetBytes +
      target.instanceIndex * TABLE.matrixStrideBytes + target.componentIndex * 8
    bytes.writeDoubleLE(target.rounded, offset)
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('mutated-float64-bound', () => {
    const bytes = mutation()
    bytes.writeDoubleLE(bytes.readDoubleLE(layout.bounds.offsetBytes) + 0.125, layout.bounds.offsetBytes)
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('duplicate-source-segment-identity', () => {
    const bytes = mutation()
    bytes.writeUInt32LE(bytes.readUInt32LE(layout.keys.offsetBytes), layout.keys.offsetBytes + TABLE.keyStrideBytes)
    bytes.writeUInt32LE(bytes.readUInt32LE(layout.keys.offsetBytes + 4), layout.keys.offsetBytes + TABLE.keyStrideBytes + 4)
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('unsafe-negative-instance-parity', () => {
    const bytes = mutation()
    const mirroredIndex = instances.findIndex((instance) => instance.parity === 'mirrored')
    assert.ok(mirroredIndex >= 0)
    const canonicalOffset = layout.canonicalMatrices.offsetBytes + mirroredIndex * TABLE.matrixStrideBytes
    const renderOffset = layout.renderLocalMatrices.offsetBytes + mirroredIndex * TABLE.matrixStrideBytes
    bytes.copy(bytes, renderOffset, canonicalOffset, canonicalOffset + TABLE.matrixStrideBytes)
    auditCohortTable(bytes, instances, units)
  }))
  controls.push(expectReject('over-budget-submitted-weight', () => assertBudgetEvidence({
    ...validSweep,
    triangles: POLICY.repeatFamilyResidentLimit + 1,
  })))
  return { passed: true, count: controls.length, controls }
}

async function assetRecord(path, pilotRoot) {
  const bytes = await readFile(path)
  return { path: relative(pilotRoot, path).split(sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

export async function buildRepeatSixPartExactCohortPilot({
  productionModel = DEFAULT_PRODUCTION_MODEL,
  pilotRoot = DEFAULT_PILOT_ROOT,
} = {}) {
  const resolvedPilotRoot = resolve(pilotRoot)
  const paths = outputPaths(resolvedPilotRoot)
  await mkdir(resolve(paths.geometry, '..'), { recursive: true })
  await mkdir(resolve(paths.cohortTable, '..'), { recursive: true })

  // This direct-production builder is the sole source of geometry, transforms,
  // approved logical source IDs/paths, and physical source proof. It reads the
  // pinned production GLB plus the pinned tracked approval certificate and does
  // not consult ignored migration artifacts.
  const productionSource = await buildRepeatSixPartProductionSourcePilot({
    productionModel,
    outputRoot: paths.productionSourceRoot,
    verifyCurrentMapping: false,
  })
  assert.equal(productionSource.currentMappingReference, null, 'clean cohort build unexpectedly consumed the historical instance map')
  const [productionGeometryBytes, productionSourceMapBytes, productionAuditBytes] = await Promise.all([
    readFile(productionSource.paths.geometry),
    readFile(productionSource.paths.sourceMap),
    readFile(productionSource.paths.audit),
  ])
  const productionSourceMap = JSON.parse(productionSourceMapBytes)
  const productionAudit = JSON.parse(productionAuditBytes)
  assert.equal(productionAudit.status, 'PASS')
  assert.equal(productionAudit.disabled, true)
  assert.equal(productionAudit.runtimeIntegrated, false)
  assert.deepEqual(productionAudit.sourceModel, PRODUCTION_MODEL_PIN)
  assert.equal(productionAudit.geometry.source.sha256, EXPECTED.productionGeometryDigest)
  assert.equal(productionAudit.geometry.written.sha256, EXPECTED.productionGeometryDigest)
  assert.equal(productionAudit.geometry.normalStorageBitsAndNormalizationPreserved, true)
  assert.equal(productionAudit.historicalLogicalOrderContract.status, 'APPROVED_TRACKED_CERTIFICATE_REVERIFIED_BY_CLEAN_BUILD')
  assert.deepEqual(productionSourceMap.logicalMappingCertificate, productionAudit.logicalMappingCertificate)
  assert.deepEqual(productionSourceMap.logicalMappingCertificate, productionSource.logicalMapping)
  assert.equal(productionSourceMap.logicalMappingCertificate.evidenceValidated, true)
  assert.equal(productionSourceMap.logicalMappingCertificate.technicalMappingPassed, true)
  assert.equal(productionSourceMap.logicalMappingCertificate.provenanceApproved, true)
  assert.equal(productionSourceMap.logicalMappingCertificate.logicalOwnershipMappingPassed, true)
  assert.equal(productionSourceMap.logicalMappingCertificate.activationBlocked, true)
  assert.equal(productionSourceMap.transformSetSha256, EXPECTED.transformSetSha256)
  assert.equal(productionSourceMap.sourceIdsSha256, EXPECTED.sourceIdsSha256)
  assert.equal(productionSourceMap.sourcePathsSha256, EXPECTED.sourcePathsSha256)
  assert.deepEqual(productionSourceMap.sourceModel, PRODUCTION_MODEL_PIN)
  assert.equal(productionSourceMap.instances.length, EXPECTED.sourceCount)

  // Copy the already-audited exact production segmentation byte-for-byte.
  // Re-encoding here would add no value and could silently alter accessor
  // component types, in particular the normalized Int16 NORMAL storage.
  await writeFile(paths.geometry, productionGeometryBytes)
  const io = await createGltfIO({ encoder: true })
  const writtenGeometryDocument = await io.read(paths.geometry)
  const writtenGeometry = geometryDigest(writtenGeometryDocument)
  const segments = segmentAudit(writtenGeometryDocument)
  assert.equal(writtenGeometry.triangles, EXPECTED.sourceTriangles)
  assert.equal(writtenGeometry.sha256, EXPECTED.productionGeometryDigest, 'shared geometry no longer exactly recomposes production raw geometry')
  assert.equal(writtenGeometry.triangles, productionAudit.geometry.written.triangles, 'cohort production triangle count diverged')
  assert.equal(writtenGeometry.sha256, productionAudit.geometry.written.sha256, 'cohort raw production geometry digest diverged')
  assert.deepEqual(writtenGeometry.trianglesByMaterial, productionAudit.geometry.written.trianglesByMaterial,
    'cohort production material assignment diverged')
  assert.deepEqual(
    writtenGeometry.segmentDigests,
    productionAudit.geometry.segmentDigests.map(({ segment, triangles, canonicalOrientedGeometrySha256 }) => ({
      segment,
      triangles,
      canonicalOrientedGeometrySha256,
    })),
    'cohort per-segment oriented geometry assignment diverged from the pinned direct-production partition',
  )
  assert.equal(segments.records.reduce((sum, record) => sum + record.triangles, 0), EXPECTED.sourceTriangles)
  assert.ok(segments.records.every((record) => record.nodeMatrix.every((value, index) => value === IDENTITY_MATRIX[index])))
  assert.equal(segments.textures, 0)

  const instances = [...productionSourceMap.instances]
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
    .map((instance) => ({
      ...instance,
      ownerLocalMatrix: matrixFromFloat64LEHex(
        instance.ownerLocalMatrixFloat64LEHex,
        `source ${instance.sourceIndex}`,
      ),
    }))
  assert.deepEqual(instances.map((instance) => instance.sourceIndex), Array.from({ length: EXPECTED.sourceCount }, (_, index) => index))
  assert.equal(sha256(Buffer.from(stableStringify(instances.map((instance) => instance.sourceIndex)))), EXPECTED.sourceIdsSha256)
  assert.equal(sha256(Buffer.from(stableStringify(instances.map((instance) => instance.sourcePath)))), EXPECTED.sourcePathsSha256)
  const transformSetSha256 = sha256(Buffer.from(stableStringify(instances.map((instance) => ({
    sourceIndex: instance.sourceIndex,
    name: instance.sourceName,
    matrixFloat64LEHex: instance.ownerLocalMatrixFloat64LEHex,
  })))))
  assert.equal(transformSetSha256, EXPECTED.transformSetSha256)

  const parityCounts = { positive: 0, mirrored: 0 }
  const ownershipRows = instances.map((instance, matrixTableIndex) => {
    assert.equal(instance.ownerLocalMatrix.length, 16)
    assert.ok(finite(instance.ownerLocalMatrix))
    const observedParity = determinant(instance.ownerLocalMatrix) > 0 ? 'positive' : 'mirrored'
    assert.equal(observedParity, instance.parity, `${instance.sourceIndex}: parity/determinant mismatch`)
    parityCounts[instance.parity] += 1
    return {
      sourceId: instance.sourceIndex,
      sourceName: instance.sourceName,
      sourcePath: instance.sourcePath,
      productionInstanceIndex: instance.productionInstanceIndex,
      parity: instance.parity,
      determinant: instance.determinant,
      matrixTableIndex,
      elevationBand: elevationBandFromProductionMatrix(instance),
    }
  })
  assert.deepEqual(parityCounts, {
    positive: productionAudit.transforms.positive,
    mirrored: productionAudit.transforms.mirrored,
  }, 'cohort parity counts diverged from direct-production physical audit')
  assert.equal(parityCounts.positive + parityCounts.mirrored, EXPECTED.sourceCount)

  const units = []
  for (const instance of instances) {
    const owner = ownershipRows[instance.sourceIndex]
    for (const segment of segments.records) {
      const bounds = transformBounds(segment.measuredReferencedAccessorBounds, instance.ownerLocalMatrix)
      assert.ok(finite([...bounds.min, ...bounds.max]))
      units.push({
        unitId: `source-${String(instance.sourceIndex).padStart(2, '0')}:segment-${String(segment.segmentId).padStart(2, '0')}`,
        sourceId: instance.sourceIndex,
        sourcePath: instance.sourcePath,
        parity: instance.parity,
        elevationBand: owner.elevationBand,
        segmentId: segment.segmentId,
        triangles: segment.triangles,
        bounds,
      })
    }
  }
  assert.equal(units.length, EXPECTED.unitCount)
  assert.equal(new Set(units.map((unit) => unit.unitId)).size, EXPECTED.unitCount)
  assert.ok(instances.every((instance) => units.filter((unit) => unit.sourceId === instance.sourceIndex).length === EXPECTED.segmentCount))

  const identityDigestSha256 = sha256(Buffer.from(stableStringify(ownershipRows.map((row) => ({
    sourceId: row.sourceId,
    sourcePath: row.sourcePath,
    parity: row.parity,
    matrixFloat64LEHex: instances[row.matrixTableIndex].ownerLocalMatrixFloat64LEHex,
  })))))
  const segmentIdentityDigestSha256 = sha256(Buffer.from(stableStringify(units.map((unit) => ({
    sourceId: unit.sourceId,
    sourcePath: unit.sourcePath,
    parity: unit.parity,
    segmentId: unit.segmentId,
    bounds: unit.bounds,
  })))))
  const boundsDigestSha256 = sha256(Buffer.from(stableStringify(units.map((unit) => unit.bounds))))

  const cohortTable = buildCohortTable(instances, units)
  const tableAudit = auditCohortTable(cohortTable.output, instances, units)
  await writeFile(paths.cohortTable, cohortTable.output)

  const outerSweep = sweep(units, POLICY.exactSelectionMarginMeters, 'exact-six-part-outer-envelope')
  const innerSweep = sweep(units, POLICY.innerEnvelopeMeters, 'exact-six-part-inner-envelope')
  const activeDrawPeak = maxActiveParitySegmentGroups(units, POLICY.exactSelectionMarginMeters)
  assert.ok(outerSweep.projectedParitySafeInstancedDraws <= EXPECTED.segmentCount * 2 * EXPECTED.materialNames.length)
  assert.ok(activeDrawPeak.draws <= EXPECTED.segmentCount * 2 * EXPECTED.materialNames.length)
  const negativeControls = negativeControlAudit(cohortTable.output, instances, units, outerSweep)

  const ownershipPayload = {
    schema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_OWNERSHIP_V2',
    version: 2,
    status: 'disabled-physical-pilot',
    platform: 'web',
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    owner: productionSourceMap.owner.nodeName,
    ownerContract: productionSourceMap.owner,
    productionInstancingNodes: productionSourceMap.productionInstancingNodes,
    mesh: 'production-repeat-six-part-shared-geometry',
    geometrySpace: 'production-instancing-local; payload geometry nodes are identity; exact production canonical owner-local row matrices and parity-safe render-local matrices are in cohort table',
    parityBatchContract: {
      directCanonicalMatrixUseInInstancedMeshAllowed: false,
      reason: 'Three.js InstancedMesh does not support negatively scaled instance matrices',
      positive: { hostMatrix: IDENTITY_MATRIX, hostDeterminant: 1 },
      mirrored: { hostMatrix: MIRRORED_HOST_MATRIX, hostDeterminant: -1 },
      renderLocalMatrixContract: 'renderLocal = inverse(host) * canonicalOwnerLocal; every render-local determinant is positive; host * renderLocal exactly recomposes canonicalOwnerLocal',
      persistentParitySegmentMaterialTemplates: EXPECTED.segmentCount * 2 * EXPECTED.materialNames.length,
    },
    binaryTable: cohortTable.layout,
    sourceCount: EXPECTED.sourceCount,
    segmentCount: EXPECTED.segmentCount,
    unitCount: EXPECTED.unitCount,
    materialRoles: EXPECTED.materialNames,
    segments: segments.records.map((segment) => ({
      segmentId: segment.segmentId,
      stations: segment.stations,
      triangles: segment.triangles,
      trianglesByMaterial: segment.trianglesByMaterial,
      measuredReferencedAccessorBounds: segment.measuredReferencedAccessorBounds,
    })),
    instances: ownershipRows,
    digests: {
      sourceIdsSha256: EXPECTED.sourceIdsSha256,
      sourcePathsSha256: EXPECTED.sourcePathsSha256,
      transformSetSha256,
      rowIdentityDigestSha256: identityDigestSha256,
      segmentIdentityDigestSha256,
      measuredUnitBoundsSha256: boundsDigestSha256,
    },
  }
  await writeJson(paths.ownership, ownershipPayload)

  const largestSegmentTriangles = Math.max(...segments.records.map((segment) => segment.triangles))
  const transitions = {
    steadyResidentRepeatTriangles: outerSweep.triangles,
    arithmeticScenarios: {
      oneLargestSegmentOverlapRepeatTriangles: outerSweep.triangles + largestSegmentTriangles,
      oneWholeRowOverlapRepeatTriangles: outerSweep.triangles + EXPECTED.sourceTriangles,
      oneWholeRowOverlapAllOwnerReservedTriangles: outerSweep.triangles + EXPECTED.sourceTriangles + POLICY.allOtherOwnerReservation,
      runtimeOrderingProven: false,
    },
    unorderedDoubleBufferUpperBoundRepeatTriangles: outerSweep.triangles * 2,
    unorderedDoubleBufferUpperBoundAllOwnerReservedTriangles: outerSweep.triangles * 2 + POLICY.allOtherOwnerReservation,
    unorderedDoubleBufferWithinRepeatBudget: outerSweep.triangles * 2 <= POLICY.repeatFamilyTransitionLimit,
    unorderedDoubleBufferWithinTotalBudget: outerSweep.triangles * 2 + POLICY.allOtherOwnerReservation <= POLICY.totalTransitionLimit,
    arbitraryConcurrentOverlapProven: false,
    runtimeOrderingEnforced: false,
    transitionBudgetPassed: false,
  }
  assert.ok(outerSweep.triangles <= POLICY.repeatFamilyResidentLimit)
  assert.ok(transitions.arithmeticScenarios.oneWholeRowOverlapRepeatTriangles <= POLICY.repeatFamilyTransitionLimit)
  assert.ok(transitions.arithmeticScenarios.oneWholeRowOverlapAllOwnerReservedTriangles <= POLICY.totalTransitionLimit)
  assert.equal(transitions.unorderedDoubleBufferWithinRepeatBudget, false)
  assert.equal(transitions.unorderedDoubleBufferWithinTotalBudget, false)

  const [geometryAsset, cohortTableAsset, ownershipAsset] = await Promise.all([
    assetRecord(paths.geometry, resolvedPilotRoot),
    assetRecord(paths.cohortTable, resolvedPilotRoot),
    assetRecord(paths.ownership, resolvedPilotRoot),
  ])
  const runtimePayloadBytes = geometryAsset.bytes + cohortTableAsset.bytes + ownershipAsset.bytes
  const physicalMetrics = {
    runtimePayloadRequests: 3,
    runtimePayloadBytes,
    encodedGeometryBytes: geometryAsset.bytes,
    decodedUniqueGeometryAccessorBytes: segments.decodedUniqueAccessorBytes,
    uniqueGeometryTriangles: EXPECTED.sourceTriangles,
    geometryNodes: segments.geometryNodes,
    physicalGeometryPrimitives: segments.drawTemplates,
    persistentParitySafeRendererTemplates: EXPECTED.segmentCount * 2 * EXPECTED.materialNames.length,
    cohortTableBytes: cohortTableAsset.bytes,
    ownershipMetadataBytes: ownershipAsset.bytes,
    sourceRows: EXPECTED.sourceCount,
    physicalSelectionUnits: EXPECTED.unitCount,
    duplicatedGeometryGlbs: 0,
    materialSlots: EXPECTED.materialNames.length,
    textureCount: 0,
    encodedTextureBytes: 0,
    gpuTextureBytes: 0,
    steadyWorstNaiveDraws: outerSweep.naiveUnitDraws,
    residentTriangleWitnessParitySafeDraws: outerSweep.projectedParitySafeInstancedDraws,
    globalActiveParitySafeDrawPeak: activeDrawPeak.draws,
    conservativeDoubleBufferedDrawPeakUntilRuntimeEnforced: activeDrawPeak.draws * 2,
  }

  const [productionGeometryInput, productionSourceMapInput, productionAuditInput] = await Promise.all([
    assetRecord(productionSource.paths.geometry, resolvedPilotRoot),
    assetRecord(productionSource.paths.sourceMap, resolvedPilotRoot),
    assetRecord(productionSource.paths.audit, resolvedPilotRoot),
  ])

  const audit = {
    schema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_PHYSICAL_AUDIT_V2',
    version: 2,
    status: 'pass-disabled-not-activation-approval',
    inputs: {
      productionModel: PRODUCTION_MODEL_PIN,
      directProductionGeometry: productionGeometryInput,
      directProductionSourceMap: productionSourceMapInput,
      directProductionPhysicalAudit: productionAuditInput,
    },
    excludedRequiredDependencies: [
      'tmp/icm-anim-2025-cleaned.glb',
      'tmp/repeat-lod-ground-floor/Mesh.13786-near-source.glb',
      'tmp/repeat-segmented-row-proxy/exact-recomposition-report.json',
      'tmp/repeat-instancing-ground-floor/instance-map.json',
      'tmp/repeat-spatial-payload-v2/index.json',
      'tmp/repeat-spatial-payload-v3/index.json',
      'scripts/build-ground-floor-repeat-instancing-pilot.mjs parity-reference bytes',
    ],
    exactGeometry: {
      source: productionAudit.geometry.source,
      output: writtenGeometry,
      canonicalDigestMatch: true,
      triangleBijection: true,
      positionFloat32BitsPreserved: true,
      normalInt16StorageBitsAndNormalizationPreserved: true,
      windingPreserved: true,
      materialAssignmentsPreserved: true,
      perSegmentOrientedDigestsPreserved: true,
      segmentDigests: writtenGeometry.segmentDigests,
      materialRoles: EXPECTED.materialNames,
      segments: segments.records,
    },
    transformsAndIdentity: {
      sourceIdsBijection: true,
      sourcePathsBijection: true,
      sourcePathsUnique: new Set(ownershipRows.map((row) => row.sourcePath)).size === EXPECTED.sourceCount,
      authoritativeSource: 'pinned production EXT_mesh_gpu_instancing decoded TRS',
      productionTransformCompositionOrder: productionSourceMap.transformCompositionOrder,
      historicalLogicalOrderContractCarriedForward: true,
      historicalLogicalOrderReverifiedByCleanBuild: true,
      historicalLogicalOrderStatus: productionAudit.historicalLogicalOrderContract.status,
      physicalTransformsAndParityPassed: true,
      logicalOwnershipMappingPassed: true,
      logicalMappingCertificate: productionSourceMap.logicalMappingCertificate,
      transformSetSha256,
      transformBinaryFloat64RoundTripMaxDelta: tableAudit.matrixMaxDelta,
      parityDeterminantsMatch: true,
      parityCounts,
      directNegativeInstanceMatricesForbidden: true,
      renderLocalMatricesAllPositiveDeterminant: tableAudit.unsafeRenderLocalMatrices === 0,
      renderLocalBinaryFloat64RoundTripMaxDelta: tableAudit.renderMatrixMaxDelta,
      hostTimesRenderLocalRecompositionMaxDelta: tableAudit.renderRecompositionMaxDelta,
      parityHostMatrices: { positive: IDENTITY_MATRIX, mirrored: MIRRORED_HOST_MATRIX },
      rowIdentityDigestSha256: identityDigestSha256,
      segmentIdentityDigestSha256,
    },
    measuredBounds: {
      finite: true,
      independentlyDecodedFromPhysicalBinary: true,
      binaryRoundTripMaxDelta: tableAudit.boundsMaxDelta,
      unitCount: units.length,
      digestSha256: boundsDigestSha256,
      layout: 'source-major, then segment 0..5',
    },
    physicalMetrics,
    sweeps: {
      method: 'exact maximum weighted overlap of closed owner-local AABBs; measured physical unit bounds; selector margins applied numerically',
      inner: innerSweep,
      outer: outerSweep,
      activeDrawPeak,
      allOwnerReservedResidentTriangles: outerSweep.triangles + POLICY.allOtherOwnerReservation,
      transitions,
    },
    negativeControls,
    payloads: { geometry: geometryAsset, cohortTable: cohortTableAsset, ownership: ownershipAsset },
    activationFlags: {
      enabled: false,
      ready: false,
      runtimeIntegrated: false,
      activationApproved: false,
      productionManifestChanged: false,
      productionRoutingChanged: false,
    },
    blockers: [
      'No runtime selector, parity/segment matrix compactor, identity fan-out, or inspect/hide/isolate integration exists.',
      'No hard transition concurrency, cancellation, stale-load disposal, or recovery contract is implemented.',
      'Without enforced publish ordering, the full old-plus-new double-buffer transition exceeds both repeat-family and all-owner transition budgets.',
      'No mixed segment-state browser render at exact selector witnesses or 5.5 m exit boundary exists.',
      'No desktop/mobile frame-time, upload, request/cache, or GPU memory measurement exists.',
      'Parity-safe host/local instancing, draw compaction, and per-unit bounds selection are physically specified but not runtime-measured.',
      'Quest is explicitly outside this pilot and remains on exact Quest LOD0.',
    ],
  }
  await writeJson(paths.audit, audit)
  const auditAsset = await assetRecord(paths.audit, resolvedPilotRoot)

  const index = {
    schema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_CANDIDATE_V2',
    version: 2,
    status: 'disabled-physical-pilot',
    platform: 'web',
    webOnly: true,
    questSupported: false,
    enabled: false,
    ready: false,
    runtimeIntegrated: false,
    activationApproved: false,
    productionManifestChanged: false,
    productionRoutingChanged: false,
    owner: productionSourceMap.owner.nodeName,
    mesh: 'production-repeat-six-part-shared-geometry',
    layout: {
      id: 'global-parity-segment-major-dynamic-cohort-v2',
      physicalRuntimePayloadRequests: 3,
      sharedImmutableGeometry: true,
      duplicatedGeometryGlbs: 0,
      sourceRows: EXPECTED.sourceCount,
      segmentsPerRow: EXPECTED.segmentCount,
      independentSelectionUnits: EXPECTED.unitCount,
      rendererPlan: 'split positive/mirrored parity; compact selected positive-determinant render-local matrices into one InstancedMesh per parity/segment/material; 48 persistent templates',
      parityContract: 'positive host = identity; mirrored host = fixed X reflection; host * positive-determinant render-local matrix exactly recomposes canonical owner-local matrix; canonical negative matrices must never be passed directly to InstancedMesh',
      selectorContract: 'use measured per-source/per-segment bounds from cohort table; never use broad global render-batch bounds for residency selection',
    },
    sourcePins: audit.inputs,
    payloads: { geometry: geometryAsset, cohortTable: cohortTableAsset, ownership: ownershipAsset },
    physicalAudit: auditAsset,
    exactness: {
      sourceTriangles: EXPECTED.sourceTriangles,
      outputTriangles: writtenGeometry.triangles,
      canonicalGeometryMaterialDigestSha256: writtenGeometry.sha256,
      normalStorage: 'normalized Int16, raw storage bits preserved',
      sourceTriangleMaterialNormalWindingBijection: true,
      transformsFloat64BitExact: true,
      signedZeroBitsPreserved: true,
      parityExact: true,
      instancedMatricesPositiveDeterminant: true,
      hostLocalWorldRecompositionExact: true,
    },
    ownership: {
      sourceCount: EXPECTED.sourceCount,
      unitCount: EXPECTED.unitCount,
      segmentIds: [0, 1, 2, 3, 4, 5],
      sourceIdsSha256: EXPECTED.sourceIdsSha256,
      sourcePathsSha256: EXPECTED.sourcePathsSha256,
      transformSetSha256,
      rowIdentityDigestSha256: identityDigestSha256,
      segmentIdentityDigestSha256,
      measuredUnitBoundsSha256: boundsDigestSha256,
      logicalMappingCertificate: productionSourceMap.logicalMappingCertificate,
    },
    metrics: physicalMetrics,
    policy: POLICY,
    sweeps: audit.sweeps,
    gates: {
      inputPinsPassed: true,
      exactGeometryPassed: true,
      physicalTransformsAndParityPassed: true,
      logicalOwnershipMappingPassed: true,
      identityAndParityPassed: true,
      physicalBoundsPassed: true,
      repeatResidentBudgetPassed: true,
      reservedAllOwnerResidentBudgetPassed: true,
      oneRowArithmeticScenarioWithinBudget: true,
      unorderedDoubleBufferTransitionBudgetPassed: false,
      transitionBudgetPassed: false,
      paritySafeBatchingPassed: true,
      malformedEvidenceNegativeControlsPassed: negativeControls.passed,
      runtimeIntegrationPassed: false,
      runtimeConcurrencyPassed: false,
      browserVisualWitnessPassed: false,
      measuredPerformancePassed: false,
      questPassed: false,
      activationPassed: false,
    },
    blockers: audit.blockers,
  }
  index.reproducibilityDigestSha256 = sha256(Buffer.from(stableStringify(index)))
  await writeJson(paths.index, index)

  const report = `# Exact six-part repeat-row cohort physical pilot

Status: **physical payload and offline audit pass; activation remains disabled and fail-closed**. This is one Web-only ignored-temp layout. It does not edit runtime, manifests, tracked files, production routing, or Quest assets.

## One layout built

The pilot stores the six exact three-seat production segments once, then stores all 78 production-authoritative canonical owner-local row matrices, their parity-safe render-local matrices, and all 468 recomputed source/segment bounds in one deterministic binary cohort table. A compact ownership JSON keeps the pinned historical source paths, parity, and explicitly defined low/middle/high seating-elevation band. Runtime rendering is designed to compact selected positive-determinant matrices into 48 parity-by-segment-by-material templates; residency selection must continue to use each unit's measured bound, never the broad global render-batch bound.

Runtime payload requests: **3**. Duplicate geometry GLBs: **0**.

## Exactness

- Sole authoritative source: tracked production Web GLB, ${PRODUCTION_MODEL_PIN.bytes.toLocaleString('en-US')} bytes, SHA-256 \`${PRODUCTION_MODEL_PIN.sha256}\`.
- Source row: ${EXPECTED.sourceTriangles.toLocaleString('en-US')} triangles and ${EXPECTED.materialNames.length} material roles.
- Source and physical geometry raw triangle/material/Float32-position/normalized-Int16-normal/winding digest: \`${writtenGeometry.sha256}\`.
- Missing, duplicated, rewound, or normal-modified triangles: **0**. Six pinned per-segment oriented digests also prove no triangle moved between selection segments.
- Exact canonical row matrices are decoded from their authoritative little-endian Float64 hex source and hoisted bit-for-bit into the cohort table, including signed zero; binary round-trip maximum delta: **${tableAudit.matrixMaxDelta}**.
- Mirrored rows are factorized directly from the production matrices using a fixed \`MIRROR_X\` host and positive-determinant render-local matrix. Host/local exact recomposition maximum delta: **${tableAudit.renderRecompositionMaxDelta}**; unsafe instance matrices: **${tableAudit.unsafeRenderLocalMatrices}**.
- Positive/mirrored determinant parity: **${parityCounts.positive} / ${parityCounts.mirrored}**, all matched.
- Row identity digest: \`${identityDigestSha256}\`.
- Segment identity digest: \`${segmentIdentityDigestSha256}\`.
- Physical production transforms and determinant parity pass. The clean build also revalidates the pinned, project-owner-approved 78-row logical mapping certificate against the production GLB; logical ownership and identity/parity gates therefore pass. This does not approve runtime integration or activation.

## Physical metrics

| Metric | Result |
|---|---:|
| Shared geometry GLB | ${geometryAsset.bytes.toLocaleString('en-US')} bytes |
| Cohort binary table | ${cohortTableAsset.bytes.toLocaleString('en-US')} bytes |
| Ownership JSON | ${ownershipAsset.bytes.toLocaleString('en-US')} bytes |
| Total runtime payload | ${runtimePayloadBytes.toLocaleString('en-US')} bytes |
| Decoded unique geometry accessors | ${segments.decodedUniqueAccessorBytes.toLocaleString('en-US')} bytes |
| Unique geometry / submitted source triangles | ${EXPECTED.sourceTriangles.toLocaleString('en-US')} |
| Physical selection units | ${EXPECTED.unitCount} |
| Physical geometry primitives | ${segments.drawTemplates} |
| Persistent parity-safe renderer templates | ${EXPECTED.segmentCount * 2 * EXPECTED.materialNames.length} |
| Worst steady naive draws | ${outerSweep.naiveUnitDraws} |
| Parity-safe draws at triangle-resident witness | ${outerSweep.projectedParitySafeInstancedDraws} |
| Exact global active draw peak | ${activeDrawPeak.draws} |
| Textures / encoded texture / GPU texture | 0 / 0 / 0 |

## Measured bounds and exact sweeps

Every segment bound was re-measured from the indices and POSITION accessor in the emitted GLB. Every owner-local unit bound was then generated with its pinned row matrix, serialized as Float64, decoded again, and compared at a maximum delta of **${tableAudit.boundsMaxDelta}**. Bounds digest: \`${boundsDigestSha256}\`.

| Envelope | Selected units | Selected rows | Repeat triangles | Naive draws | Instanced draws |
|---|---:|---:|---:|---:|---:|
| Inner ${POLICY.innerEnvelopeMeters} m | ${innerSweep.selectedUnits} | ${innerSweep.selectedRows} | ${innerSweep.triangles.toLocaleString('en-US')} | ${innerSweep.naiveUnitDraws} | ${innerSweep.projectedParitySafeInstancedDraws} |
| Outer ${POLICY.exactSelectionMarginMeters} m | ${outerSweep.selectedUnits} | ${outerSweep.selectedRows} | ${outerSweep.triangles.toLocaleString('en-US')} | ${outerSweep.naiveUnitDraws} | ${outerSweep.projectedParitySafeInstancedDraws} |

The separate exact active-batch sweep reaches **${activeDrawPeak.activeGroups} of ${activeDrawPeak.possibleGroups}** possible parity/segment groups at \`${JSON.stringify(activeDrawPeak.point)}\`, proving a global peak of **${activeDrawPeak.draws} draws**. The triangle-residency maximum occurs at a separately recomputed witness and activates **${outerSweep.projectedParitySafeInstancedDraws} draws**.

With the existing 500,000-triangle all-other-owner reservation, the conservative resident total is **${(outerSweep.triangles + POLICY.allOtherOwnerReservation).toLocaleString('en-US')} / ${POLICY.totalResidentLimit.toLocaleString('en-US')}**.

Bounded arithmetic transition scenarios (not runtime guarantees):

- One largest-segment overlap: **${transitions.arithmeticScenarios.oneLargestSegmentOverlapRepeatTriangles.toLocaleString('en-US')}** repeat triangles.
- One whole-row overlap: **${transitions.arithmeticScenarios.oneWholeRowOverlapRepeatTriangles.toLocaleString('en-US')}** repeat triangles.
- One whole-row overlap plus all-other-owner reservation: **${transitions.arithmeticScenarios.oneWholeRowOverlapAllOwnerReservedTriangles.toLocaleString('en-US')} / ${POLICY.totalTransitionLimit.toLocaleString('en-US')}**.

These scenarios fit their arithmetic limits, but no runtime ordering enforces them. The honest unordered old-plus-new upper bound is **${transitions.unorderedDoubleBufferUpperBoundRepeatTriangles.toLocaleString('en-US')}** repeat triangles and **${transitions.unorderedDoubleBufferUpperBoundAllOwnerReservedTriangles.toLocaleString('en-US')}** with the reservation, exceeding both transition limits. Transition approval is therefore **false**.

## Fail-closed negative controls

All **${negativeControls.count}** bounded mutations were rejected: corrupt magic, corrupt endian marker, truncated length, changed Float64 matrix, 15-digit rounding/signed-zero loss, changed Float64 bound, duplicate source/segment key, unsafe negative instance matrix, and over-budget submitted weight.

## Activation blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}

## Reproduce

\`npm --prefix building-viewer run test:repeat-six-part-exact-cohort:physical\`

The command performs two isolated clean builds, each starting from the pinned tracked production GLB, and writes \`determinism-proof.json\` only if the direct-production source artifacts and every cohort payload, audit, index, and report are byte-identical.
`
  await writeFile(paths.report, report)
  return {
    index,
    audit,
    paths,
    files: [paths.geometry, paths.cohortTable, paths.ownership, paths.audit, paths.index, paths.report],
    sourceFiles: [productionSource.paths.geometry, productionSource.paths.sourceMap, productionSource.paths.audit, productionSource.paths.report],
  }
}

async function hashes(filePaths, root) {
  return Object.fromEntries(await Promise.all(filePaths.map(async (path) => {
    const bytes = await readFile(path)
    return [relative(root, path).split(sep).join('/'), { bytes: bytes.length, sha256: sha256(bytes) }]
  })))
}

async function main() {
  const canonical = await buildRepeatSixPartExactCohortPilot()
  if (process.argv.includes('--verify-determinism')) {
    const first = await buildRepeatSixPartExactCohortPilot({ pilotRoot: resolve(DETERMINISM_ROOT, 'clean-a') })
    const second = await buildRepeatSixPartExactCohortPilot({ pilotRoot: resolve(DETERMINISM_ROOT, 'clean-b') })
    const firstHashes = {
      source: await hashes(first.sourceFiles, first.paths.pilotRoot),
      cohort: await hashes(first.files, first.paths.pilotRoot),
    }
    const secondHashes = {
      source: await hashes(second.sourceFiles, second.paths.pilotRoot),
      cohort: await hashes(second.files, second.paths.pilotRoot),
    }
    assert.deepEqual(secondHashes, firstHashes, 'isolated deterministic rebuild changed source or cohort file bytes')
    const proof = {
      schema: 'IOM_REPEAT_SIX_PART_EXACT_COHORT_DETERMINISM_V2',
      version: 2,
      passed: true,
      buildCount: 2,
      isolatedOutputRoots: true,
      soleTrackedInput: PRODUCTION_MODEL_PIN,
      comparedSourceFiles: Object.keys(firstHashes.source).length,
      comparedCohortFiles: Object.keys(firstHashes.cohort).length,
      first: firstHashes,
      second: secondHashes,
      identical: true,
    }
    await writeJson(canonical.paths.determinism, proof)
  }
  const index = JSON.parse(await readFile(canonical.paths.index, 'utf8'))
  console.log(JSON.stringify({
    status: index.status,
    enabled: index.enabled,
    payloads: index.payloads,
    metrics: index.metrics,
    outerSweep: index.sweeps.outer,
    transitions: index.sweeps.transitions,
    reproducibilityDigestSha256: index.reproducibilityDigestSha256,
    determinismVerified: process.argv.includes('--verify-determinism'),
  }, null, 2))
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  main().catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
}
