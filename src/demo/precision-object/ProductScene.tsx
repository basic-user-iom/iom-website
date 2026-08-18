import { useEffect, useRef } from 'react'
import { createProductViewer } from './productViewer'
import type { LoadState, ModelCapabilities, ScreenHotspot, ViewerApi } from './types'
import type { SavedLook } from './lookStudio'
import { preferMobileQuality, prefersReducedMotion } from './webgl'

type Props = {
  initialLook?: SavedLook
  onLoad: (state: LoadState) => void
  onReady: (capabilities: ModelCapabilities) => void
  onInteract: () => void
  onHotspots: (points: ScreenHotspot[]) => void
  onUnavailable: () => void
  onApi: (api: ViewerApi | null) => void
  onMaterials?: (materials: import('./lookStudio').MaterialLook[]) => void
  onHotspotPlaced?: (id: string, position: [number, number, number]) => void
}

export function ProductScene({
  initialLook,
  onLoad,
  onReady,
  onInteract,
  onHotspots,
  onUnavailable,
  onApi,
  onMaterials,
  onHotspotPlaced,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onLoadRef = useRef(onLoad)
  const onReadyRef = useRef(onReady)
  const onInteractRef = useRef(onInteract)
  const onHotspotsRef = useRef(onHotspots)
  const onUnavailableRef = useRef(onUnavailable)
  const onApiRef = useRef(onApi)
  const onMaterialsRef = useRef(onMaterials)
  const onHotspotPlacedRef = useRef(onHotspotPlaced)

  onLoadRef.current = onLoad
  onReadyRef.current = onReady
  onInteractRef.current = onInteract
  onHotspotsRef.current = onHotspots
  onUnavailableRef.current = onUnavailable
  onApiRef.current = onApi
  onMaterialsRef.current = onMaterials
  onHotspotPlacedRef.current = onHotspotPlaced
  const initialLookRef = useRef(initialLook)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reducedMotion = prefersReducedMotion()
    const mobile = preferMobileQuality()
    const { api, dispose } = createProductViewer(mount, {
      reducedMotion,
      mobile,
      initialLook: initialLookRef.current,
      onLoad: (state) => onLoadRef.current(state),
      onReady: (caps) => onReadyRef.current(caps),
      onInteract: () => onInteractRef.current(),
      onHotspots: (points) => onHotspotsRef.current(points),
      onUnavailable: () => onUnavailableRef.current(),
      onMaterials: (materials) => onMaterialsRef.current?.(materials),
      onHotspotPlaced: (id, position) => onHotspotPlacedRef.current?.(id, position),
    })
    onApiRef.current(api)

    return () => {
      onApiRef.current(null)
      dispose()
    }
  }, [])

  return <div ref={mountRef} className="pov-canvas" />
}
