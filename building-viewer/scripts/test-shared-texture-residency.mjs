import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import {
  ClampToEdgeWrapping,
  Group,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const vite = await createServer({
  root: join(SCRIPT_DIR, '..'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

const HASH_A = 'a'.repeat(64)

function texture(options = {}) {
  const value = new Texture()
  value.userData.iomSharedTexture = {
    version: 1,
    contentSha256: options.hash ?? HASH_A,
    encodedBytes: options.encodedBytes ?? 4096,
  }
  value.colorSpace = options.colorSpace ?? SRGBColorSpace
  value.wrapS = options.wrapS ?? RepeatWrapping
  value.wrapT = options.wrapT ?? RepeatWrapping
  value.magFilter = options.magFilter ?? LinearFilter
  value.minFilter = options.minFilter ?? LinearFilter
  if (options.repeat) value.repeat.fromArray(options.repeat)
  return value
}

function packageRoot(map) {
  const root = new Group()
  const material = new MeshBasicMaterial({ map })
  root.add(new Mesh(new PlaneGeometry(1, 1), material))
  return { root, material }
}

function disposalCounter(value) {
  let count = 0
  value.addEventListener('dispose', () => { count += 1 })
  return () => count
}

try {
  const { SharedTextureResidencyRegistry, sharedTextureCompatibilityKey } =
    await vite.ssrLoadModule('/src/scene/SharedTextureResidencyRegistry.ts')
  const { isRuntimeManagedTexture, markRuntimeExternalTexture } =
    await vite.ssrLoadModule('/src/scene/runtimeTextureOwnership.ts')

  // Same encoded content and identical runtime interpretation share exactly
  // one Three.js Texture, even if the offline hash casing differs.
  {
    const registry = new SharedTextureResidencyRegistry()
    const first = texture({ hash: HASH_A.toUpperCase() })
    const second = texture()
    const firstDisposed = disposalCounter(first)
    const secondDisposed = disposalCounter(second)
    const a = packageRoot(first)
    const b = packageRoot(second)

    assert.equal(sharedTextureCompatibilityKey(first), sharedTextureCompatibilityKey(second))
    assert.deepEqual(registry.acquireRoot(a.root), {
      annotatedTextures: 1,
      acquiredEntries: 1,
      sharedTextures: 0,
      disposedDuplicates: 0,
    })
    assert.deepEqual(registry.acquireRoot(b.root), {
      annotatedTextures: 1,
      acquiredEntries: 1,
      sharedTextures: 1,
      disposedDuplicates: 1,
    })
    assert.equal(b.material.map, first)
    assert.equal(secondDisposed(), 1, 'discarded duplicate must release immediately')
    assert.deepEqual(registry.getState(), { entries: 1, roots: 2, references: 2, encodedBytes: 4096 })

    // Unloading one package must not dispose the canonical texture still used
    // by another live package. Final release owns the single disposal.
    registry.releaseRoot(a.root)
    assert.equal(firstDisposed(), 0)
    assert.equal(b.material.map, first)
    assert.deepEqual(registry.getState(), { entries: 1, roots: 1, references: 1, encodedBytes: 4096 })
    registry.releaseRoot(b.root)
    assert.equal(firstDisposed(), 1)
    registry.releaseRoot(b.root)
    registry.dispose()
    registry.dispose()
    assert.equal(firstDisposed(), 1, 'canonical texture must dispose exactly once')
    assert.equal(secondDisposed(), 1, 'duplicate texture must dispose exactly once')
  }

  // Content identity is not enough: sampler, UV transform, and color-space
  // incompatibilities each produce independent canonical textures.
  {
    const registry = new SharedTextureResidencyRegistry()
    const baseline = texture()
    const sampler = texture({ wrapS: ClampToEdgeWrapping, magFilter: NearestFilter })
    const transform = texture({ repeat: [2, 1] })
    const color = texture({ colorSpace: LinearSRGBColorSpace })
    const packages = [baseline, sampler, transform, color].map(packageRoot)

    for (const item of packages) registry.acquireRoot(item.root)
    assert.equal(new Set([baseline, sampler, transform, color].map(sharedTextureCompatibilityKey)).size, 4)
    assert.equal(registry.getState().entries, 4)
    assert.deepEqual(packages.map((item) => item.material.map), [baseline, sampler, transform, color])
    registry.dispose()
  }

  // Registry shutdown with active package references releases each canonical
  // exactly once and remains idempotent if roots subsequently report unload.
  {
    const registry = new SharedTextureResidencyRegistry()
    const first = texture()
    const second = texture()
    const firstDisposed = disposalCounter(first)
    const secondDisposed = disposalCounter(second)
    const a = packageRoot(first)
    const b = packageRoot(second)
    registry.acquireRoot(a.root)
    registry.acquireRoot(b.root)
    registry.dispose()
    registry.releaseRoot(a.root)
    registry.releaseRoot(b.root)
    registry.dispose()
    assert.equal(firstDisposed(), 1)
    assert.equal(secondDisposed(), 1)
  }

  // The lightmap cache is externally owned via a runtime-only marker. Pool
  // metadata is ignored, and an unannotated production texture is also a no-op.
  {
    const registry = new SharedTextureResidencyRegistry()
    const lightmap = texture()
    markRuntimeExternalTexture(lightmap)
    const ordinary = new Texture()
    const lightmapDisposed = disposalCounter(lightmap)
    const lightmapPackage = packageRoot(lightmap)
    const ordinaryPackage = packageRoot(ordinary)
    assert.equal(registry.acquireRoot(lightmapPackage.root).annotatedTextures, 0)
    assert.equal(registry.acquireRoot(ordinaryPackage.root).annotatedTextures, 0)
    registry.releaseRoot(lightmapPackage.root)
    registry.releaseRoot(ordinaryPackage.root)
    registry.dispose()
    assert.equal(lightmapDisposed(), 0, 'externally supplied lightmap must never be registry-disposed')
    assert.equal(isRuntimeManagedTexture(lightmap), true)
  }

  // Model-authored userData is not an ownership authority. A GLB cannot forge
  // either the old external marker or the old registry-owned exception.
  {
    const registry = new SharedTextureResidencyRegistry()
    const spoofed = texture()
    spoofed.userData.iomExternalSharedResource = true
    spoofed.userData.iomSharedTextureRegistryOwned = true
    const disposed = disposalCounter(spoofed)
    const item = packageRoot(spoofed)
    assert.equal(registry.acquireRoot(item.root).annotatedTextures, 1)
    assert.equal(isRuntimeManagedTexture(spoofed), true)
    registry.releaseRoot(item.root)
    assert.equal(disposed(), 1, 'model-authored ownership flags must not suppress disposal')
    registry.dispose()
  }

  // A pooled canonical must not remain indexed under a stale compatibility
  // key after mutable sampler/UV state changes.
  {
    const registry = new SharedTextureResidencyRegistry()
    const canonical = texture()
    const first = packageRoot(canonical)
    registry.acquireRoot(first.root)
    canonical.repeat.set(2, 1)

    const next = packageRoot(texture())
    assert.throws(
      () => registry.acquireRoot(next.root),
      /canonical changed after acquisition/,
    )
    assert.deepEqual(registry.getState(), {
      entries: 1,
      roots: 1,
      references: 1,
      encodedBytes: 4096,
    })
    registry.releaseRoot(first.root)
    registry.dispose()
  }

  // Metadata is a strict, fail-closed packaging contract.
  {
    const registry = new SharedTextureResidencyRegistry()
    const malformed = texture()
    malformed.userData.iomSharedTexture.contentSha256 = 'not-a-sha256'
    await assert.rejects(async () => registry.acquireRoot(packageRoot(malformed).root), /Invalid iomSharedTexture metadata/)
    assert.deepEqual(registry.getState(), { entries: 0, roots: 0, references: 0, encodedBytes: 0 })
    registry.dispose()
  }

  console.log(
    'Shared texture residency: PASS (content hash, compatibility stability, refcounts, runtime ownership, spoof resistance)',
  )
} finally {
  await vite.close()
}
