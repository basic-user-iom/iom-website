import { useMemo } from 'react'
import { HOTSPOTS } from '../../config/productConfig.js'
import { useViewer } from '../../hooks/useViewer.js'

export function Hotspots({ rig }) {
  const openHotspot = useViewer((state) => state.openHotspot)
  const active = useViewer((state) => state.hotspot)
  const introDone = useViewer((state) => state.introDone)
  const scale = rig ? rig.maxDim * 0.0085 : 0.006
  const hitScale = rig ? rig.maxDim * 0.023 : 0.015
  const items = useMemo(() => {
    if (!rig) return []
    return HOTSPOTS.map((item) => {
      const anchor = rig.hotspots[item.id]
      if (!anchor?.position || !anchor?.quaternion) return null
      return {
        ...item,
        position: anchor.position.toArray(),
        quaternion: anchor.quaternion.toArray(),
      }
    }).filter(Boolean)
  }, [rig])

  if (!rig || !introDone) return null

  return (
    <group>
      {items.map((item) => {
        const selected = active === item.id
        return (
          <group
            key={item.id}
            position={item.position}
            quaternion={item.quaternion}
            onClick={(event) => {
              event.stopPropagation()
              openHotspot(item.id)
            }}
            onPointerOver={() => {
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <mesh>
              <ringGeometry args={[scale * 0.52, scale, 32]} />
              <meshBasicMaterial
                color={selected ? '#d3ae69' : '#8d7147'}
                transparent
                opacity={selected ? 0.95 : 0.62}
                depthTest
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-2}
                polygonOffsetUnits={-2}
              />
            </mesh>
            <mesh position={[0, 0, scale * 0.02]}>
              <circleGeometry args={[scale * 0.2, 20]} />
              <meshBasicMaterial
                color="#f8f2e8"
                transparent
                opacity={selected ? 1 : 0.82}
                depthTest
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, 0, scale * 0.03]}>
              <circleGeometry args={[hitScale, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
