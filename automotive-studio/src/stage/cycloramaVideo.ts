import {
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  VideoTexture,
  type Material,
} from 'three'
import type { CycloramaVideoFit } from '../persistence/schema'
import { idbGetAssetBlob } from '../persistence/localDb'

export type CycloramaVideoHandle = {
  assetId: string
  video: HTMLVideoElement
  texture: VideoTexture
  objectUrl: string
}

export type CycloramaVideoRect = {
  /** Fraction of wall U occupied by the video (contain) or texture U repeat (cover). */
  repeatX: number
  repeatY: number
  offsetX: number
  offsetY: number
  /** Remaining video height after cropTop (0–1). */
  usableV: number
  fit: CycloramaVideoFit
}

/**
 * Compute cover/contain framing for a cylinder wall span (arc length × height).
 * Cylinder U runs 0–1 across the open arc; V is vertical.
 *
 * `cropTop` (0–0.75) discards that fraction from the top of the video, then
 * fits the remaining frame centered on the wall.
 *
 * Cover uses texture.repeat/offset (may crop the video).
 * Contain returns a wall-space letterbox rect — the full video fits inside;
 * unused wall area must be shaded separately (see bindCycloramaVideoToMesh).
 */
export function computeCycloramaVideoRect(
  fit: CycloramaVideoFit,
  wallAspect: number,
  videoAspect: number,
  cropTop = 0,
): CycloramaVideoRect {
  const wall = Math.max(0.01, wallAspect)
  const crop = Math.max(0, Math.min(0.75, cropTop))
  const usableV = 1 - crop
  const video = Math.max(0.01, videoAspect / usableV)

  if (fit === 'cover') {
    if (video > wall) {
      const s = wall / video
      return {
        repeatX: s,
        repeatY: usableV,
        offsetX: (1 - s) / 2,
        offsetY: 0,
        usableV,
        fit,
      }
    }
    const s = video / wall
    return {
      repeatX: 1,
      repeatY: s * usableV,
      offsetX: 0,
      offsetY: ((1 - s) / 2) * usableV,
      usableV,
      fit,
    }
  }

  // Contain: full cropped frame visible inside a centered wall rect.
  if (video > wall) {
    const h = wall / video
    return {
      repeatX: 1,
      repeatY: h,
      offsetX: 0,
      offsetY: (1 - h) / 2,
      usableV,
      fit,
    }
  }
  const w = video / wall
  return {
    repeatX: w,
    repeatY: 1,
    offsetX: (1 - w) / 2,
    offsetY: 0,
    usableV,
    fit,
  }
}

/**
 * Cover/contain UV fit for a cylinder wall span (arc length × height).
 * For contain, texture.repeat stays identity — letterboxing is done in the material shader.
 */
export function applyCycloramaVideoFit(
  texture: VideoTexture,
  fit: CycloramaVideoFit,
  wallAspect: number,
  videoAspect: number,
  cropTop = 0,
) {
  const rect = computeCycloramaVideoRect(fit, wallAspect, videoAspect, cropTop)
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.center.set(0.5, 0.5)
  texture.rotation = 0
  if (fit === 'cover') {
    texture.repeat.set(rect.repeatX, rect.repeatY)
    texture.offset.set(rect.offsetX, rect.offsetY)
  } else {
    // Identity map — contain remaps in the fragment shader so bars are solid, not clamped edges.
    texture.repeat.set(1, rect.usableV)
    texture.offset.set(0, 0)
  }
  texture.needsUpdate = true
}

type ContainUniforms = {
  uContainRect: { value: { x: number; y: number; z: number; w: number } }
  uLetterbox: { value: Color }
  uUsableV: { value: number }
}

const containUniforms = new WeakMap<MeshBasicMaterial, ContainUniforms>()

function applyContainLetterboxShader(
  mat: MeshBasicMaterial,
  rect: CycloramaVideoRect,
  letterboxHex = 0x05070c,
) {
  let uniforms = containUniforms.get(mat)
  if (!uniforms) {
    uniforms = {
      uContainRect: { value: { x: 0, y: 0, z: 1, w: 1 } },
      uLetterbox: { value: new Color(letterboxHex) },
      uUsableV: { value: 1 },
    }
    containUniforms.set(mat, uniforms)
    const owned = uniforms
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uContainRect = owned.uContainRect
      shader.uniforms.uLetterbox = owned.uLetterbox
      shader.uniforms.uUsableV = owned.uUsableV
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
#include <common>
uniform vec4 uContainRect;
uniform vec3 uLetterbox;
uniform float uUsableV;
`,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
#ifdef USE_MAP
  vec2 wallUv = vMapUv;
  vec2 local = (wallUv - uContainRect.xy) / max(uContainRect.zw, vec2(1e-4));
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) {
    diffuseColor.rgb = uLetterbox;
  } else {
    vec4 sampledDiffuseColor = texture2D(map, vec2(local.x, local.y * uUsableV));
    #ifdef DECODE_VIDEO_TEXTURE
      sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
    #endif
    diffuseColor *= sampledDiffuseColor;
  }
#endif
`,
        )
    }
    mat.customProgramCacheKey = () => 'iom-cyclorama-contain-v1'
  }
  uniforms.uContainRect.value = {
    x: rect.offsetX,
    y: rect.offsetY,
    z: rect.repeatX,
    w: rect.repeatY,
  }
  uniforms.uLetterbox.value.setHex(letterboxHex)
  uniforms.uUsableV.value = rect.usableV
  mat.needsUpdate = true
}

