import {
  Material,
  type Object3D,
  type Texture,
} from 'three'
import {
  markRuntimeTextureOwned,
  runtimeTextureOwner,
} from './runtimeTextureOwnership'

/**
 * Offline-authored proof that an embedded image's encoded payload was
 * content-hashed before the containing GLB received its own SHA-256 pin.
 *
 * GLTFLoader copies image `extras` into Texture.userData while loading the
 * image source. The production packaging step must author this object on the
 * glTF image definition; runtime image URLs or texture names
 * are deliberately not accepted as identity because both can collide across
 * independently parsed GLBs.
 */
export type SharedTextureContentMetadataV1 = {
  version: 1
  contentSha256: string
  encodedBytes: number
}

export type SharedTextureAcquireResult = {
  annotatedTextures: number
  acquiredEntries: number
  sharedTextures: number
  disposedDuplicates: number
}

export type SharedTextureRegistryState = {
  entries: number
  roots: number
  references: number
  encodedBytes: number
}

type TextureSlot = {
  material: Material
  property: string
  texture: Texture
}

type RegistryEntry = {
  canonical: Texture
  references: number
  encodedBytes: number
}

const SHA256 = /^[a-fA-F0-9]{64}$/
const METADATA_KEY = 'iomSharedTexture'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function metadataFor(texture: Texture): SharedTextureContentMetadataV1 | null {
  const raw = texture.userData?.[METADATA_KEY]
  if (raw == null) return null
  if (
    !isRecord(raw) ||
    raw.version !== 1 ||
    typeof raw.contentSha256 !== 'string' ||
    !SHA256.test(raw.contentSha256) ||
    !Number.isSafeInteger(raw.encodedBytes) ||
    (raw.encodedBytes as number) <= 0
  ) {
    throw new Error('Invalid iomSharedTexture metadata; refusing unsafe texture pooling')
  }
  return {
    version: 1,
    contentSha256: raw.contentSha256.toLowerCase(),
    encodedBytes: raw.encodedBytes as number,
  }
}

function numberKey(value: number): number | string {
  if (Number.isNaN(value)) return 'NaN'
  if (value === Number.POSITIVE_INFINITY) return '+Infinity'
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity'
  return Object.is(value, -0) ? 0 : value
}

/**
 * A Three.js Texture contains sampling, color interpretation, UV-channel and
 * KHR_texture_transform state. Sharing is safe only when every one of those
 * states agrees. The encoded content hash alone is intentionally insufficient.
 */
export function sharedTextureCompatibilityKey(
  texture: Texture,
  metadata = metadataFor(texture),
): string | null {
  if (!metadata) return null
  if (texture.matrixAutoUpdate) texture.updateMatrix()
  return JSON.stringify({
    version: metadata.version,
    contentSha256: metadata.contentSha256,
    encodedBytes: metadata.encodedBytes,
    textureKind: {
      compressed: Boolean((texture as Texture & { isCompressedTexture?: boolean }).isCompressedTexture),
      cube: Boolean((texture as Texture & { isCubeTexture?: boolean }).isCubeTexture),
      data: Boolean((texture as Texture & { isDataTexture?: boolean }).isDataTexture),
      depth: Boolean((texture as Texture & { isDepthTexture?: boolean }).isDepthTexture),
      renderTarget: Boolean((texture as Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture),
      video: Boolean((texture as Texture & { isVideoTexture?: boolean }).isVideoTexture),
    },
    mapping: texture.mapping,
    channel: texture.channel,
    wrapS: texture.wrapS,
    wrapT: texture.wrapT,
    magFilter: texture.magFilter,
    minFilter: texture.minFilter,
    anisotropy: texture.anisotropy,
    format: texture.format,
    internalFormat: texture.internalFormat ?? null,
    type: texture.type,
    colorSpace: texture.colorSpace,
    flipY: texture.flipY,
    generateMipmaps: texture.generateMipmaps,
    premultiplyAlpha: texture.premultiplyAlpha,
    unpackAlignment: texture.unpackAlignment,
    compareFunction: (texture as Texture & { compareFunction?: number }).compareFunction ?? null,
    offset: [numberKey(texture.offset.x), numberKey(texture.offset.y)],
    repeat: [numberKey(texture.repeat.x), numberKey(texture.repeat.y)],
    center: [numberKey(texture.center.x), numberKey(texture.center.y)],
    rotation: numberKey(texture.rotation),
    matrixAutoUpdate: texture.matrixAutoUpdate,
    matrix: texture.matrix.elements.map(numberKey),
  })
}

function textureSlots(root: Object3D): Map<Texture, TextureSlot[]> {
  const slots = new Map<Texture, TextureSlot[]>()
  root.traverse((object) => {
    const mesh = object as Object3D & { isMesh?: boolean; material?: Material | Material[] }
    if (!mesh.isMesh || !mesh.material) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!material) continue
      for (const [property, value] of Object.entries(material as Material & Record<string, unknown>)) {
        if (!value || typeof value !== 'object' || !(value as Texture).isTexture) continue
        const texture = value as Texture
        const current = slots.get(texture) ?? []
        current.push({ material, property, texture })
        slots.set(texture, current)
      }
    }
  })
  return slots
}

