import { Mesh, type Object3D } from 'three'
import type {
  GLTF,
  GLTFReference,
} from 'three/addons/loaders/GLTFLoader.js'

type PrimitiveAssociation = GLTFReference & {
  primitives?: number
}

export type GltfLogicalMeshBinding = {
  owner: Object3D
  meshIndex: number
  primitives: readonly Mesh[]
}

/** Runtime-only parser provenance; never serialized into model userData. */
const bindingByPrimitive = new WeakMap<Mesh, GltfLogicalMeshBinding>()
const bindingByOwner = new WeakMap<Object3D, GltfLogicalMeshBinding>()

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

function clearOwnerBinding(owner: Object3D): void {
  const previous = bindingByOwner.get(owner)
  if (!previous) return
  for (const primitive of previous.primitives) {
    if (bindingByPrimitive.get(primitive) === previous) {
      bindingByPrimitive.delete(primitive)
    }
  }
  bindingByOwner.delete(owner)
}

/**
 * Capture GLTFLoader's parser-only proof that a Group and its direct Mesh
 * children are one logical multi-primitive glTF mesh.
 *
 * GLTFLoader associates the logical owner with `{ nodes, meshes }`, and each
 * generated render primitive with `{ meshes, primitives }`. A normal child
 * mesh node additionally has a `nodes` association and is therefore rejected.
 */
export function registerGltfLogicalMeshAssociations(gltf: GLTF): number {
  // Production GLTFLoader results provide parser associations, but verified
  // boundary tests and other valid loader adapters may intentionally expose
  // only the parsed scene. Association provenance is an optional hardening
  // signal, so absence must disable registration rather than fail the load.
  const associations = (
    gltf as GLTF & {
      parser?: { associations?: Map<Object3D, PrimitiveAssociation> }
    }
  ).parser?.associations
  if (!associations || typeof associations.get !== 'function') return 0

  const scenes = gltf.scenes?.length > 0
    ? gltf.scenes
    : gltf.scene
      ? [gltf.scene]
      : []
  const seenOwners = new Set<Object3D>()
  let registered = 0

  for (const scene of scenes) {
    scene.traverse((owner) => {
      if (seenOwners.has(owner) || (owner as Mesh).isMesh) return
      seenOwners.add(owner)
      clearOwnerBinding(owner)

      const ownerAssociation = associations.get(owner) as
        | PrimitiveAssociation
        | undefined
      const meshIndex = ownerAssociation?.meshes
      if (
        !ownerAssociation ||
        !nonNegativeInteger(ownerAssociation.nodes) ||
        !nonNegativeInteger(meshIndex) ||
        ownerAssociation.primitives !== undefined ||
        owner.children.length < 2
      ) {
        return
      }

      const indexedPrimitives: Array<{ index: number; mesh: Mesh }> = []
      for (const child of owner.children) {
        if (!(child as Mesh).isMesh || child.parent !== owner) return
        const childAssociation = associations.get(child) as
          | PrimitiveAssociation
          | undefined
        if (
          !childAssociation ||
          childAssociation.nodes !== undefined ||
          childAssociation.meshes !== meshIndex ||
          !nonNegativeInteger(childAssociation.primitives)
        ) {
          return
        }
        indexedPrimitives.push({
          index: childAssociation.primitives,
          mesh: child as Mesh,
        })
      }

      indexedPrimitives.sort((a, b) => a.index - b.index)
      if (
        indexedPrimitives.some((entry, index) => entry.index !== index)
      ) {
        return
      }

      const binding: GltfLogicalMeshBinding = {
        owner,
        meshIndex,
        primitives: Object.freeze(indexedPrimitives.map((entry) => entry.mesh)),
      }
      bindingByOwner.set(owner, binding)
      for (const primitive of binding.primitives) {
        bindingByPrimitive.set(primitive, binding)
      }
      registered += 1
    })
  }

  return registered
}

/** Return a binding only while the registered runtime hierarchy is unchanged. */
export function getGltfLogicalMeshBinding(
  mesh: Mesh,
): GltfLogicalMeshBinding | null {
  const binding = bindingByPrimitive.get(mesh)
  if (!binding || mesh.parent !== binding.owner) return null
  if (binding.owner.children.length !== binding.primitives.length) return null
  if (
    binding.primitives.some(
      (primitive) =>
        primitive.parent !== binding.owner ||
        !binding.owner.children.includes(primitive),
    )
  ) {
    return null
  }
  return binding
}
