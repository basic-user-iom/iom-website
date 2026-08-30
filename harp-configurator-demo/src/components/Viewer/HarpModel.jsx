import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { PRODUCT } from '../../config/productConfig.js'
import { DEBUG } from '../../config/debug.js'
import { HARDWARE_FINISHES, WOOD_FINISHES } from '../../config/materials.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'
import { createCameraRig } from '../../utils/camera.js'
import { analyzeHarp, findAddOnAnchors, placeOnFloor, warnMissing, ADDON_ANCHOR_REV } from '../../utils/geometry.js'
import { assignHarpPartAttribute } from '../../utils/harpParts.js'
import { applyHarpShader, createHarpUniforms, lerpUniforms } from '../../shaders/harpMaterial.js'
import { SceneErrorBoundary } from './SceneErrorBoundary.jsx'
import { AddOnMeshes } from './AddOnMeshes.jsx'

useGLTF.preload(PRODUCT.modelUrl)

export function HarpModel() {
  const { scene } = useGLTF(PRODUCT.modelUrl)
  const gl = useThree((state) => state.gl)
  const viewport = useThree((state) => state.size)
  const setAnalysis = useViewer((state) => state.setAnalysis)
  const setLoadError = useViewer((state) => state.setLoadError)
  const values = useConfigurator((state) => state.values)
  const sheen = useConfigurator((state) => state.sheen)
  const reducedMotion = useViewer((state) => state.reducedMotion)
  const uniforms = useMemo(() => createHarpUniforms(), [])
  const sheenTime = useRef(-1)
  const mapsRef = useRef(null)
  const fittedRef = useRef(null)
  const [fitted, setFitted] = useState(null)
  const root = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.geometry = child.geometry?.clone()
      // The source glTF contains stale Z accessor bounds. Recompute from the
      // decoded vertices before centering, camera fitting, and surface rays.
      child.geometry?.computeBoundingBox()
      child.geometry?.computeBoundingSphere()
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material?.clone()
    })
    return clone
  }, [scene])

  useLayoutEffect(() => {
    let cancelled = false
    const loader = new TextureLoader()
    const maxAniso = gl.capabilities.getMaxAnisotropy()

    Promise.all([
      loader.loadAsync(PRODUCT.wood.albedo),
      loader.loadAsync(PRODUCT.wood.roughness),
      loader.loadAsync(PRODUCT.wood.normal),
    ])
      .then(([woodAlbedo, woodRough, woodNormal]) => {
        if (cancelled) {
          woodAlbedo.dispose()
          woodRough.dispose()
          woodNormal.dispose()
          return
        }
        const prepare = (texture, colorSpace, repeat = false) => {
          texture.flipY = !repeat
          texture.colorSpace = colorSpace
          texture.anisotropy = maxAniso
          texture.minFilter = LinearMipmapLinearFilter
          texture.magFilter = LinearFilter
          if (repeat) {
            texture.wrapS = RepeatWrapping
            texture.wrapT = RepeatWrapping
            texture.flipY = true
          }
          texture.needsUpdate = true
        }
        prepare(woodAlbedo, SRGBColorSpace, true)
        prepare(woodRough, NoColorSpace, true)
        prepare(woodNormal, NoColorSpace, true)
        uniforms.uWoodRoughMap.value = woodRough
        uniforms.uWoodNormalMap.value = woodNormal
        mapsRef.current = { woodAlbedo, woodRough, woodNormal }

        const partSummaries = []

        root.traverse((child) => {
          if (!child.isMesh) return
          child.castShadow = true
          child.receiveShadow = false
          if (child.geometry?.attributes?.uv && !child.geometry.attributes.uv2) {
            child.geometry.setAttribute('uv2', child.geometry.attributes.uv)
          }
          const partSummary = assignHarpPartAttribute(child.geometry)
          if (partSummary) partSummaries.push(partSummary)
          const previous = child.material
          const originalMap = previous?.map ?? null
          if (originalMap) {
            originalMap.flipY = false
            originalMap.colorSpace = SRGBColorSpace
            originalMap.needsUpdate = true
          }
          const material = new MeshPhysicalMaterial({
            map: woodAlbedo,
            emissiveMap: originalMap,
            emissive: 0x000000,
            metalness: 0,
            roughness: 1,
            envMapIntensity: 1.05,
            clearcoat: WOOD_FINISHES.natural.clearcoat,
            clearcoatRoughness: 0.48,
          })
          applyHarpShader(material, uniforms)
          child.material = material
          if (previous && previous !== material) previous.dispose?.()
        })

        const box = placeOnFloor(root)
        const analysis = analyzeHarp(root)
        let anchors = null
        try {
          anchors = findAddOnAnchors(root)
        } catch (error) {
          console.warn('[harp-configurator] add-on anchors failed', error)
        }
        fittedRef.current = { box, analysis, anchors }
        setFitted({ box, analysis, anchors })
        const aspect = viewport.width / Math.max(1, viewport.height)
        setAnalysis(analysis, createCameraRig(box, aspect, anchors?.hotspots))
        if (DEBUG) {
          console.info('[harp-configurator] analysis', {
            meshNames: analysis.meshNames,
            materials: analysis.materials,
            materialParts: partSummaries,
            size: analysis.size.toArray(),
            hierarchy: analysis.hierarchy,
          })
        }
      })
      .catch((error) => {
        console.error('[harp-configurator] failed to prepare harp materials', error)
        setLoadError(error)
      })

    return () => {
      cancelled = true
    }
  }, [gl, root, setAnalysis, setLoadError, uniforms, ADDON_ANCHOR_REV])

  useEffect(() => {
    if (!fittedRef.current) return
    const { box, analysis, anchors } = fittedRef.current
    const aspect = viewport.width / Math.max(1, viewport.height)
    setAnalysis(analysis, createCameraRig(box, aspect, anchors?.hotspots))
  }, [setAnalysis, viewport.height, viewport.width])

  useEffect(() => {
    if (sheen <= 0 || reducedMotion) return
    sheenTime.current = 0
    uniforms.uSheenSweep.value = 0
  }, [reducedMotion, sheen, uniforms])

  useFrame((_, dt) => {
    const wood = WOOD_FINISHES[values.finish] ?? WOOD_FINISHES.natural
    const hardware = HARDWARE_FINISHES[values.hardware] ?? HARDWARE_FINISHES.bright
    const alpha = reducedMotion ? 1 : 1 - Math.pow(0.0008, dt)
    lerpUniforms(uniforms, wood, hardware, alpha)
    root.traverse((child) => {
      if (child.isMesh && child.material?.clearcoat != null) {
        child.material.clearcoat += (wood.clearcoat - child.material.clearcoat) * alpha
      }
    })
    if (sheenTime.current >= 0) {
      sheenTime.current += dt
      uniforms.uSheenSweep.value = sheenTime.current / 1.15
      if (sheenTime.current > 1.15) {
        sheenTime.current = -1
        uniforms.uSheenSweep.value = -1
      }
    }
  })

  useEffect(
    () => () => {
      mapsRef.current?.woodAlbedo.dispose()
      mapsRef.current?.woodRough.dispose()
      mapsRef.current?.woodNormal.dispose()
      root.traverse((child) => {
        if (!child.isMesh) return
        child.geometry?.dispose?.()
        child.material?.dispose?.()
      })
    },
    [root],
  )

  if (!root) {
    warnMissing('Harp root missing')
    return null
  }

  return (
    <group>
      <primitive object={root} />
      <SceneErrorBoundary silent>
        <AddOnMeshes anchors={fitted?.anchors ?? null} />
      </SceneErrorBoundary>
    </group>
  )
}
