import * as THREE from 'three'

export type PbrMapUrls = {
  color: string
  roughness: string
  metalness: string
  normal: string
  displacement?: string
}

export type PbrMapSet = {
  color: THREE.Texture | null
  roughness: THREE.Texture | null
  metalness: THREE.Texture | null
  normal: THREE.Texture | null
  displacement: THREE.Texture | null
  dispose: () => void
}

export type PbrMapKind = Exclude<keyof PbrMapUrls, 'displacement'> | 'displacement'

const ALL_PBR_MAPS: readonly PbrMapKind[] = [
  'color',
  'roughness',
  'metalness',
  'normal',
  'displacement',
]

export function isDirectXNormalUrl(url: string): boolean {
  return /normaldx|norm.?dx|normal.?dx/i.test(url)
}

/**
 * DirectX normals store +Y down. Three.js tangent-space normals are OpenGL (+Y up).
 * Do not canvas-invert: color-managed 2D canvases corrupt the map. Flip via normalScale.y.
 */
function loadMap(
  loader: THREE.TextureLoader,
  url: string,
  colorSpace: THREE.ColorSpace,
  directX = false,
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = colorSpace
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.flipY = false
        if (directX) texture.userData.directX = true
        texture.needsUpdate = true
        resolve(texture)
      },
      undefined,
      () => reject(new Error(`Failed to load ${url}`)),
    )
  })
}

export async function loadPbrMaps(urls: PbrMapUrls, anisotropy: number): Promise<PbrMapSet> {
  return loadPbrMapsPartial(urls, anisotropy, ALL_PBR_MAPS)
}

export async function loadPbrMapsPartial(
  urls: Partial<PbrMapUrls>,
  anisotropy: number,
  requested: readonly PbrMapKind[] = ALL_PBR_MAPS,
): Promise<PbrMapSet> {
  const loader = new THREE.TextureLoader()
  const wanted = new Set(requested)
  const loaded: THREE.Texture[] = []
  const get = async (
    kind: PbrMapKind,
    colorSpace: THREE.ColorSpace,
    directX = false,
  ): Promise<THREE.Texture | null> => {
    const url = urls[kind]
    if (!wanted.has(kind) || !url) return null
    const texture = await loadMap(loader, url, colorSpace, directX)
    texture.anisotropy = anisotropy
    loaded.push(texture)
    return texture
  }

  const normalUrl = urls.normal
  const results = await Promise.allSettled([
    get('color', THREE.SRGBColorSpace),
    get('roughness', THREE.NoColorSpace),
    get('metalness', THREE.NoColorSpace),
    get('normal', THREE.NoColorSpace, Boolean(normalUrl && isDirectXNormalUrl(normalUrl))),
    get('displacement', THREE.NoColorSpace),
  ])
  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') {
    for (const texture of loaded) texture.dispose()
    throw failed.reason
  }

  const [color, roughness, metalness, normal, displacement] = results.map((result) =>
    result.status === 'fulfilled' ? result.value : null
  )
  return {
    color,
    roughness,
    metalness,
    normal,
    displacement,
    dispose: () => {
      color?.dispose()
      roughness?.dispose()
      metalness?.dispose()
      normal?.dispose()
      displacement?.dispose()
    },
  }
}

export function clonePbrMaps(
  source: PbrMapSet,
  repeat: number,
  anisotropy: number,
): PbrMapSet {
  const cloneOne = (texture: THREE.Texture | null) => {
    if (!texture) return null
    const next = texture.clone()
    next.wrapS = THREE.RepeatWrapping
    next.wrapT = THREE.RepeatWrapping
    next.repeat.set(repeat, repeat)
    next.anisotropy = anisotropy
    next.needsUpdate = true
    return next
  }

  const color = cloneOne(source.color)
  const roughness = cloneOne(source.roughness)
  const metalness = cloneOne(source.metalness)
  const normal = cloneOne(source.normal)
  const displacement = source.displacement ? cloneOne(source.displacement) : null

  return {
    color,
    roughness,
    metalness,
    normal,
    displacement,
    dispose: () => {
      color?.dispose()
      roughness?.dispose()
      metalness?.dispose()
      normal?.dispose()
      displacement?.dispose()
    },
  }
}

export function isWatchMetalMaterial(mat: THREE.Material, meshName: string): boolean {
  const name = `${mat.name} ${meshName}`.toLowerCase()
  if (name.includes('glass') || name.includes('white') || name.includes('dial')) return false
  if (name.includes('black') && !name.includes('metal')) return false
  return name.includes('metal') || name.includes('rough')
}

export function isDialMaterial(mat: THREE.Material, meshName: string): boolean {
  const name = `${mat.name} ${meshName}`.toLowerCase()
  return name.includes('white') || name.includes('dial')
}