/**
 * Reference-counted texture pooling for manifest-v3 package roots.
 *
 * Nothing is pooled without explicit content-hash metadata. Runtime-owned
 * resources (notably the shared lightmap cache) are never adopted. Canonical
 * pooled textures receive a non-authorable runtime ownership marker so the
 * generic package disposer cannot release them behind the registry's back.
 */
export class SharedTextureResidencyRegistry {
  private readonly entries = new Map<string, RegistryEntry>()
  private readonly roots = new Map<Object3D, Set<string>>()
  private readonly disposedTextures = new WeakSet<Texture>()
  private readonly ownershipToken = Object.freeze({ kind: 'shared-texture-registry' })
  private disposed = false

  acquireRoot(root: Object3D): SharedTextureAcquireResult {
    if (this.disposed) throw new Error('Shared texture residency registry was disposed')
    if (this.roots.has(root)) throw new Error('Texture residency was already acquired for this package root')
    this.assertCanonicalKeysStable()

    const candidates = [...textureSlots(root)].map(([texture, slots]) => {
      const owner = runtimeTextureOwner(texture)
      if (owner && owner !== this.ownershipToken) return null
      const metadata = metadataFor(texture)
      if (!metadata) return null
      const key = sharedTextureCompatibilityKey(texture, metadata)
      if (!key) return null
      return { texture, slots, metadata, key }
    }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)

    const acquired = new Set<string>()
    let sharedTextures = 0
    let disposedDuplicates = 0

    for (const candidate of candidates) {
      let entry = this.entries.get(candidate.key)
      if (!entry) {
        markRuntimeTextureOwned(candidate.texture, this.ownershipToken)
        entry = {
          canonical: candidate.texture,
          references: 0,
          encodedBytes: candidate.metadata.encodedBytes,
        }
        this.entries.set(candidate.key, entry)
      } else if (entry.canonical !== candidate.texture) {
        for (const slot of candidate.slots) {
          const materialValues = slot.material as Material & Record<string, unknown>
          materialValues[slot.property] = entry.canonical
          slot.material.needsUpdate = true
        }
        this.disposeTexture(candidate.texture)
        sharedTextures += 1
        disposedDuplicates += 1
      }

      if (!acquired.has(candidate.key)) {
        acquired.add(candidate.key)
        entry.references += 1
      }
    }

    if (acquired.size) this.roots.set(root, acquired)
    return {
      annotatedTextures: candidates.length,
      acquiredEntries: acquired.size,
      sharedTextures,
      disposedDuplicates,
    }
  }

  releaseRoot(root: Object3D): void {
    const keys = this.roots.get(root)
    if (!keys) return
    this.roots.delete(root)
    for (const key of keys) {
      const entry = this.entries.get(key)
      if (!entry) continue
      entry.references -= 1
      if (entry.references > 0) continue
      this.entries.delete(key)
      this.disposeTexture(entry.canonical)
    }
  }

  getState(): SharedTextureRegistryState {
    let references = 0
    let encodedBytes = 0
    for (const entry of this.entries.values()) {
      references += entry.references
      encodedBytes += entry.encodedBytes
    }
    return { entries: this.entries.size, roots: this.roots.size, references, encodedBytes }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.roots.clear()
    for (const entry of this.entries.values()) this.disposeTexture(entry.canonical)
    this.entries.clear()
  }

  /**
   * Compatibility keys include mutable Three.js sampling and UV-transform
   * state. Refuse a new acquisition if a live canonical changed after it was
   * indexed; otherwise a later package could silently share an incompatible
   * texture under the stale key.
   */
  private assertCanonicalKeysStable(): void {
    for (const [key, entry] of this.entries) {
      const currentKey = sharedTextureCompatibilityKey(entry.canonical)
      if (currentKey !== key) {
        throw new Error(
          'Shared texture canonical changed after acquisition; refusing stale compatibility-key reuse',
        )
      }
      if (runtimeTextureOwner(entry.canonical) !== this.ownershipToken) {
        throw new Error('Shared texture canonical lost its runtime ownership contract')
      }
    }
  }

  private disposeTexture(texture: Texture): void {
    if (this.disposedTextures.has(texture)) return
    this.disposedTextures.add(texture)
    texture.dispose()
  }
}
