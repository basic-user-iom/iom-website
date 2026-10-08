/** Shared, development-only loader for the pinned exact six-part GLB. */

import {
  Box3,
  BufferGeometry,
  Material,
  Matrix4,
  Mesh,
  Vector3,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import type {
  RepeatSixPartActiveListManifestInput,
  RepeatSixPartVec3,
} from '../../RepeatSixPartActiveListPlanner'
import type {
  DevelopmentRepeatSixPartThreeGeometryTemplate,
} from '../DevelopmentRepeatSixPartThreeRendererPort'
import type {
  DormantRealSceneEvidence,
  PinnedDevelopmentAsset,
} from './RepeatSixPartRealSceneEvidence'

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

async function digestHex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function exactCatalogManifest(
  evidence: DormantRealSceneEvidence,
): RepeatSixPartActiveListManifestInput {
  const manifest = record(evidence.manifest, 'manifest')
  const geometry = record(manifest.geometry, 'manifest.geometry')
  const parity = record(manifest.parity, 'manifest.parity')
  const selector = record(manifest.selector, 'manifest.selector')
  const catalog = record(manifest.catalog, 'manifest.catalog')
  const budgets = record(manifest.budgets, 'manifest.budgets')
  if (
    !Array.isArray(geometry.segments) || geometry.segments.length !== 6 ||
    !Array.isArray(catalog.sources) || catalog.sources.length !== 78 ||
    !Array.isArray(catalog.units) || catalog.units.length !== 468 ||
    record(parity.hosts, 'manifest.parity.hosts').positive === undefined ||
    selector.boundsSpace !== 'owner-local' ||
    selector.defaultState !== 'culled' ||
    typeof budgets.repeatFamilyResidentTriangles !== 'number'
  ) {
    throw new Error('Pinned manifest is not the exact active-list planner input')
  }
  return manifest as unknown as RepeatSixPartActiveListManifestInput
}

export async function loadPinnedExactSixPartGeometry(
  pin: PinnedDevelopmentAsset,
): Promise<GLTF> {
  const response = await fetch(pin.url, { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Exact six-part geometry HTTP ${response.status}`)
  const contentLength = response.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) !== pin.bytes) {
    await response.body?.cancel()
    throw new Error('Exact six-part geometry Content-Length does not match its pin')
  }
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength !== pin.bytes) throw new Error('Exact six-part geometry byte length does not match its pin')
  if (await digestHex(bytes) !== pin.sha256) throw new Error('Exact six-part geometry SHA-256 does not match its pin')
  const baseUrl = new URL('.', new URL(pin.url, location.href)).href
  return new GLTFLoader().parseAsync(bytes, baseUrl)
}

function geometryTriangles(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3
}

export function extractExactSixPartTemplates(
  gltf: GLTF,
  manifest: RepeatSixPartActiveListManifestInput,
): readonly DevelopmentRepeatSixPartThreeGeometryTemplate[] {
  const templates: DevelopmentRepeatSixPartThreeGeometryTemplate[] = []
  const materialNames: string[] = []
  const identity = new Matrix4()
  gltf.scene.updateMatrixWorld(true)

  for (const segment of manifest.geometry.segments) {
    const segmentRoot = gltf.scene.children.find((child) => child.userData.segment === segment.index)
    if (!segmentRoot || !segmentRoot.matrix.equals(identity)) {
      throw new Error(`Exact GLB segment ${segment.index} is missing or transformed`)
    }
    const meshes: Mesh<BufferGeometry, Material | Material[]>[] = []
    segmentRoot.traverse((object) => {
      if (!object.matrix.equals(identity) || !object.matrixWorld.equals(identity)) {
        throw new Error(`Exact GLB segment ${segment.index} contains an intermediate transform`)
      }
      if (object instanceof Mesh) meshes.push(object as Mesh<BufferGeometry, Material | Material[]>)
    })
    if (meshes.length !== 4) throw new Error(`Exact GLB segment ${segment.index} must have four primitives`)

    let observedTriangles = 0
    meshes.forEach((mesh, materialIndex) => {
      if (Array.isArray(mesh.material) || !mesh.matrix.equals(identity)) {
        throw new Error(`Exact GLB segment ${segment.index} material ${materialIndex} is not direct`)
      }
      if (segment.index === 0) materialNames.push(mesh.material.name)
      else if (mesh.material.name !== materialNames[materialIndex]) {
        throw new Error(`Exact GLB material slot ${materialIndex} changes between segments`)
      }
      observedTriangles += geometryTriangles(mesh.geometry)
      templates.push(Object.freeze({
        segmentIndex: segment.index,
        materialIndex,
        geometry: mesh.geometry,
        material: mesh.material,
      }))
    })
    if (observedTriangles !== segment.triangles) {
      throw new Error(`Exact GLB segment ${segment.index} triangle count changed`)
    }
  }
  if (templates.length !== 24) throw new Error('Exact GLB did not produce 24 templates')
  return Object.freeze(templates)
}

export function exactCatalogBounds(manifest: RepeatSixPartActiveListManifestInput): Box3 {
  const bounds = new Box3().makeEmpty()
  for (const source of manifest.catalog.sources) {
    bounds.expandByPoint(new Vector3(...source.bounds.min))
    bounds.expandByPoint(new Vector3(...source.bounds.max))
  }
  if (bounds.isEmpty()) throw new Error('Exact catalog bounds are empty')
  return bounds
}

export function centerOfExactSource(
  manifest: RepeatSixPartActiveListManifestInput,
  sourceIndex = 0,
): RepeatSixPartVec3 {
  const bounds = manifest.catalog.sources[sourceIndex]?.bounds
  if (!bounds) throw new Error(`Exact source ${sourceIndex} does not exist`)
  return Object.freeze([
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ]) as RepeatSixPartVec3
}

export function disposeExactSixPartTemplateResources(
  templates: readonly DevelopmentRepeatSixPartThreeGeometryTemplate[],
): void {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  for (const template of templates) {
    geometries.add(template.geometry)
    materials.add(template.material)
  }
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}