function clearContainLetterboxShader(mat: MeshBasicMaterial) {
  if (!containUniforms.has(mat)) return
  containUniforms.delete(mat)
  mat.onBeforeCompile = () => {}
  mat.customProgramCacheKey = () => ''
  mat.needsUpdate = true
}

export function disposeCycloramaVideoHandle(handle: CycloramaVideoHandle | null) {
  if (!handle) return
  try {
    handle.video.pause()
  } catch {
    /* ignore */
  }
  handle.video.removeAttribute('src')
  handle.video.load()
  handle.texture.dispose()
  URL.revokeObjectURL(handle.objectUrl)
}

export async function loadCycloramaVideoHandle(assetId: string): Promise<CycloramaVideoHandle | null> {
  const blob = await idbGetAssetBlob(assetId)
  if (!blob) return null
  const objectUrl = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.src = objectUrl
  video.playsInline = true
  video.muted = true
  video.loop = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Cyclorama video failed to load'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('loadeddata', onReady)
    video.addEventListener('error', onError)
    void video
      .play()
      .then(() => video.pause())
      .catch(() => {
        /* autoplay may fail until gesture — still usable once metadata is ready */
      })
  })
  const texture = new VideoTexture(video)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  // Avoid anisotropic shimmer when the big wall updates every frame.
  texture.anisotropy = 1
  return { assetId, video, texture, objectUrl }
}

/** Project video onto the cyclorama as an unlit screen (stable while frames update). */
export function bindCycloramaVideoToMesh(
  mesh: Mesh,
  handle: CycloramaVideoHandle,
  opts: {
    muted: boolean
    loop: boolean
    fit: CycloramaVideoFit
    /** Arc/height using the *media* (full) wall height — preserves framing when cropTop > 0. */
    wallAspect: number
    /** 0–0.75 — crop this fraction from the top of the fitted video. */
    cropTop?: number
    letterboxColor?: number
  },
) {
  handle.video.muted = opts.muted
  handle.video.loop = opts.loop

  const vw = handle.video.videoWidth || 16
  const vh = handle.video.videoHeight || 9
  const videoAspect = vw / vh
  const cropTop = opts.cropTop ?? 0
  const rect = computeCycloramaVideoRect(opts.fit, opts.wallAspect, videoAspect, cropTop)
  applyCycloramaVideoFit(handle.texture, opts.fit, opts.wallAspect, videoAspect, cropTop)

  // Unlit wall: lit Standard + video map/emissive shimmered every frame with IBL/sun.
  const prev = mesh.material as Material | Material[]
  let mat =
    !Array.isArray(mesh.material) &&
    mesh.material instanceof MeshBasicMaterial &&
    mesh.material.userData?.iomCycloramaVideo
      ? mesh.material
      : null
  if (!mat) {
    mat = new MeshBasicMaterial({
      map: handle.texture,
      color: 0xffffff,
      toneMapped: false,
      side: DoubleSide,
      depthWrite: true,
      // Prefer wall over floor skirt at the join.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    mat.userData.iomCycloramaVideo = true
    mesh.material = mat
    if (prev && prev !== mat) {
      if (Array.isArray(prev)) prev.forEach((m) => m.dispose())
      else prev.dispose()
    }
  } else {
    mat.map = handle.texture
    mat.color.set(0xffffff)
    mat.toneMapped = false
    mat.needsUpdate = true
  }

  if (opts.fit === 'contain') {
    applyContainLetterboxShader(mat, rect, opts.letterboxColor ?? 0x05070c)
  } else {
    clearContainLetterboxShader(mat)
  }

  mesh.receiveShadow = false
  mesh.castShadow = false
}

export async function toggleCycloramaPlayback(handle: CycloramaVideoHandle | null): Promise<boolean> {
  if (!handle) return false
  const { video } = handle
  if (video.paused) {
    try {
      await video.play()
      return true
    } catch {
      return false
    }
  }
  video.pause()
  return true
}
