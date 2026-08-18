import * as THREE from 'three'

export type PbrMapUrls = {
  color: string
  roughness: string
  metalness: string
  normal: string
  displacement?: string
}

export type PbrMapSet = {
  color: THREE.Texture
  roughness: THREE.Texture
  metalness: THREE.Texture
  normal: THREE.Texture
  displacement: THREE.Texture | null
  dispose: () => void
}

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
  const loader = new THREE.TextureLoader()
  const [color, roughness, metalness, normal, displacement] = await Promise.all([
    loadMap(loader, urls.color, THREE.SRGBColorSpace),
    loadMap(loader, urls.roughness, THREE.NoColorSpace),
    loadMap(loader, urls.metalness, THREE.NoColorSpace),
    loadMap(loader, urls.normal, THREE.NoColorSpace, isDirectXNormalUrl(urls.normal)),
    urls.displacement
      ? loadMap(loader, urls.displacement, THREE.NoColorSpace)
      : Promise.resolve(null),
  ])

  for (const texture of [color, roughness, metalness, normal, displacement]) {
    if (!texture) continue
    texture.anisotropy = anisotropy
  }

  return {
    color,
    roughness,
    metalness,
    normal,
    displacement,
    dispose: () => {
      color.dispose()
      roughness.dispose()
      metalness.dispose()
      normal.dispose()
      displacement?.dispose()
    },
  }
}

function dataTexture(r: number, g: number, b: number, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, 255])
  const texture = new THREE.DataTexture(data, 1, 1)
  texture.colorSpace = colorSpace
  texture.needsUpdate = true
  return texture
}

export async function loadPbrMapsPartial(
  urls: Partial<PbrMapUrls>,
  anisotropy: number,
): Promise<PbrMapSet> {
  if (urls.color && urls.roughness && urls.metalness && urls.normal) {
    return loadPbrMaps(
      {
        color: urls.color,
        roughness: urls.roughness,
        metalness: urls.metalness,
        normal: urls.normal,
        displacement: urls.displacement,
      },
      anisotropy,
    )
  }
  const loader = new THREE.TextureLoader()
  const color = urls.color
    ? await loadMap(loader, urls.color, THREE.SRGBColorSpace)
    : dataTexture(200, 200, 200, THREE.SRGBColorSpace)
  const roughness = urls.roughness
    ? await loadMap(loader, urls.roughness, THREE.NoColorSpace)
    : dataTexture(128, 128, 128, THREE.NoColorSpace)
  const metalness = urls.metalness
    ? await loadMap(loader, urls.metalness, THREE.NoColorSpace)
    : dataTexture(255, 255, 255, THREE.NoColorSpace)
  const normal = urls.normal
    ? await loadMap(loader, urls.normal, THREE.NoColorSpace, isDirectXNormalUrl(urls.normal))
    : dataTexture(128, 128, 255, THREE.NoColorSpace)
  const displacement = urls.displacement
    ? await loadMap(loader, urls.displacement, THREE.NoColorSpace)
    : null
  for (const texture of [color, roughness, metalness, normal, displacement]) {
    if (!texture) continue
    texture.anisotropy = anisotropy
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
  }
  return {
    color,
    roughness,
    metalness,
    normal,
    displacement,
    dispose: () => {
      color.dispose()
      roughness.dispose()
      metalness.dispose()
      normal.dispose()
      displacement?.dispose()
    },
  }
}

export function clonePbrMaps(
  source: PbrMapSet,
  repeat: number,
  anisotropy: number,
): PbrMapSet {
  const cloneOne = (texture: THREE.Texture) => {
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
      color.dispose()
      roughness.dispose()
      metalness.dispose()
      normal.dispose()
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
