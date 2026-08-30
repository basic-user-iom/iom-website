import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import { HARDWARE_FINISHES } from '../../config/materials.js'
import { useConfigurator } from '../../hooks/useConfigurator.js'
import { useViewer } from '../../hooks/useViewer.js'
import { createEmblemTexture } from '../../utils/emblem.js'

function HardwareMaterial({ color, roughness, dark = false }) {
  return (
    <meshPhysicalMaterial
      color={dark ? '#51483e' : color}
      metalness={0.94}
      roughness={dark ? 0.32 : roughness}
      clearcoat={0.28}
      clearcoatRoughness={0.25}
      envMapIntensity={1.05}
    />
  )
}

function MakerPlate({ anchor, map }) {
  return (
    <mesh
      name="HarpMakerPlate"
      position={anchor.position.toArray()}
      quaternion={anchor.quaternion.toArray()}
      renderOrder={3}
    >
      <planeGeometry args={[anchor.width, anchor.height]} />
      <meshPhysicalMaterial
        map={map}
        transparent
        alphaTest={0.05}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        roughness={0.4}
        metalness={0.58}
        envMapIntensity={1.05}
        side={DoubleSide}
      />
    </mesh>
  )
}

function ForteLever({ pose, color, roughness }) {
  return (
    <group
      name="SharpingLever"
      position={pose.position.toArray()}
      quaternion={pose.quaternion.toArray()}
      scale={pose.scale}
    >
      <mesh castShadow position={[0, 0, 0.04]}>
        <boxGeometry args={[0.28, 0.62, 0.08]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>

      {[-0.205, 0.205].map((y) => (
        <mesh key={y} castShadow position={[0, y, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.052, 0.052, 0.028, 16]} />
          <HardwareMaterial color={color} roughness={roughness} dark />
        </mesh>
      ))}

      <mesh castShadow position={[0, 0.025, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.09, 24]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>

      <mesh castShadow position={[0.19, 0.025, 0.105]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 0.15, 18]} />
        <HardwareMaterial color={color} roughness={roughness} dark />
      </mesh>

      <mesh castShadow position={[0.1, -0.27, 0.11]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.055, 0.045, 0.44, 14]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh castShadow position={[0.2, -0.5, 0.11]}>
        <sphereGeometry args={[0.07, 14, 10]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
    </group>
  )
}

function OutputJack({ anchor, size, color, roughness }) {
  const depth = size * 0.0005
  const face = depth + size * 0.00003

  return (
    <group
      name="HarpOutputJack"
      position={anchor.position.toArray()}
      quaternion={anchor.quaternion.toArray()}
    >
      <mesh
        position={[0, 0, depth * 0.5]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[size * 0.0065, size * 0.0065, depth, 28]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.86}
          roughness={Math.max(roughness, 0.3)}
          clearcoat={0.2}
          clearcoatRoughness={0.34}
          envMapIntensity={0.94}
        />
      </mesh>
      <mesh position={[0, 0, face]} renderOrder={4}>
        <torusGeometry args={[size * 0.0034, size * 0.0007, 10, 28]} />
        <HardwareMaterial color={color} roughness={roughness} />
      </mesh>
      <mesh position={[0, 0, face + size * 0.00004]} renderOrder={5}>
        <circleGeometry args={[size * 0.0021, 24]} />
        <meshPhysicalMaterial color="#090909" metalness={0.16} roughness={0.5} />
      </mesh>
    </group>
  )
}

export function AddOnMeshes({ anchors }) {
  const values = useConfigurator((state) => state.values)
  const hardware = HARDWARE_FINISHES[values.hardware] ?? HARDWARE_FINISHES.bright
  const ready = useViewer((state) => state.ready)
  const size = anchors?.size ?? 0.6
  const emblemMap = useMemo(() => createEmblemTexture(), [])
  useEffect(
    () => () => {
      emblemMap.dispose()
    },
    [emblemMap],
  )
  const leverItems = useMemo(() => (Array.isArray(anchors?.levers) ? anchors.levers : []), [anchors])

  if (!anchors || !ready) return null

  const pickup = anchors.pickup
  const emblem = anchors.emblem

  return (
    <group>
      {values.detail === 'emblem' && emblem && (
        <MakerPlate
          anchor={emblem}
          map={emblemMap}
        />
      )}

      {values.pickup && pickup && (
        <group name="HarpPickup">
          {pickup.jack && (
            <OutputJack
              anchor={pickup.jack}
              size={size}
              color={hardware.color}
              roughness={hardware.roughness}
            />
          )}
        </group>
      )}

      {values.levers &&
        leverItems.map((pose, index) => (
          <ForteLever
            key={`${index}-${pose.position.y.toFixed(4)}`}
            pose={pose}
            color={hardware.color}
            roughness={hardware.roughness}
          />
        ))}
    </group>
  )
}
