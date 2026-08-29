import type { Texture } from 'three'

/**
 * Runtime-only texture ownership.
 *
 * glTF `extras` are copied into `Texture.userData`, so model-authored flags
 * must never decide whether a texture is disposed. This WeakMap cannot be
 * populated by a GLB and therefore forms the disposal trust boundary.
 */
const owners = new WeakMap<Texture, object>()
const externalCacheOwner = Object.freeze({ kind: 'external-texture-cache' })

export function runtimeTextureOwner(texture: Texture): object | null {
  return owners.get(texture) ?? null
}

export function isRuntimeManagedTexture(texture: Texture): boolean {
  return owners.has(texture)
}

export function markRuntimeTextureOwned(texture: Texture, owner: object): void {
  const previous = owners.get(texture)
  if (previous && previous !== owner) {
    throw new Error('Texture already belongs to a different runtime owner')
  }
  owners.set(texture, owner)
}

/** Mark a texture owned by a cache outside transient model/package roots. */
export function markRuntimeExternalTexture(texture: Texture): void {
  markRuntimeTextureOwned(texture, externalCacheOwner)
}
